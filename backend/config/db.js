const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

let isDbConnected = false;

// Persistent local JSON file path for development resilience when MongoDB is offline
const localStorePath = path.join(__dirname, '..', 'database', 'local_dev_store.json');

// Default initial seeds
const defaultAdminSalt = 'b29f32c35525218a1ad35c0729c08a29';
const defaultAdminHash = '1c632a13174d0e0956ddae9279cd0220e2ead1bbd55481ca1575255ba43c66ebdfbf22a7d4be2f6d356b4e81815e118cd80e72449eb8c12557be3341d76f406a';

const defaultAdminUser = {
  id: 1,
  name: 'System Administrator',
  email: 'admin@taskflow.local',
  password_hash: defaultAdminHash,
  salt: defaultAdminSalt,
  role: 'ADMIN',
  is_active: true,
  avatar: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

let fallbackUsers = [defaultAdminUser];

let fallbackProjects = [
  {
    id: 1,
    name: 'Core Platform v2.0',
    description: 'Central task workflow and team collaboration features',
    user_id: 1,
    owner_name: 'System Administrator',
    members: [
      { user_id: 1, name: 'System Administrator', email: 'admin@taskflow.local', role: 'ADMIN' }
    ],
    created_at: new Date().toISOString()
  }
];

let fallbackTasks = [
  {
    id: 1,
    title: 'Review System Permissions',
    description: 'Ensure RBAC policies and team project isolation are enforced correctly',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    project_id: 1,
    project_name: 'Core Platform v2.0',
    user_id: 1,
    assigned_name: 'System Administrator',
    assigned_email: 'admin@taskflow.local',
    created_by: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];
let fallbackInvites = [];
let fallbackAuditLogs = [];

function loadFallbackData() {
  try {
    if (fs.existsSync(localStorePath)) {
      const raw = fs.readFileSync(localStorePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.users) && data.users.length > 0) {
        fallbackUsers = data.users;
        if (!fallbackUsers.some(u => u.email === defaultAdminUser.email)) {
          fallbackUsers.unshift(defaultAdminUser);
        }
      }
      if (Array.isArray(data.projects)) {
        fallbackProjects = data.projects;
      }
      if (Array.isArray(data.tasks)) {
        fallbackTasks = data.tasks;
      }
      if (Array.isArray(data.invites)) {
        fallbackInvites = data.invites;
      }
      if (Array.isArray(data.auditLogs)) {
        fallbackAuditLogs = data.auditLogs;
      }
      return;
    }
  } catch (err) {
    console.warn('⚠️ [Persistence] Could not load local_dev_store.json:', err.message);
  }
  saveFallbackData();
}

function saveFallbackData() {
  try {
    const dir = path.dirname(localStorePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload = {
      users: fallbackUsers,
      projects: fallbackProjects,
      tasks: fallbackTasks,
      invites: fallbackInvites,
      auditLogs: fallbackAuditLogs
    };
    fs.writeFileSync(localStorePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ [Persistence] Could not save to local_dev_store.json:', err.message);
  }
}

// Immediately load persisted fallback state from disk
loadFallbackData();

// Base schema transformation helper to ensure '_id' is consistently presented as 'id'
const baseSchemaOptions = {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
};

// ==========================================
// Mongoose Schemas & Models
// ==========================================

// 1. Users Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  salt: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
  is_active: { type: Boolean, default: true },
  avatar: { type: String, default: null }
}, baseSchemaOptions);

// 2. Project Member Sub-schema
const projectMemberSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.Mixed, required: true },
  name: { type: String, required: true },
  email: { type: String, default: '' },
  role: { type: String, default: 'MEMBER' }
}, { _id: false });

// 2. Projects Schema
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  user_id: { type: mongoose.Schema.Types.Mixed, default: null }, // Creator / Owner
  owner_name: { type: String, default: '' },
  members: { type: [projectMemberSchema], default: [] }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  toJSON: baseSchemaOptions.toJSON,
  toObject: baseSchemaOptions.toObject
});

// 3. Tasks Schema
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, default: '' },
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  due_date: { type: String, default: null }, // Store as YYYY-MM-DD or ISO string
  project_id: { type: mongoose.Schema.Types.Mixed, default: null },
  user_id: { type: mongoose.Schema.Types.Mixed, default: null }, // Assignee ID
  assigned_name: { type: String, default: null },
  assigned_email: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.Mixed, default: null }
}, baseSchemaOptions);

// 4. Admin Invites Schema
const adminInviteSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  token_hash: { type: String, required: true, unique: true },
  role: { type: String, default: 'ADMIN' },
  invited_by: { type: mongoose.Schema.Types.Mixed, default: null },
  expires_at: { type: Date, required: true },
  used_at: { type: Date, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  toJSON: baseSchemaOptions.toJSON,
  toObject: baseSchemaOptions.toObject
});

// 5. Audit Logs Schema
const auditLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.Mixed, default: null },
  user_email: { type: String, default: null },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip_address: { type: String, default: '127.0.0.1' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  toJSON: baseSchemaOptions.toJSON,
  toObject: baseSchemaOptions.toObject
});

// Register models
const UserDoc = mongoose.models.User || mongoose.model('User', userSchema);
const ProjectDoc = mongoose.models.Project || mongoose.model('Project', projectSchema);
const TaskDoc = mongoose.models.Task || mongoose.model('Task', taskSchema);
const AdminInviteDoc = mongoose.models.AdminInvite || mongoose.model('AdminInvite', adminInviteSchema);
const AuditLogDoc = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

async function initDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/taskflow';

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000
    });
    isDbConnected = true;
    console.log(`✅ [MongoDB] Successfully connected to database: "${mongoose.connection.name}"`);
  } catch (error) {
    isDbConnected = false;
    console.warn(`⚠️ [MongoDB] Could not connect to MongoDB server (${error.message}).`);
    console.warn(`💡 [MongoDB] Running with disk-backed fallback store at "${localStorePath}" for uninterrupted development.`);
  }
}

// Backward-compatible query helper for legacy calls
async function query(text, params = []) {
  return null;
}

module.exports = {
  mongoose,
  initDatabase,
  query,
  getIsDbConnected: () => isDbConnected && mongoose.connection.readyState === 1,
  UserDoc,
  ProjectDoc,
  TaskDoc,
  AdminInviteDoc,
  AuditLogDoc,
  fallbackStore: {
    getTasks: () => fallbackTasks,
    setTasks: (t) => { fallbackTasks = t; saveFallbackData(); },
    getProjects: () => fallbackProjects,
    setProjects: (p) => { fallbackProjects = p; saveFallbackData(); },
    getUsers: () => fallbackUsers,
    setUsers: (u) => { fallbackUsers = u; saveFallbackData(); },
    getInvites: () => fallbackInvites,
    setInvites: (inv) => { fallbackInvites = inv; saveFallbackData(); },
    getAuditLogs: () => fallbackAuditLogs,
    setAuditLogs: (logs) => { fallbackAuditLogs = logs; saveFallbackData(); },
    reload: loadFallbackData,
    save: saveFallbackData
  }
};