const db = require('../config/db');
const { mongoose, TaskDoc, ProjectDoc, UserDoc } = db;
const ProjectModel = require('./projectModel');

class TaskModel {
  static async getAll({ search, status, priority, projectId, sort = 'created_at', order = 'desc', user = null, scope = 'my_tasks' }) {
    // Determine accessible projects for non-admin user
    let userProjectIds = [];
    if (user && user.role === 'MEMBER') {
      const userProjects = await ProjectModel.getAll(user);
      userProjectIds = userProjects.map(p => String(p.id));
    }

    if (db.getIsDbConnected()) {
      try {
        const query = {};

        // User Scoping for MongoDB
        if (user && user.role === 'MEMBER') {
          const uid = user.id;
          const uidStr = String(user.id);
          const validUserObjIds = mongoose.Types.ObjectId.isValid(uid) ? [new mongoose.Types.ObjectId(uid)] : [];

          if (scope === 'all_shared' || scope === 'team') {
            // Can see tasks assigned to them OR tasks in any of their member projects
            const validProjObjIds = userProjectIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
            query.$or = [
              { user_id: { $in: [uid, uidStr, ...validUserObjIds] } },
              { project_id: { $in: [...userProjectIds, ...validProjObjIds] } }
            ];
          } else if (projectId && projectId !== 'ALL') {
            // When filtering by a specific project, verify membership
            if (!userProjectIds.includes(String(projectId))) {
              return []; // Not authorized for this project
            }
            // If viewing specific project with scope=my_tasks, filter to their tasks in that project
            // If scope=all_shared, view all in that project
            if (scope === 'my_tasks') {
              query.user_id = { $in: [uid, uidStr, ...validUserObjIds] };
            }
          } else {
            // Default "my_tasks": regular member only views their own tasks!
            query.user_id = { $in: [uid, uidStr, ...validUserObjIds] };
          }
        }

        if (search && search.trim() !== '') {
          const q = search.trim();
          const searchCondition = [
            { title: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } }
          ];
          if (query.$or) {
            query.$and = [{ $or: query.$or }, { $or: searchCondition }];
            delete query.$or;
          } else {
            query.$or = searchCondition;
          }
        }

        if (status && status !== 'ALL') {
          query.status = status;
        }

        if (priority && priority !== 'ALL') {
          query.priority = priority;
        }

        if (projectId && projectId !== 'ALL') {
          const pidMatches = [projectId];
          if (mongoose.Types.ObjectId.isValid(projectId)) {
            pidMatches.push(new mongoose.Types.ObjectId(projectId));
          }
          if (!isNaN(projectId)) {
            pidMatches.push(Number(projectId));
          }
          query.project_id = { $in: pidMatches };
        }

        // Allowed sort columns
        const allowedSortFields = {
          due_date: 'due_date',
          dueDate: 'due_date',
          priority: 'priority',
          status: 'status',
          title: 'title',
          created_at: 'created_at',
          createdAt: 'created_at'
        };

        const sortColumn = allowedSortFields[sort] || 'created_at';
        const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;

        const tasks = await TaskDoc.find(query).sort({ [sortColumn]: sortOrder });

        // Retrieve projects and users to enrich with project_name and assigned_name
        const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
        const validObjIds = projectIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        
        const userIds = [...new Set(tasks.map(t => t.user_id).filter(Boolean))];
        const validUserIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

        const [projects, users] = await Promise.all([
          ProjectDoc.find({
            $or: [
              { _id: { $in: validObjIds } },
              { id: { $in: projectIds } }
            ]
          }),
          UserDoc.find({
            $or: [
              { _id: { $in: validUserIds } },
              { id: { $in: userIds } }
            ]
          })
        ]);

        const projectMap = new Map();
        projects.forEach(p => {
          projectMap.set(p._id.toString(), p.name);
          if (p.id) projectMap.set(String(p.id), p.name);
        });

        const userMap = new Map();
        users.forEach(u => {
          userMap.set(u._id.toString(), { name: u.name, email: u.email });
          if (u.id) userMap.set(String(u.id), { name: u.name, email: u.email });
        });

        return tasks.map(t => {
          const doc = t.toJSON();
          const pName = doc.project_id ? (projectMap.get(String(doc.project_id)) || null) : null;
          const uInfo = doc.user_id ? userMap.get(String(doc.user_id)) : null;

          return {
            ...doc,
            project_name: pName,
            assigned_name: doc.assigned_name || (uInfo ? uInfo.name : null),
            assigned_email: doc.assigned_email || (uInfo ? uInfo.email : null)
          };
        });
      } catch (err) {
        console.error('Error fetching tasks from MongoDB:', err.message);
      }
    }

