const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.use(optionalAuth);

router.get('/stats', DashboardController.getStats);

module.exports = router;
