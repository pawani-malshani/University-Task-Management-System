const db = require('../config/db');
const { mongoose, ProjectDoc, TaskDoc } = db;

class ProjectModel {
  static isUserMemberOfProject(project, user) {
    if (!user) return true;
    if (user.role === 'ADMIN') return true;
    const uidStr = String(user.id);
    const userEmail = (user.email || '').toLowerCase();

    // Check owner
    if (project.user_id && String(project.user_id) === uidStr) {
      return true;
    }

    // Check members array
    if (Array.isArray(project.members)) {
      return project.members.some(m => {
        if (!m) return false;
        if (typeof m === 'string' || typeof m === 'number') {
          return String(m) === uidStr;
        }
        return (
          String(m.user_id || m.id) === uidStr ||
          (m.email && m.email.toLowerCase() === userEmail)
        );
      });
    }

    return false;
  }

  static isUserIdMemberOfProject(project, targetUserId) {
    if (!project || !targetUserId) return false;
    const uidStr = String(targetUserId);

    // Check owner
    if (project.user_id && String(project.user_id) === uidStr) {
      return true;
    }

    // Check members array
    if (Array.isArray(project.members)) {
      return project.members.some(m => {
        if (!m) return false;
        if (typeof m === 'string' || typeof m === 'number') {
          return String(m) === uidStr;
        }
        return String(m.user_id || m.id) === uidStr;
      });
    }

    return false;
  }

