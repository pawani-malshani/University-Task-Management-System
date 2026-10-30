const db = require('../config/db');
const { mongoose, UserDoc, TaskDoc, AdminInviteDoc } = db;

class UserModel {
  static async findByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();

    if (db.getIsDbConnected()) {
      try {
        const user = await UserDoc.findOne({ email: cleanEmail });
        return user ? user.toJSON() : null;
      } catch (err) {
        console.error('Error in UserModel.findByEmail:', err.message);
      }
    }

    const users = db.fallbackStore.getUsers();
    return users.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }

  static async findById(id) {
    if (!id) return null;

    if (db.getIsDbConnected()) {
      try {
        let user = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          user = await UserDoc.findById(id);
        } else {
          user = await UserDoc.findOne({ id: String(id) });
        }
        if (!user) {
          user = await UserDoc.findOne({
            $or: [{ _id: id }, { id: String(id) }]
          });
        }
        if (!user) return null;

        const doc = user.toJSON();
        const { password_hash, salt, ...safeUser } = doc;
        return safeUser;
      } catch (err) {
        console.error('Error in UserModel.findById:', err.message);
      }
    }

    const users = db.fallbackStore.getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user) return null;

    const { password_hash, salt, ...safeUser } = user;
    return safeUser;
  }

  static async findByIdWithSecrets(id) {
    if (!id) return null;

    if (db.getIsDbConnected()) {
      try {
        let user = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          user = await UserDoc.findById(id);
        } else {
          user = await UserDoc.findOne({ id: String(id) });
        }
        if (!user) {
          user = await UserDoc.findOne({
            $or: [{ _id: id }, { id: String(id) }]
          });
        }
        return user ? user.toJSON() : null;
      } catch (err) {
        console.error('Error in UserModel.findByIdWithSecrets:', err.message);
      }
    }

    const users = db.fallbackStore.getUsers();
    return users.find(u => String(u.id) === String(id)) || null;
  }

  // Generic public registration forces role = 'MEMBER'
  static async create({ name, email, password_hash, salt, role = 'MEMBER', avatar = null }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';

    if (db.getIsDbConnected()) {
      try {
        const newUser = await UserDoc.create({
          name: name.trim(),
          email: cleanEmail,
          password_hash,
          salt,
          role: cleanRole,
          is_active: true,
          avatar
        });

        const doc = newUser.toJSON();
        const { password_hash: _h, salt: _s, ...safeUser } = doc;
        return safeUser;
      } catch (err) {
        console.error('Error in UserModel.create:', err.message);
      }
    }

    const users = db.fallbackStore.getUsers();
    const newId = users.length > 0 ? Math.max(...users.map(u => Number(u.id) || 0)) + 1 : 1;
    const now = new Date();

    const newUser = {
      id: newId,
      name: name.trim(),
      email: cleanEmail,
      password_hash,
      salt,
      role: cleanRole,
      is_active: true,
      avatar,
      created_at: now,
      updated_at: now
    };

    users.push(newUser);
    db.fallbackStore.setUsers(users);

    const { password_hash: _h, salt: _s, ...safeUser } = newUser;
    return safeUser;
  }

  // Update profile info - explicitly excludes 'role' to prevent privilege escalation
  static async update(id, updates) {
    if (!id) return null;

    const existing = await this.findByIdWithSecrets(id);
    if (!existing) return null;

    const updatedName = updates.name !== undefined ? updates.name.trim() : existing.name;
    const updatedEmail = updates.email !== undefined ? updates.email.toLowerCase().trim() : existing.email;
    const updatedHash = updates.password_hash !== undefined ? updates.password_hash : existing.password_hash;
    const updatedSalt = updates.salt !== undefined ? updates.salt : existing.salt;
    const updatedAvatar = updates.avatar !== undefined ? updates.avatar : existing.avatar;

    if (db.getIsDbConnected()) {
      try {
        let updated = null;
        const updatePayload = {
          name: updatedName,
          email: updatedEmail,
          password_hash: updatedHash,
          salt: updatedSalt,
          avatar: updatedAvatar
        };

        if (mongoose.Types.ObjectId.isValid(id)) {
          updated = await UserDoc.findByIdAndUpdate(id, updatePayload, { new: true });
        }
        if (!updated) {
        } else {
          updated = await UserDoc.findOneAndUpdate(
            { $or: [{ _id: id }, { id: String(id) }] },
            { id: String(id) },
            updatePayload,
            { new: true }
          );
        }

        if (updated) {
          const doc = updated.toJSON();
          const { password_hash, salt, ...safeUser } = doc;
          return safeUser;
        }
      } catch (err) {
        console.error('Error in UserModel.update:', err.message);
      }
    }

    const users = db.fallbackStore.getUsers();
    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return null;

    users[idx] = {
      ...users[idx],
      name: updatedName,
      email: updatedEmail,
      password_hash: updatedHash,
      salt: updatedSalt,
      avatar: updatedAvatar,
      updated_at: new Date()
    };

    db.fallbackStore.setUsers(users);
    const { password_hash, salt, ...safeUser } = users[idx];
    return safeUser;
  }

  // Admin-only role update
  static async updateRole(id, role) {
    if (!id) return null;
    const validRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';

    if (db.getIsDbConnected()) {
      try {
        let updated = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          updated = await UserDoc.findByIdAndUpdate(id, { role: validRole }, { new: true });
        }
        if (!updated) {
        } else {
          updated = await UserDoc.findOneAndUpdate(
            { $or: [{ _id: id }, { id: String(id) }] },
            { id: String(id) },
            { role: validRole },
            { new: true }
          );
        }
        if (updated) {
          const doc = updated.toJSON();
          const { password_hash, salt, ...safeUser } = doc;
          return safeUser;
        }
      } catch (err) {
        console.error('Error in UserModel.updateRole:', err.message);
      }
    }

    const users = db.fallbackStore.getUsers();
    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return null;

    users[idx].role = validRole;
    users[idx].updated_at = new Date();
    db.fallbackStore.setUsers(users);

    const { password_hash, salt, ...safeUser } = users[idx];
    return safeUser;
  }

  // Admin-only account activation / suspension
  static async updateStatus(id, isActive) {
    if (!id) return null;
    const activeVal = Boolean(isActive);

    if (db.getIsDbConnected()) {
      try {
        let updated = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          updated = await UserDoc.findByIdAndUpdate(id, { is_active: activeVal }, { new: true });
        }
        if (!updated) {
        } else {
          updated = await UserDoc.findOneAndUpdate(
            { $or: [{ _id: id }, { id: String(id) }] },
            { id: String(id) },
            { is_active: activeVal },
            { new: true }
          );
        }
        if (updated) {
          const doc = updated.toJSON();
          const { password_hash, salt, ...safeUser } = doc;
          return safeUser;
        }
      } catch (err) {
        console.error('Error in UserModel.updateStatus:', err.message);
      }
    }

    const users = db.fallbackStore.getUsers();
    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return null;

    users[idx].is_active = activeVal;
    users[idx].updated_at = new Date();
    db.fallbackStore.setUsers(users);

    const { password_hash, salt, ...safeUser } = users[idx];
    return safeUser;
  }

  static async getAll() {
    if (db.getIsDbConnected()) {
      try {
        const users = await UserDoc.aggregate([
          {
            $lookup: {
              from: 'tasks',
              let: { uid: '$_id', uidStr: { $toString: '$_id' } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        { $eq: ['$user_id', '$$uid'] },
                        { $eq: ['$user_id', '$$uidStr'] }
                      ]
                    }
                  }
                }
              ],
              as: 'assigned_tasks'
            }
          },
          {
            $project: {
              _id: 1,
              name: 1,
              email: 1,
              role: 1,
              is_active: 1,
              avatar: 1,
              created_at: 1,
              updated_at: 1,
              total_tasks: { $size: '$assigned_tasks' }
            }
          },
          { $sort: { created_at: -1 } }
        ]);

        return users.map(u => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          role: u.role,
          is_active: u.is_active !== undefined ? u.is_active : true,
          avatar: u.avatar || null,
          created_at: u.created_at,
          updated_at: u.updated_at,
          total_tasks: u.total_tasks || 0
        }));
      } catch (err) {
        console.error('Error in UserModel.getAll from MongoDB:', err.message);
      }
    }

    const users = db.fallbackStore.getUsers();
    const tasks = db.fallbackStore.getTasks();

    return users.map(u => {
      const { password_hash, salt, ...safe } = u;
      const userTasks = tasks.filter(t => String(t.user_id) === String(u.id));
      return {
        ...safe,
        is_active: u.is_active !== undefined ? u.is_active : true,
        total_tasks: userTasks.length
      };
    });
  }

  static async delete(id) {
    if (!id) return false;

    if (db.getIsDbConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          await UserDoc.findByIdAndDelete(id);
        } else {
          await UserDoc.findOneAndDelete({
            $or: [{ _id: id }, { id: String(id) }]
          });
          await UserDoc.findOneAndDelete({ id: String(id) });
        }
        return true;
      } catch (err) {
        console.error('Error in UserModel.delete:', err.message);
      }
    }

    let users = db.fallbackStore.getUsers();
    const initialLen = users.length;
    users = users.filter(u => String(u.id) !== String(id));
    db.fallbackStore.setUsers(users);
    return users.length < initialLen;
  }

  static async count() {
    if (db.getIsDbConnected()) {
      try {
        return await UserDoc.countDocuments();
      } catch (err) {
        console.error('Error in UserModel.count:', err.message);
      }
    }
    return db.fallbackStore.getUsers().length;
  }

  // ==========================================
  // Admin Invitations Flow
  // ==========================================
  static async createInvite({ email, token_hash, invited_by, expires_at }) {
    const cleanEmail = email.toLowerCase().trim();

    if (db.getIsDbConnected()) {
      try {
        const invite = await AdminInviteDoc.create({
          email: cleanEmail,
          token_hash,
          role: 'ADMIN',
          invited_by: invited_by || null,
          expires_at: new Date(expires_at)
        });
        return invite.toJSON();
      } catch (err) {
        console.error('Error in UserModel.createInvite:', err.message);
      }
    }

    const invites = db.fallbackStore.getInvites();
    const newId = invites.length > 0 ? Math.max(...invites.map(i => Number(i.id) || 0)) + 1 : 1;
    const newInvite = {
      id: newId,
      email: cleanEmail,
      token_hash,
      role: 'ADMIN',
      invited_by: invited_by || null,
      expires_at: new Date(expires_at).toISOString(),
      used_at: null,
      created_at: new Date().toISOString()
    };
    invites.unshift(newInvite);
    db.fallbackStore.setInvites(invites);
    return newInvite;
  }

  static async findInviteByTokenHash(token_hash) {
    if (!token_hash) return null;

    if (db.getIsDbConnected()) {
      try {
        const invite = await AdminInviteDoc.findOne({ token_hash });
        return invite ? invite.toJSON() : null;
      } catch (err) {
        console.error('Error in UserModel.findInviteByTokenHash:', err.message);
      }
    }

    const invites = db.fallbackStore.getInvites();
    return invites.find(i => i.token_hash === token_hash) || null;
  }

  static async markInviteUsed(id) {
    if (!id) return false;
    const now = new Date();

    if (db.getIsDbConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          await AdminInviteDoc.findByIdAndUpdate(id, { used_at: now });
        } else {
          await AdminInviteDoc.findOneAndUpdate(
            { $or: [{ _id: id }, { id: String(id) }] },
            { used_at: now }
          );
        }
        return true;
      } catch (err) {
        console.error('Error in UserModel.markInviteUsed:', err.message);
      }
    }

    const invites = db.fallbackStore.getInvites();
    const inv = invites.find(i => String(i.id) === String(id));
    if (inv) {
      inv.used_at = now.toISOString();
      db.fallbackStore.setInvites(invites);
    }
    return true;
  }

  static async getAllInvites() {
    if (db.getIsDbConnected()) {
      try {
        const invites = await AdminInviteDoc.find().sort({ created_at: -1 });
        const inviterIds = [...new Set(invites.map(i => i.invited_by).filter(Boolean))];
        const validObjIds = inviterIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

        const users = await UserDoc.find({
          $or: [
            { _id: { $in: validObjIds } },
            { id: { $in: inviterIds } }
          ]
        });

        const userMap = new Map();
        users.forEach(u => {
          userMap.set(u._id.toString(), u.name);
          if (u.id) userMap.set(String(u.id), u.name);
        });

        return invites.map(i => {
          const doc = i.toJSON();
          return {
            ...doc,
            inviter_name: doc.invited_by ? (userMap.get(String(doc.invited_by)) || null) : null
          };
        });
      } catch (err) {
        console.error('Error in UserModel.getAllInvites:', err.message);
      }
    }

    const invites = db.fallbackStore.getInvites();
    const users = db.fallbackStore.getUsers();
    return invites.map(i => {
      const inviter = users.find(u => String(u.id) === String(i.invited_by));
      return {
        ...i,
        inviter_name: inviter ? inviter.name : null
      };
    });
  }

  static async deleteInvite(id) {
    if (!id) return false;

    if (db.getIsDbConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          await AdminInviteDoc.findByIdAndDelete(id);
        } else {
          await AdminInviteDoc.findOneAndDelete({
            $or: [{ _id: id }, { id: String(id) }]
          });
        }
        return true;
      } catch (err) {
        console.error('Error in UserModel.deleteInvite:', err.message);
      }
    }

    let invites = db.fallbackStore.getInvites();
    const initialLen = invites.length;
    invites = invites.filter(i => String(i.id) !== String(id));
    db.fallbackStore.setInvites(invites);
    return invites.length < initialLen;
  }
}

module.exports = UserModel;