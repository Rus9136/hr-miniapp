require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const db = require('./database_pg');
const apiSync = require('./utils/apiSync_pg');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employee');
const adminRoutes = require('./routes/admin');
const telegramRoutes = require('./routes/telegram');

const app = express();
const PORT = process.env.PORT || 3030;

// Security headers middleware
app.use((req, res, next) => {
  // CSP for main pages (not API)
  if (!req.path.startsWith('/api/')) {
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://telegram.org; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "connect-src 'self' https://api.telegram.org; " +
      "img-src 'self' data: https:;"
    );
  }
  next();
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve main page FIRST
app.get('/', (req, res) => {
  console.log('Serving index.html from:', path.join(__dirname, '..', 'index.html'));
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Serve static files 
app.use(express.static(path.join(__dirname, '..')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// API Routes
app.use('/api', authRoutes);
app.use('/api', employeeRoutes);
app.use('/api', adminRoutes);
app.use('/api', telegramRoutes);

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize PostgreSQL database
  try {
    await db.initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }
  
  // Skip initial sync for faster startup in development
  if (process.env.NODE_ENV === 'production') {
    console.log('Starting initial data sync...');
    try {
      await apiSync.syncAllData();
      console.log('Initial data sync completed');
    } catch (error) {
      console.error('Initial sync failed:', error.message);
    }
  } else {
    console.log('Development mode: Skipping data sync');
  }
});