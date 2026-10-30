const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/accept-invite', AuthController.acceptInvite);

// Protected user routes
router.get('/me', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, AuthController.updateProfile);
router.put('/change-password', authenticate, AuthController.updatePassword);

// Team members discovery endpoint for collaborator and assignee selection
router.get('/users', authenticate, AuthController.getTeamUsers);

module.exports = router;
