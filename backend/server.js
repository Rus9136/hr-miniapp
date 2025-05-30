require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const db = require('./database');
const apiSync = require('./utils/apiSync');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employee');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api', authRoutes);
app.use('/api', employeeRoutes);
app.use('/api', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initial sync with external API
  console.log('Starting initial data sync...');
  try {
    await apiSync.syncAllData();
    console.log('Initial data sync completed');
  } catch (error) {
    console.error('Initial sync failed:', error.message);
  }
});