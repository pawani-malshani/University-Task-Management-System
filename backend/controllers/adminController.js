const UserModel = require('../models/userModel');
const TaskModel = require('../models/taskModel');
const ProjectModel = require('../models/projectModel');
const { getIsDbConnected } = require('../config/db');
const { logAudit, getRecentAuditLogs } = require('../utils/auditLogger');
const crypto = require('crypto');

class AdminController {
  static async getAllUsers(req, res, next) {
    try {
      const users = await UserModel.getAll();
      return res.status(200).json({
        status: 'success',
        data: users
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUserRole(req, res, next) {
    try {
      const targetUserId = req.params.id;
      const { role } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      if (!['ADMIN', 'MEMBER'].includes(role)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid role. Must be either ADMIN or MEMBER.'
        });
      }

      // Safeguard: Prevent admin from demoting themselves
      if (String(req.user.id) === String(targetUserId) && role !== 'ADMIN') {
        return res.status(400).json({
          status: 'error',
          message: 'You cannot revoke your own administrator privileges.'
        });
      }

      const updated = await UserModel.updateRole(targetUserId, role);
      if (!updated) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found.'
        });
      }

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'ROLE_CHANGED',
        details: { targetUserId, newRole: role, targetEmail: updated.email },
        ip: clientIp
      });

      return res.status(200).json({
        status: 'success',
        message: `User role successfully updated to ${role}.`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUserStatus(req, res, next) {
    try {
      const targetUserId = req.params.id;
      const { isActive } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          status: 'error',
          message: 'isActive must be a boolean value (true or false).'
        });
      }

      // Safeguard: Prevent admin from deactivating themselves
      if (String(req.user.id) === String(targetUserId) && !isActive) {
        return res.status(400).json({
          status: 'error',
          message: 'You cannot deactivate your own administrative account.'
        });
      }

      const updated = await UserModel.updateStatus(targetUserId, isActive);
      if (!updated) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found.'
        });
      }

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
        details: { targetUserId, targetEmail: updated.email },
        ip: clientIp
      });

      return res.status(200).json({
        status: 'success',
        message: `User account ${isActive ? 'activated' : 'suspended'} successfully.`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteUser(req, res, next) {
    try {
      const targetUserId = req.params.id;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      // Safeguard: Prevent admin from deleting themselves
      if (String(req.user.id) === String(targetUserId)) {
        return res.status(400).json({
          status: 'error',
          message: 'You cannot delete your own account from the admin panel.'
        });
      }

      const target = await UserModel.findById(targetUserId);
      const deleted = await UserModel.delete(targetUserId);
      if (!deleted) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found or already deleted.'
        });
      }

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'USER_DELETED',
        details: { targetUserId, targetEmail: target?.email },
        ip: clientIp
      });

      return res.status(200).json({
        status: 'success',
        message: 'User removed successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  // Admin Invitations Flow
  static async getInvitations(req, res, next) {
    try {
      const invites = await UserModel.getAllInvites();
      return res.status(200).json({
        status: 'success',
        data: invites
      });
    } catch (err) {
      next(err);
    }
  }

  static async createInvitation(req, res, next) {
    try {
      const { email } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({
          status: 'error',
          message: 'A valid email address is required to generate an invitation.'
        });
      }

      const cleanEmail = email.toLowerCase().trim();

      // Check if user is already an admin
      const existingUser = await UserModel.findByEmail(cleanEmail);
      if (existingUser && existingUser.role === 'ADMIN') {
        return res.status(409).json({
          status: 'error',
          message: 'User is already an Administrator.'
        });
      }

      // Generate random high-entropy token
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Expires in 48 hours
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

      const invite = await UserModel.createInvite({
        email: cleanEmail,
        token_hash: tokenHash,
        invited_by: req.user.id,
        expires_at: expiresAt
      });

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'ADMIN_INVITE_CREATED',
        details: { invitedEmail: cleanEmail, expiresAt },
        ip: clientIp
      });

      return res.status(201).json({
        status: 'success',
        message: 'Admin invitation created successfully.',
        data: {
          invite,
          rawToken,
          inviteLink: `/invite/${rawToken}`
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteInvitation(req, res, next) {
    try {
      const inviteId = req.params.id;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      await UserModel.deleteInvite(inviteId);

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'ADMIN_INVITE_REVOKED',
        details: { inviteId },
        ip: clientIp
      });

      return res.status(200).json({
        status: 'success',
        message: 'Invitation revoked successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  // Audit Logs Endpoint
  static async getAuditLogs(req, res, next) {
    try {
      const limit = Number(req.query.limit) || 50;
      const logs = await getRecentAuditLogs(limit);
      return res.status(200).json({
        status: 'success',
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAdminStats(req, res, next) {
    try {
      const users = await UserModel.getAll();
      const allTasks = await TaskModel.getAll({});
      const allProjects = await ProjectModel.getAll();
      const invites = await UserModel.getAllInvites();

      const totalUsers = users.length;
      const totalAdmins = users.filter(u => u.role === 'ADMIN').length;
      const totalMembers = users.filter(u => u.role === 'MEMBER').length;
      const activeUsers = users.filter(u => u.is_active !== false).length;
      const suspendedUsers = users.filter(u => u.is_active === false).length;
      const totalTasks = allTasks.length;
      const totalProjects = allProjects.length;
      const pendingInvites = invites.filter(i => !i.used_at && new Date(i.expires_at) > new Date()).length;

      return res.status(200).json({
        status: 'success',
        data: {
          system: {
            status: 'HEALTHY',
            databaseConnected: getIsDbConnected(),
            databaseEngine: getIsDbConnected() ? 'PostgreSQL' : 'In-Memory Fallback',
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
          },
          users: {
            total: totalUsers,
            admins: totalAdmins,
            members: totalMembers,
            active: activeUsers,
            suspended: suspendedUsers
          },
          invitations: {
            total: invites.length,
            pending: pendingInvites
          },
          content: {
            tasks: totalTasks,
            projects: totalProjects
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AdminController;
