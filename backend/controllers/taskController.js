const TaskModel = require('../models/taskModel');
const ProjectModel = require('../models/projectModel');
const UserModel = require('../models/userModel');

class TaskController {
  static async getAllTasks(req, res, next) {
    try {
      const { search, status, priority, projectId, project_id, sort, order, scope } = req.query;
      const user = req.user || null;

      // Determine default scope:
      // If user is ADMIN -> default 'all_shared'
      // If user is MEMBER -> default 'my_tasks' (User can only view their tasks!)
      const defaultScope = (user && user.role === 'ADMIN') ? 'all_shared' : 'my_tasks';
      const activeScope = scope || defaultScope;

      const tasks = await TaskModel.getAll({
        search,
        status,
        priority,
        projectId: projectId || project_id,
        sort,
        order,
        user,
        scope: activeScope
      });

      return res.status(200).json({
        success: true,
        count: tasks.length,
        scope: activeScope,
        data: tasks
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTaskById(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user || null;
      const task = await TaskModel.getById(id, user);

      if (!task) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Task with ID ${id} was not found.`,
          timestamp: new Date().toISOString()
        });
      }

      if (task.unauthorized) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'You do not have permission to view this task.',
          timestamp: new Date().toISOString()
        });
      }

      return res.status(200).json({
        success: true,
        data: task
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTask(req, res, next) {
    try {
      const user = req.user || null;
      const { project_id, projectId, user_id, userId, ...rest } = req.body;
      const finalProjectId = project_id !== undefined ? project_id : (projectId !== undefined ? projectId : null);

      // Verify project membership if user is MEMBER
      let targetProject = null;
      if (finalProjectId && user && user.role === 'MEMBER') {
        targetProject = await ProjectModel.getById(finalProjectId, user);
        if (!targetProject || targetProject.unauthorized) {
          return res.status(403).json({
            status: 403,
            error: 'Forbidden',
            message: 'You are not a member of the selected project.',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Determine assignee
      let targetUserId = user_id !== undefined ? user_id : (userId !== undefined ? userId : null);
      if (!targetUserId && user) {
        targetUserId = user.id;
      }

      // ASSIGNMENT PROTECTION POLICIES
      if (user && user.role === 'MEMBER') {
        // Policy 1: Standalone tasks (without a project) can ONLY be assigned to oneself
        if (!finalProjectId && targetUserId && String(targetUserId) !== String(user.id)) {
          return res.status(403).json({
            status: 403,
            error: 'Forbidden',
            message: 'Standalone tasks cannot be assigned to other users. You can only assign standalone tasks to yourself, or add the task to a shared project.',
            timestamp: new Date().toISOString()
          });
        }

        // Policy 2: Tasks in a project can ONLY be assigned to confirmed members of that project
        if (finalProjectId && targetUserId && String(targetUserId) !== String(user.id)) {
          const isMember = ProjectModel.isUserIdMemberOfProject(targetProject, targetUserId);
          if (!isMember) {
            return res.status(400).json({
              status: 400,
              error: 'Bad Request',
              message: 'Cannot assign task to a user who is not a member of this project.',
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Fetch assignee info for display
      let assignedName = null;
      let assignedEmail = null;
      if (targetUserId) {
        const assignedUser = await UserModel.findById(targetUserId);
        if (assignedUser) {
          if (assignedUser.is_active === false) {
            return res.status(400).json({
              status: 400,
              error: 'Bad Request',
              message: 'Cannot assign task to an inactive or suspended user account.',
              timestamp: new Date().toISOString()
            });
          }
          assignedName = assignedUser.name;
          assignedEmail = assignedUser.email;
        } else if (user && String(user.id) === String(targetUserId)) {
          assignedName = user.name;
          assignedEmail = user.email;
        }
      }

      const newTask = await TaskModel.create({
        ...rest,
        project_id: finalProjectId,
        user_id: targetUserId,
        assigned_name: assignedName,
        assigned_email: assignedEmail,
        created_by: user ? user.id : null
      });

      return res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: newTask
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateTask(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user || null;
      const existing = await TaskModel.getById(id, user);

      if (!existing) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Task with ID ${id} was not found.`,
          timestamp: new Date().toISOString()
        });
      }

      if (existing.unauthorized) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'You do not have permission to update this task.',
          timestamp: new Date().toISOString()
        });
      }

      const updates = { ...req.body };

      // If reassigning user_id, resolve assigned_name & validate assignment protections
      if (updates.user_id !== undefined || updates.userId !== undefined) {
        const targetUserId = updates.user_id !== undefined ? updates.user_id : updates.userId;
        const targetProjectId = updates.project_id !== undefined ? updates.project_id : (updates.projectId !== undefined ? updates.projectId : existing.project_id);

        if (user && user.role === 'MEMBER') {
          // Rule 1: Cannot assign standalone task to someone else
          if (!targetProjectId && targetUserId && String(targetUserId) !== String(user.id)) {
            return res.status(403).json({
              status: 403,
              error: 'Forbidden',
              message: 'Standalone tasks without a project cannot be assigned to other users.',
              timestamp: new Date().toISOString()
            });
          }

          // Rule 2: Cannot assign project task to non-member
          if (targetProjectId && targetUserId && String(targetUserId) !== String(user.id)) {
            const project = await ProjectModel.getById(targetProjectId, user);
            const isMember = ProjectModel.isUserIdMemberOfProject(project, targetUserId);
            if (!isMember) {
              return res.status(400).json({
                status: 400,
                error: 'Bad Request',
                message: 'Cannot assign task to a user who is not a member of this project.',
                timestamp: new Date().toISOString()
              });
            }
          }
        }

        if (targetUserId) {
          const assignedUser = await UserModel.findById(targetUserId);
          if (assignedUser) {
            if (assignedUser.is_active === false) {
              return res.status(400).json({
                status: 400,
                error: 'Bad Request',
                message: 'Cannot assign task to an inactive or suspended user account.',
                timestamp: new Date().toISOString()
              });
            }
            updates.assigned_name = assignedUser.name;
            updates.assigned_email = assignedUser.email;
          }
        } else {
          updates.assigned_name = null;
          updates.assigned_email = null;
        }
      }

      const updatedTask = await TaskModel.update(id, updates);

      return res.status(200).json({
        success: true,
        message: 'Task updated successfully',
        data: updatedTask
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTask(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user || null;
      const existing = await TaskModel.getById(id, user);

      if (!existing) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Task with ID ${id} was not found.`,
          timestamp: new Date().toISOString()
        });
      }

      if (existing.unauthorized) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'You do not have permission to delete this task.',
          timestamp: new Date().toISOString()
        });
      }

      const deleted = await TaskModel.delete(id);
      if (!deleted) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Task with ID ${id} was not found.`,
          timestamp: new Date().toISOString()
        });
      }

      return res.status(200).json({
        success: true,
        message: `Task ${id} deleted successfully`
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TaskController;
