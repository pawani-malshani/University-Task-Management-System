const UserModel = require('../models/userModel');
const { hashPassword, verifyPassword, generateToken } = require('../utils/auth');
const { logAudit } = require('../utils/auditLogger');
const crypto = require('crypto');

class AuthController {
  // Public registration: ALWAYS forces role = 'MEMBER'
  static async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      // Validation
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Full Name is required.'
        });
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({
          status: 'error',
          message: 'A valid email address is required.'
        });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 6 characters long.'
        });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if email already exists
      const existing = await UserModel.findByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({
          status: 'error',
          message: 'An account with this email address already exists.'
        });
      }

      // SECURITY RULE: Public signup can ONLY ever register as MEMBER.
      // Any client-provided 'role' or 'isAdmin' field is completely ignored.
      const assignedRole = 'MEMBER';

      const { salt, hash } = hashPassword(password);

      const user = await UserModel.create({
        name: name.trim(),
        email: normalizedEmail,
        password_hash: hash,
        salt,
        role: assignedRole
      });

      // Log registration in audit log
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'AUTH_REGISTER',
        details: { role: assignedRole },
        ip: clientIp
      });

      const token = generateToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      });

      return res.status(201).json({
        status: 'success',
        message: 'Account created successfully as a Member!',
        data: {
          user,
          token
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Email and password are required.'
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const userRecord = await UserModel.findByEmail(normalizedEmail);

      if (!userRecord) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password.'
        });
      }

      // Check account status (is_active)
      if (userRecord.is_active === false) {
        await logAudit({
          userId: userRecord.id,
          userEmail: userRecord.email,
          action: 'LOGIN_BLOCKED_SUSPENDED',
          details: { reason: 'Account suspended' },
          ip: clientIp
        });

        return res.status(403).json({
          status: 'error',
          message: 'This account has been deactivated or suspended. Please contact an administrator.'
        });
      }

      const isValid = verifyPassword(password, userRecord.salt, userRecord.password_hash);
      if (!isValid) {
        await logAudit({
          userId: userRecord.id,
          userEmail: userRecord.email,
          action: 'AUTH_LOGIN_FAILED',
          details: { reason: 'Incorrect password' },
          ip: clientIp
        });

        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password.'
        });
      }

      // Record successful login in audit log
      await logAudit({
        userId: userRecord.id,
        userEmail: userRecord.email,
        action: 'AUTH_LOGIN_SUCCESS',
        details: { role: userRecord.role },
        ip: clientIp
      });

      const token = generateToken({
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role: userRecord.role
      });

      const { password_hash, salt, ...safeUser } = userRecord;

      return res.status(200).json({
        status: 'success',
        message: 'Login successful!',
        data: {
          user: safeUser,
          token
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // Accept admin invitation flow
  static async acceptInvite(req, res, next) {
    try {
      const { inviteToken, name, password } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      if (!inviteToken || !name || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Invite token, name, and password are required.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 6 characters long.'
        });
      }

      const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
      const invite = await UserModel.findInviteByTokenHash(tokenHash);

      if (!invite) {
        return res.status(404).json({
          status: 'error',
          message: 'Invalid or expired invitation token.'
        });
      }

      if (invite.used_at) {
        return res.status(400).json({
          status: 'error',
          message: 'This invitation has already been accepted and used.'
        });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return res.status(400).json({
          status: 'error',
          message: 'This invitation has expired. Request a new invite from an administrator.'
        });
      }

      // Check if user with this email already exists
      let user = await UserModel.findByEmail(invite.email);
      const { salt, hash } = hashPassword(password);

      if (user) {
        // Upgrade existing user to ADMIN
        await UserModel.updateRole(user.id, 'ADMIN');
        await UserModel.update(user.id, { name: name.trim(), password_hash: hash, salt });
        user = await UserModel.findById(user.id);
      } else {
        // Create new ADMIN account
        user = await UserModel.create({
          name: name.trim(),
          email: invite.email,
          password_hash: hash,
          salt,
          role: 'ADMIN'
        });
      }

      // Mark invite as used
      await UserModel.markInviteUsed(invite.id);

      await logAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'ADMIN_INVITE_ACCEPTED',
        details: { inviteId: invite.id },
        ip: clientIp
      });

      const token = generateToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'ADMIN'
      });

      return res.status(200).json({
        status: 'success',
        message: 'Admin invitation accepted! You are now an authorized Administrator.',
        data: {
          user,
          token
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User profile not found.'
        });
      }

      return res.status(200).json({
        status: 'success',
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const { name, email, avatar } = req.body;
      const userId = req.user.id;

      if (email) {
        const existing = await UserModel.findByEmail(email);
        if (existing && existing.id !== userId) {
          return res.status(409).json({
            status: 'error',
            message: 'Email is already taken by another account.'
          });
        }
      }

      // UserModel.update ignores 'role' field
      const updated = await UserModel.update(userId, { name, email, avatar });
      if (!updated) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found.'
        });
      }

      const token = generateToken({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role
      });

      return res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully.',
        data: {
          user: updated,
          token
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updatePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Both current password and new password are required.'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'New password must be at least 6 characters long.'
        });
      }

      const user = await UserModel.findByIdWithSecrets(userId);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found.'
        });
      }

      const isValid = verifyPassword(currentPassword, user.salt, user.password_hash);
      if (!isValid) {
        return res.status(400).json({
          status: 'error',
          message: 'Current password is incorrect.'
        });
      }

      const { salt, hash } = hashPassword(newPassword);
      await UserModel.update(userId, { password_hash: hash, salt });

      await logAudit({
        userId,
        userEmail: user.email,
        action: 'PASSWORD_CHANGED',
        details: {},
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      });

      return res.status(200).json({
        status: 'success',
        message: 'Password changed successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  // Get active team members: Admins get all; Regular members only see confirmed collaborators
  static async getTeamUsers(req, res, next) {
    try {
      const user = req.user;

      if (user && user.role === 'ADMIN') {
        const users = await UserModel.getAll();
        const safeMembers = users
          .filter(u => u.is_active !== false)
          .map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatar: u.avatar
          }));

        return res.status(200).json({
          status: 'success',
          data: safeMembers
        });
      }

      // For regular members: ONLY return teammates from projects they participate in!
      const ProjectModel = require('../models/projectModel');
      const userProjects = await ProjectModel.getAll(user);
      const collaboratorMap = new Map();

      userProjects.forEach(p => {
        if (Array.isArray(p.members)) {
          p.members.forEach(m => {
            if (m && (m.user_id || m.id)) {
              const id = m.user_id || m.id;
              if (!collaboratorMap.has(String(id))) {
                collaboratorMap.set(String(id), {
                  id,
                  name: m.name,
                  email: m.email,
                  role: m.role || 'MEMBER',
                  avatar: null
                });
              }
            }
          });
        }
      });

      return res.status(200).json({
        status: 'success',
        data: Array.from(collaboratorMap.values())
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
