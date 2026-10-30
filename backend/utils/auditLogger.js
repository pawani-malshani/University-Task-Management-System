const db = require('../config/db');
const { mongoose, AuditLogDoc, UserDoc } = db;

async function logAudit({ userId = null, userEmail = null, action, details = {}, ip = null }) {
  const ipAddress = ip || '127.0.0.1';
  const now = new Date();

  try {
    if (db.getIsDbConnected()) {
      await AuditLogDoc.create({
        user_id: userId ? String(userId) : null,
        user_email: userEmail || null,
        action,
        details,
        ip_address: ipAddress,
        created_at: now
      });
      return;
    }

    const logs = db.fallbackStore.getAuditLogs();
    const newLog = {
      id: logs.length > 0 ? Math.max(...logs.map(l => Number(l.id) || 0)) + 1 : 1,
      user_id: userId ? String(userId) : null,
      user_email: userEmail || null,
      action,
      details,
      ip_address: ipAddress,
      created_at: now.toISOString()
    };
    logs.unshift(newLog);
    db.fallbackStore.setAuditLogs(logs);
  } catch (err) {
    console.error('⚠️ [AuditLog] Failed to record audit log:', err.message);
  }
}

async function getRecentAuditLogs(limit = 50) {
  if (db.getIsDbConnected()) {
    try {
      const logs = await AuditLogDoc.find().sort({ created_at: -1 }).limit(limit);
      const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))];
      const validObjIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

      const users = await UserDoc.find({
        $or: [
          { _id: { $in: validObjIds } },
          { id: { $in: userIds } }
        ]
      });

      const userMap = new Map();
      users.forEach(u => {
        userMap.set(u._id.toString(), u.name);
        if (u.id) userMap.set(String(u.id), u.name);
      });

      return logs.map(l => {
        const doc = l.toJSON();
        return {
          ...doc,
          user_name: doc.user_id ? (userMap.get(String(doc.user_id)) || null) : null
        };
      });
    } catch (err) {
      console.error('Error fetching audit logs from MongoDB:', err.message);
    }
  }

  const logs = db.fallbackStore.getAuditLogs();
  const users = db.fallbackStore.getUsers();
  return logs.slice(0, limit).map(l => {
    const user = users.find(u => String(u.id) === String(l.user_id));
    return {
      ...l,
      user_name: user ? user.name : null
    };
  });
}

module.exports = {
  logAudit,
  getRecentAuditLogs
};
