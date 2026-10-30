const express = require('express');
const router = express.Router();
const ProjectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/authMiddleware');

// All project operations require authentication
router.use(authenticate);

router.get('/', ProjectController.getAllProjects);
router.get('/:id', ProjectController.getProjectById);
router.post('/', ProjectController.createProject);
router.put('/:id', ProjectController.updateProject);
router.patch('/:id', ProjectController.updateProject);

// Project member management endpoints
router.post('/:id/members', ProjectController.addMember);
router.delete('/:id/members/:userId', ProjectController.removeMember);

router.delete('/:id', ProjectController.deleteProject);

module.exports = router;