    // Fallback in-memory query
    let tasks = [...db.fallbackStore.getTasks()];

    // Scoping for in-memory fallback
    if (user && user.role === 'MEMBER') {
      const uidStr = String(user.id);
      if (scope === 'all_shared' || scope === 'team') {
        tasks = tasks.filter(t => 
          String(t.user_id) === uidStr || userProjectIds.includes(String(t.project_id))
        );
      } else if (projectId && projectId !== 'ALL') {
        if (!userProjectIds.includes(String(projectId))) {
          return [];
        }
        if (scope === 'my_tasks') {
          tasks = tasks.filter(t => String(t.user_id) === uidStr);
        }
      } else {
        // Default "my_tasks": regular member only views their own tasks!
        tasks = tasks.filter(t => String(t.user_id) === uidStr);
      }
    }

    if (search && search.trim() !== '') {
      const q = search.toLowerCase();
      tasks = tasks.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'ALL') {
      tasks = tasks.filter(t => t.status === status);
    }

    if (priority && priority !== 'ALL') {
      tasks = tasks.filter(t => t.priority === priority);
    }

    if (projectId && projectId !== 'ALL') {
      tasks = tasks.filter(t => String(t.project_id) === String(projectId));
    }

    // Enrich project_name and assigned_name
    const projects = db.fallbackStore.getProjects();
    const users = db.fallbackStore.getUsers();

    tasks = tasks.map(t => {
      const proj = projects.find(p => String(p.id) === String(t.project_id));
      const usr = users.find(u => String(u.id) === String(t.user_id));
      return {
        ...t,
        project_name: t.project_name || (proj ? proj.name : null),
        assigned_name: t.assigned_name || (usr ? usr.name : null),
        assigned_email: t.assigned_email || (usr ? usr.email : null)
      };
    });

    // Sort
    const isAsc = order.toLowerCase() === 'asc';
    tasks.sort((a, b) => {
      let valA = a[sort] || a.created_at || 0;
      let valB = b[sort] || b.created_at || 0;
      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });

