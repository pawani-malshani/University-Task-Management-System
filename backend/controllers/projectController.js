const ProjectModel = require('../models/projectModel');
const UserModel = require('../models/userModel');

class ProjectController {
  static async getAllProjects(req, res, next) {
    try {
      const user = req.user || null;
      const projects = await ProjectModel.getAll(user);
      return res.status(200).json({
        success: true,
        count: projects.length,
        data: projects
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProjectById(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user || null;
      const project = await ProjectModel.getById(id, user);

      if (!project) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Project with ID ${id} was not found.`,
          timestamp: new Date().toISOString()
        });
      }

      if (project.unauthorized) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'You are not a member of this project.',
          timestamp: new Date().toISOString()
        });
      }

      return res.status(200).json({
        success: true,
        data: project
      });
    } catch (error) {
      next(error);
    }
  }

  static async createProject(req, res, next) {
    try {
      const { name, description, members } = req.body;
      const user = req.user || null;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request',
          message: 'Project name is required',
          timestamp: new Date().toISOString()
        });
      }

      const project = await ProjectModel.create({
        name: name.trim(),
        description: description ? description.trim() : '',
        user_id: user ? user.id : null,
        owner_name: user ? user.name : 'System',
        owner_email: user ? user.email : '',
        members: Array.isArray(members) ? members : []
      });

      return res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProject(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;
      const existing = await ProjectModel.getById(id, user);

      if (!existing) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Project with ID ${id} was not found.`,
          timestamp: new Date().toISOString()
        });
      }

      if (existing.unauthorized) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'You do not have permission to edit this project.',
          timestamp: new Date().toISOString()
        });
      }

      const { name, description, members } = req.body;
      const updates = {};
      if (name !== undefined && name.trim() !== '') updates.name = name.trim();
      if (description !== undefined) updates.description = description.trim();
      if (members !== undefined && Array.isArray(members)) updates.members = members;

      const updated = await ProjectModel.update(id, updates);

      return res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async addMember(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;
      const project = await ProjectModel.getById(id, user);

      if (!project) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Project with ID ${id} was not found.`
        });
      }

      if (project.unauthorized) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'You do not have access to this project.'
        });
      }

      // Privacy & Authority: Only project owner or admin can invite collaborators
      const isOwner = String(project.user_id) === String(user.id);
      const isAdmin = user.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'Only the project owner or an administrator can invite members to this project.'
        });
      }

      const { email, role } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request',
          message: 'A valid email address is required to invite a collaborator.'
        });
      }

      const cleanEmail = email.toLowerCase().trim();

      // Find user strictly by email (no public user directory exposed)
      const targetUser = await UserModel.findByEmail(cleanEmail);
      if (!targetUser) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `No registered account found with email "${cleanEmail}". Please have them register first.`
        });
      }

      if (targetUser.is_active === false) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request',
          message: `Account "${cleanEmail}" is currently suspended or inactive.`
        });
      }

      // Check if already a collaborator
      const currentMembers = Array.isArray(project.members) ? project.members : [];
      const alreadyInProject = currentMembers.some(
        m => String(m.user_id || m.id) === String(targetUser.id) || (m.email && m.email.toLowerCase() === cleanEmail)
      );

      if (alreadyInProject) {
        return res.status(409).json({
          status: 409,
          error: 'Conflict',
          message: `"${targetUser.name}" (${cleanEmail}) is already a collaborator on this project.`
        });
      }

      const memberToAdd = {
        user_id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: role || 'MEMBER'
      };

      const updatedProject = await ProjectModel.addMember(id, memberToAdd);

      return res.status(200).json({
        success: true,
        message: `Collaborator ${targetUser.name} (${cleanEmail}) added to project successfully!`,
        data: updatedProject
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeMember(req, res, next) {
    try {
      const { id, userId } = req.params;
      const user = req.user;
      const project = await ProjectModel.getById(id, user);

      if (!project) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Project with ID ${id} was not found.`
        });
      }

      if (project.unauthorized) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'You do not have permission to manage members of this project.'
        });
      }

      // Safeguard: regular members can only remove themselves or if they are the owner
      const isOwner = String(project.user_id) === String(user.id);
      const isAdmin = user.role === 'ADMIN';
      const isSelf = String(userId) === String(user.id);

      if (!isOwner && !isAdmin && !isSelf) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'Only the project owner or administrator can remove members.'
        });
      }

      const updated = await ProjectModel.removeMember(id, userId);

      return res.status(200).json({
        success: true,
        message: 'Member removed from project successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProject(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;
      const project = await ProjectModel.getById(id, user);

      if (!project) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Project with ID ${id} was not found.`
        });
      }

      if (project.unauthorized) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'You do not have access to this project.'
        });
      }

      // Only owner or admin can delete project
      const isOwner = String(project.user_id) === String(user?.id);
      const isAdmin = user?.role === 'ADMIN';

      if (user && !isOwner && !isAdmin) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'Only the project owner or administrator can delete this project.'
        });
      }

      const deleted = await ProjectModel.delete(id);
      if (!deleted) {
        return res.status(404).json({
          status: 404,
          error: 'Not Found',
          message: `Project with ID ${id} was not found.`
        });
      }

      return res.status(200).json({
        success: true,
        message: `Project ${id} and associated tasks deleted successfully`
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProjectController;