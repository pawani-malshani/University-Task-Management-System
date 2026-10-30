const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initDatabase, getIsDbConnected } = require('./config/db');
const taskRoutes = require('./routes/taskRoutes');
const projectRoutes = require('./routes/projectRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend
app.use(cors({
  origin: '*', // Allow all in local development for smooth pair-programming
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'TaskFlow API Server is running smoothly',
    databaseConnected: getIsDbConnected(),
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 & Global Error Middleware
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Start Server and Initialize Database
async function startServer(customPort = null) {
  await initDatabase();
  const listenPort = customPort !== null ? customPort : (process.env.PORT || 5000);
  
  return new Promise((resolve) => {
    const server = app.listen(listenPort, () => {
      const boundPort = server.address().port;
      console.log(`🚀 TaskFlow Backend running at http://localhost:${boundPort}`);
      console.log(`📡 Health Check: http://localhost:${boundPort}/api/health`);
      console.log(`📋 Tasks API:   http://localhost:${boundPort}/api/tasks`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