    return tasks;
  }

  static async getById(id, user = null) {
    if (!id) return null;

    let doc = null;

    if (db.getIsDbConnected()) {
      try {
        let task = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          task = await TaskDoc.findById(id);
        } else {
          task = await TaskDoc.findOne({ id: String(id) });
        }
        if (!task) {
          task = await TaskDoc.findOne({
            $or: [{ _id: id }, { id: String(id) }]
          });
        }

        if (task) {
          doc = task.toJSON();
          if (doc.project_id) {
            let project = null;
            if (mongoose.Types.ObjectId.isValid(doc.project_id)) {
              project = await ProjectDoc.findById(doc.project_id);
            } else {
              project = await ProjectDoc.findOne({ id: String(doc.project_id) });
            }
            if (!project) {
              project = await ProjectDoc.findOne({
                $or: [{ _id: doc.project_id }, { id: String(doc.project_id) }]
              });
            }
            if (project) doc.project_name = project.name;
          }
          if (doc.user_id) {
            let usr = null;
            if (mongoose.Types.ObjectId.isValid(doc.user_id)) {
              usr = await UserDoc.findById(doc.user_id);
            } else {
              usr = await UserDoc.findOne({ id: String(doc.user_id) });
            }
            if (!usr) {
              usr = await UserDoc.findOne({
                $or: [{ _id: doc.user_id }, { id: String(doc.user_id) }]
              });
            }
            if (usr) {
              doc.assigned_name = doc.assigned_name || usr.name;
              doc.assigned_email = doc.assigned_email || usr.email;
            }
          }
        }
      } catch (err) {
        console.error('Error in TaskModel.getById:', err.message);
      }
    } else {
      const tasks = db.fallbackStore.getTasks();
      const task = tasks.find(t => String(t.id) === String(id));
      if (task) doc = { ...task };
    }

    if (!doc) return null;

    // Check authorization for regular members
    if (user && user.role === 'MEMBER') {
      const isAssigned = String(doc.user_id) === String(user.id);
      const isCreator = String(doc.created_by) === String(user.id);
      
      let isProjectMember = false;
      if (doc.project_id) {
        const proj = await ProjectModel.getById(doc.project_id, user);
        if (proj && !proj.unauthorized) {
          isProjectMember = true;
        }
      }

      if (!isAssigned && !isCreator && !isProjectMember) {
        return { unauthorized: true };
      }
    }

    return doc;
  }

  static async create({ title, description, status, priority, due_date, dueDate, project_id, projectId, user_id, userId, assigned_name, assigned_email, created_by }) {
    const finalDueDate = due_date || dueDate || null;
    const finalProjectId = project_id !== undefined ? project_id : (projectId !== undefined ? projectId : null);
    const finalUserId = user_id !== undefined ? user_id : (userId !== undefined ? userId : null);
    const finalStatus = status || 'TODO';
    const finalPriority = priority || 'MEDIUM';

    if (db.getIsDbConnected()) {
      try {
        const created = await TaskDoc.create({
          title: title.trim(),
          description: description || '',
          status: finalStatus,
          priority: finalPriority,
          due_date: finalDueDate,
          project_id: finalProjectId,
          user_id: finalUserId,
          assigned_name: assigned_name || null,
          assigned_email: assigned_email || null,
          created_by: created_by || null
        });

        return await this.getById(created.id);
      } catch (err) {
        console.error('Error in TaskModel.create:', err.message);
      }
    }

    const tasks = db.fallbackStore.getTasks();
    const projects = db.fallbackStore.getProjects();
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => Number(t.id) || 0)) + 1 : 1;
    const project = projects.find(p => String(p.id) === String(finalProjectId));

    const newTask = {
      id: newId,
      title: title.trim(),
      description: description || '',
      status: finalStatus,
      priority: finalPriority,
      due_date: finalDueDate,
      project_id: finalProjectId,
      project_name: project ? project.name : null,
      user_id: finalUserId,
      assigned_name: assigned_name || null,
      assigned_email: assigned_email || null,
      created_by: created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    tasks.unshift(newTask);
    db.fallbackStore.setTasks(tasks);
    return newTask;
  }

  static async update(id, updates) {
    if (!id) return null;

    const existing = await this.getById(id);
    if (!existing || existing.unauthorized) return null;

    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const priority = updates.priority !== undefined ? updates.priority : existing.priority;
    const dueDate = updates.due_date !== undefined ? updates.due_date : (updates.dueDate !== undefined ? updates.dueDate : existing.due_date);
    const projectId = updates.project_id !== undefined ? updates.project_id : (updates.projectId !== undefined ? updates.projectId : existing.project_id);
    const userId = updates.user_id !== undefined ? updates.user_id : (updates.userId !== undefined ? updates.userId : existing.user_id);
    const assignedName = updates.assigned_name !== undefined ? updates.assigned_name : existing.assigned_name;
    const assignedEmail = updates.assigned_email !== undefined ? updates.assigned_email : existing.assigned_email;

    if (db.getIsDbConnected()) {
      try {
        const updatePayload = {
          title,
          description,
          status,
          priority,
          due_date: dueDate,
          project_id: projectId,
          user_id: userId,
          assigned_name: assignedName,
          assigned_email: assignedEmail
        };

        if (mongoose.Types.ObjectId.isValid(id)) {
          await TaskDoc.findByIdAndUpdate(id, updatePayload, { new: true });
        } else {
          await TaskDoc.findOneAndUpdate(
            { $or: [{ _id: id }, { id: String(id) }] },
            { id: String(id) },
            updatePayload,
            { new: true }
          );
        }
        return await this.getById(id);
      } catch (err) {
        console.error('Error in TaskModel.update:', err.message);
      }
    }

    const tasks = db.fallbackStore.getTasks();
    const projects = db.fallbackStore.getProjects();
    const project = projects.find(p => String(p.id) === String(projectId));

    const updatedTask = {
      ...existing,
      title,
      description,
      status,
      priority,
      due_date: dueDate,
      project_id: projectId,
      project_name: project ? project.name : null,
      user_id: userId,
      assigned_name: assignedName,
      assigned_email: assignedEmail,
      updated_at: new Date().toISOString()
    };

    const index = tasks.findIndex(t => String(t.id) === String(id));
    if (index !== -1) {
      tasks[index] = updatedTask;
      db.fallbackStore.setTasks(tasks);
    }
    return updatedTask;
  }

  static async delete(id) {
    if (!id) return false;

    if (db.getIsDbConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          await TaskDoc.findByIdAndDelete(id);
        } else {
          await TaskDoc.findOneAndDelete({
            $or: [{ _id: id }, { id: String(id) }]
          });
          await TaskDoc.findOneAndDelete({ id: String(id) });
        }
        return true;
      } catch (err) {
        console.error('Error in TaskModel.delete:', err.message);
      }
    }

    const tasks = db.fallbackStore.getTasks().filter(t => String(t.id) !== String(id));
    db.fallbackStore.setTasks(tasks);
    return true;
  }

  static async getDashboardStats(user = null) {
    const todayStr = new Date().toISOString().split('T')[0];

    // If user is a MEMBER, calculate stats strictly for their accessible tasks
    if (user && user.role === 'MEMBER') {
      const userTasks = await this.getAll({ user, scope: 'my_tasks' });
      const total = userTasks.length;
      const inProgress = userTasks.filter(t => t.status === 'IN_PROGRESS').length;
      const completed = userTasks.filter(t => t.status === 'DONE').length;
      const overdue = userTasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== 'DONE').length;
      const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      const recentTasks = [...userTasks].slice(0, 6);

      return {
        totalTasks: total,
        inProgress,
        completed,
        overdue,
        progressPercentage,
        recentTasks
      };
    }

    // System wide stats for ADMIN
    if (db.getIsDbConnected()) {
      try {
        const [total, inProgress, completed, overdue, recentDocs] = await Promise.all([
          TaskDoc.countDocuments(),
          TaskDoc.countDocuments({ status: 'IN_PROGRESS' }),
          TaskDoc.countDocuments({ status: 'DONE' }),
          TaskDoc.countDocuments({
            due_date: { $lt: todayStr },
            status: { $ne: 'DONE' }
          }),
          TaskDoc.find().sort({ created_at: -1 }).limit(6)
        ]);

        const projectIds = [...new Set(recentDocs.map(t => t.project_id).filter(Boolean))];
        const validObjIds = projectIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        
        const projects = await ProjectDoc.find({
          $or: [
            { _id: { $in: validObjIds } },
            { id: { $in: projectIds } }
          ]
        });

        const projectMap = new Map();
        projects.forEach(p => {
          projectMap.set(p._id.toString(), p.name);
          if (p.id) projectMap.set(String(p.id), p.name);
        });

        const recentTasks = recentDocs.map(t => {
          const doc = t.toJSON();
          return {
            ...doc,
            project_name: doc.project_id ? (projectMap.get(String(doc.project_id)) || null) : null
          };
        });

        const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          totalTasks: total,
          inProgress,
          completed,
          overdue,
          progressPercentage,
          recentTasks
        };
      } catch (err) {
        console.error('Error fetching dashboard stats from MongoDB:', err.message);
      }
    }

    const tasks = db.fallbackStore.getTasks();
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'DONE').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const overdue = tasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== 'DONE').length;
    const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const recentTasks = [...tasks].slice(0, 6);

    return {
      totalTasks: total,
      inProgress,
      completed,
      overdue,
      progressPercentage,
      recentTasks
    };
  }
}

module.exports = TaskModel;