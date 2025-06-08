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
const newsRoutes = require('./routes/news');

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
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow Telegram and our own domain
    const allowedOrigins = [
      'https://web.telegram.org',
      'https://madlen.space',
      'http://localhost:5555',
      'http://localhost:3030'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api', newsRoutes);

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