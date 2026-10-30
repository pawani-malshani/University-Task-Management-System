const express = require('express');
const router = express.Router();
const TaskController = require('../controllers/taskController');
const { validateTask } = require('../middleware/validateTask');
const { optionalAuth } = require('../middleware/authMiddleware');

router.use(optionalAuth);

// GET /api/tasks (list, filter, search, sort)
router.get('/', TaskController.getAllTasks);

// GET /api/tasks/:id (single task)
router.get('/:id', TaskController.getTaskById);

// POST /api/tasks (create task with validation)
router.post('/', validateTask, TaskController.createTask);

// PUT & PATCH /api/tasks/:id (update task with validation)
router.put('/:id', validateTask, TaskController.updateTask);
router.patch('/:id', validateTask, TaskController.updateTask);

// DELETE /api/tasks/:id (delete task)
router.delete('/:id', TaskController.deleteTask);

module.exports = router;
