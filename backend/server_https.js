require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const db = require('./database_pg');
const apiSync = require('./utils/apiSync_pg');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employee');
const adminRoutes = require('./routes/admin/index');
const telegramRoutes = require('./routes/telegram');
const newsRoutes = require('./routes/news');
const aiRecommendationsRoutes = require('./routes/ai-recommendations');
const cronRoutes = require('./routes/cron');
const timesheetScheduler = require('./services/timesheet-scheduler');

const app = express();
const PORT = process.env.PORT || 3030;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// Middleware
app.use(cors({
  origin: [
    'https://madlen.space',
    'https://t.me',
    'http://localhost:5555'
  ],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Routes
app.use('/api', authRoutes);
app.use('/api', employeeRoutes);
app.use('/api', adminRoutes);
app.use('/api/admin/ai-recommendations', aiRecommendationsRoutes);
app.use('/api', telegramRoutes);
app.use('/api', newsRoutes);
app.use('/api', cronRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    https: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });
});

// Redirect HTTP to HTTPS in production (handled by nginx in docker setup)

// Start server
async function startServer() {
  // Initialize PostgreSQL database
  try {
    await db.initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }
  
  // Initial sync in production only
  if (process.env.NODE_ENV === 'production') {
    console.log('Starting initial data sync...');
    try {
      await apiSync.syncAllData();
      console.log('Initial data sync completed');
    } catch (error) {
      console.error('Initial sync failed:', error.message);
    }

    // Start CRON scheduler for automatic timesheet loading
    console.log('Starting CRON scheduler for automatic timesheet loading...');
    try {
      timesheetScheduler.startScheduler();
      console.log('CRON scheduler started successfully');
    } catch (error) {
      console.error('Failed to start CRON scheduler:', error.message);
    }
  } else {
    console.log('Development mode: Skipping data sync and CRON scheduler');
  }

  // Start HTTPS server if certificates are available
  if (process.env.NODE_ENV === 'production' && 
      process.env.SSL_CERT_PATH && 
      process.env.SSL_KEY_PATH) {
    
    try {
      const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
      const certificate = fs.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
      
      const credentials = {
        key: privateKey,
        cert: certificate
      };
      
      const httpsServer = https.createServer(credentials, app);
      
      httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`🚀 HTTPS Server running on port ${HTTPS_PORT}`);
        console.log(`📱 Telegram Mini App URL: https://madlen.space/`);
      });
      
      // Also start HTTP server for internal communication
      const httpServer = http.createServer(app);
      httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`🔗 HTTP Server (internal) running on port ${PORT}`);
      });
      
    } catch (error) {
      console.error('Failed to start HTTPS server:', error.message);
      console.log('Falling back to HTTP server...');
      startHttpServer();
    }
  } else {
    startHttpServer();
  }
}

function startHttpServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTP Server running on port ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📋 Test page: http://localhost:5555/test_telegram.html`);
    }
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close().then(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  db.close().then(() => {
    process.exit(0);
  });
});

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});