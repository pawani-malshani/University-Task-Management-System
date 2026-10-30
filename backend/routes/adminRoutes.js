const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// All admin routes strictly require valid authentication token + verified ADMIN role
router.use(authenticate, requireAdmin);

// System Overview
router.get('/stats', AdminController.getAdminStats);

// User & Role Management
router.get('/users', AdminController.getAllUsers);
router.patch('/users/:id/role', AdminController.updateUserRole);
router.put('/users/:id/role', AdminController.updateUserRole);
router.patch('/users/:id/status', AdminController.updateUserStatus);
router.delete('/users/:id', AdminController.deleteUser);

// Admin Invitations Flow
router.get('/invitations', AdminController.getInvitations);
router.post('/invitations', AdminController.createInvitation);
router.delete('/invitations/:id', AdminController.deleteInvitation);

// Security & Administrative Audit Logs
router.get('/audit-logs', AdminController.getAuditLogs);

module.exports = router;