  static async getAll(user = null) {
    let result = [];

    if (db.getIsDbConnected()) {
      try {
        const matchStage = {};
        if (user && user.role === 'MEMBER') {
          const uid = user.id;
          const uidStr = String(user.id);
          const email = (user.email || '').toLowerCase();

          const orConditions = [
            { user_id: uid },
            { user_id: uidStr },
            { 'members.user_id': uid },
            { 'members.user_id': uidStr },
            { 'members.email': email }
          ];
          if (mongoose.Types.ObjectId.isValid(uid)) {
            orConditions.push(
              { user_id: new mongoose.Types.ObjectId(uid) },
              { 'members.user_id': new mongoose.Types.ObjectId(uid) }
            );
          }
          matchStage.$or = orConditions;
        }

        const pipeline = [
          ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
          {
            $lookup: {
              from: 'tasks',
              let: { pid: '$_id', pidStr: { $toString: '$_id' } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        { $eq: ['$project_id', '$$pid'] },
                        { $eq: ['$project_id', '$$pidStr'] }
                      ]
                    }
                  }
                }
              ],
              as: 'tasks'
            }
          },
          {
            $project: {
              _id: 1,
              name: 1,
              description: 1,
              user_id: 1,
              owner_name: 1,
              members: 1,
              created_at: 1,
              task_count: { $size: '$tasks' }
            }
          },
          { $sort: { name: 1 } }
        ];

        const projects = await ProjectDoc.aggregate(pipeline);

        result = projects.map(p => ({
          id: p._id.toString(),
          name: p.name,
          description: p.description || '',
          user_id: p.user_id || null,
          owner_name: p.owner_name || '',
          members: Array.isArray(p.members) ? p.members : [],
          task_count: p.task_count || 0,
          created_at: p.created_at
        }));
        return result;
      } catch (err) {
        console.error('Error fetching projects from MongoDB:', err.message);
      }
    }

    // Fallback store
    const projects = db.fallbackStore.getProjects();
    const tasks = db.fallbackStore.getTasks();

    let filtered = projects;
    if (user && user.role === 'MEMBER') {
      filtered = projects.filter(p => this.isUserMemberOfProject(p, user));
    }

    return filtered.map(p => ({
      ...p,
      members: Array.isArray(p.members) ? p.members : [],
      task_count: tasks.filter(t => String(t.project_id) === String(p.id)).length
    }));
  }

  static async getById(id, user = null) {
    if (!id) return null;

    let project = null;

    if (db.getIsDbConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          project = await ProjectDoc.findById(id);
        } else {
          project = await ProjectDoc.findOne({ id: String(id) });
        }
        if (project) {
          const doc = project.toJSON();
          doc.members = Array.isArray(doc.members) ? doc.members : [];
          if (user && !this.isUserMemberOfProject(doc, user)) {
            return { unauthorized: true };
          }
          return doc;
        }
      } catch (err) {
        console.error('Error in ProjectModel.getById:', err.message);
      }
    }

    const p = db.fallbackStore.getProjects().find(proj => String(proj.id) === String(id));
    if (!p) return null;

    const doc = {
      ...p,
      members: Array.isArray(p.members) ? p.members : []
    };

    if (user && !this.isUserMemberOfProject(doc, user)) {
      return { unauthorized: true };
    }

    return doc;
  }

  static async create({ name, description, user_id, owner_name, owner_email = '', members = [] }) {
    const initialMembers = Array.isArray(members) ? [...members] : [];

    let resolvedEmail = owner_email;
    if (!resolvedEmail && user_id) {
      try {
        const UserModel = require('./userModel');
        const u = await UserModel.findById(user_id);
        if (u && u.email) {
          resolvedEmail = u.email;
        }
      } catch (_) {}
    }

    // If owner is provided, ensure owner is automatically a member of the project
    if (user_id) {
      const hasOwner = initialMembers.some(
        m => String(m.user_id || m.id) === String(user_id)
      );
      if (!hasOwner) {
        initialMembers.unshift({
          user_id,
          name: owner_name || 'Owner',
          email: resolvedEmail || '',
          role: 'OWNER'
        });
      }
    }

    if (db.getIsDbConnected()) {
      try {
        const doc = await ProjectDoc.create({
          name: name.trim(),
          description: description || '',
          user_id: user_id || null,
          owner_name: owner_name || '',
          members: initialMembers
        });
        return { ...doc.toJSON(), task_count: 0 };
      } catch (err) {
        console.error('Error in ProjectModel.create:', err.message);
      }
    }

    const projects = db.fallbackStore.getProjects();
    const newId = projects.length > 0 ? Math.max(...projects.map(p => Number(p.id) || 0)) + 1 : 1;
    const newProject = {
      id: newId,
      name: name.trim(),
      description: description || '',
      user_id: user_id || null,
      owner_name: owner_name || '',
      members: initialMembers,
      created_at: new Date().toISOString(),
      task_count: 0
    };
    projects.push(newProject);
    db.fallbackStore.setProjects(projects);
    return newProject;
  }

  static async update(id, updates) {
    if (!id) return null;

    if (db.getIsDbConnected()) {
      try {
        let updated = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          updated = await ProjectDoc.findByIdAndUpdate(id, updates, { new: true });
        } else {
          updated = await ProjectDoc.findOneAndUpdate({ id: String(id) }, updates, { new: true });
        }
        return updated ? updated.toJSON() : null;
      } catch (err) {
        console.error('Error in ProjectModel.update:', err.message);
      }
    }

    const projects = db.fallbackStore.getProjects();
    const idx = projects.findIndex(p => String(p.id) === String(id));
    if (idx === -1) return null;

    projects[idx] = {
      ...projects[idx],
      ...updates
    };
    db.fallbackStore.setProjects(projects);
    return projects[idx];
  }

  static async addMember(projectId, member) {
    const project = await this.getById(projectId);
    if (!project || project.unauthorized) return null;

    const currentMembers = Array.isArray(project.members) ? [...project.members] : [];
    const memberIdStr = String(member.user_id || member.id);

    // Prevent duplicate member addition
    const alreadyExists = currentMembers.some(
      m => String(m.user_id || m.id) === memberIdStr || (m.email && m.email.toLowerCase() === (member.email || '').toLowerCase())
    );

    if (alreadyExists) {
      return project;
    }

    currentMembers.push({
      user_id: member.user_id || member.id,
      name: member.name || 'Team Member',
      email: member.email || '',
      role: member.role || 'MEMBER'
    });

    return await this.update(projectId, { members: currentMembers });
  }

  static async removeMember(projectId, targetUserId) {
    const project = await this.getById(projectId);
    if (!project || project.unauthorized) return null;

    const currentMembers = Array.isArray(project.members) ? [...project.members] : [];
    const filteredMembers = currentMembers.filter(
      m => String(m.user_id || m.id) !== String(targetUserId)
    );

    return await this.update(projectId, { members: filteredMembers });
  }

  static async delete(id) {
    if (!id) return false;

    if (db.getIsDbConnected()) {
      try {
        let deleted = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          deleted = await ProjectDoc.findByIdAndDelete(id);
        } else {
          deleted = await ProjectDoc.findOneAndDelete({ id: String(id) });
        }

        if (deleted) {
          const pid = deleted._id;
          const pidStr = deleted._id.toString();
          await TaskDoc.deleteMany({
            $or: [
              { project_id: pid },
              { project_id: pidStr },
              { project_id: String(id) }
            ]
          });
        }
        return true;
      } catch (err) {
        console.error('Error in ProjectModel.delete:', err.message);
      }
    }

    const projects = db.fallbackStore.getProjects().filter(p => String(p.id) !== String(id));
    db.fallbackStore.setProjects(projects);
    return true;
  }
}

module.exports = ProjectModel;