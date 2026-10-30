const TaskModel = require('../models/taskModel');

class DashboardController {
  static async getStats(req, res, next) {
    try {
      const stats = await TaskModel.getDashboardStats(req.user || null);
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DashboardController;
