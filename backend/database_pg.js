const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hr_tracker',
  user: process.env.DB_USER || 'hr_user',
  password: process.env.DB_PASSWORD || 'hr_secure_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  options: '-c timezone=Asia/Almaty'
};

const pool = new Pool(dbConfig);

// Set timezone for all connections
pool.on('connect', async (client) => {
  try {
    await client.query("SET timezone = 'Asia/Almaty'");
    console.log('Timezone set to Asia/Almaty for new connection');
  } catch (err) {
    console.error('Error setting timezone:', err);
  }
});

// Create database schema
async function initializeDatabase() {
  try {
    // Set timezone for this connection
    await pool.query("SET TIME ZONE 'Asia/Almaty'");
    console.log('Database timezone set to Asia/Almaty');
    
    await pool.query('BEGIN');

    // Users table (for admin authentication)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_user_id BIGINT UNIQUE,
        employee_number TEXT UNIQUE,
        role TEXT DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Departments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        object_code TEXT UNIQUE NOT NULL,
        object_name TEXT NOT NULL,
        object_parent TEXT,
        object_company TEXT,
        object_bin TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Positions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        staff_position_code TEXT UNIQUE NOT NULL,
        staff_position_name TEXT NOT NULL,
        object_bin TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employees table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        object_code TEXT,
        staff_position_code TEXT,
        table_number TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        status INTEGER DEFAULT 1,
        object_bin TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Time events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS time_events (
        id SERIAL PRIMARY KEY,
        employee_number TEXT NOT NULL,
        object_code TEXT,
        event_datetime TIMESTAMP NOT NULL,
        event_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Time records table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS time_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        employee_number TEXT NOT NULL,
        date DATE NOT NULL,
        check_in TIMESTAMP,
        check_out TIMESTAMP,
        hours_worked DECIMAL(4,2),
        status TEXT,
        off_schedule BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_number, date)
      )
    `);

    // Work schedules table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_schedules (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        date DATE,
        start_time TIME DEFAULT '09:00',
        end_time TIME DEFAULT '18:00',
        is_day_off BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Work schedules from 1C table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_schedules_1c (
        id SERIAL PRIMARY KEY,
        schedule_name VARCHAR(255) NOT NULL,
        schedule_code VARCHAR(255) NOT NULL,
        work_date DATE NOT NULL,
        work_month DATE NOT NULL,
        time_type VARCHAR(100) NOT NULL,
        work_hours INTEGER NOT NULL,
        work_start_time TIME,
        work_end_time TIME,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_schedule_date UNIQUE(schedule_code, work_date)
      )
    `);

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_time_events_employee_date 
      ON time_events(employee_number, event_datetime)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_number 
      ON employees(table_number)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_time_records_employee_date 
      ON time_records(employee_number, date)
    `);

    // Indexes for work_schedules_1c table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_work_schedules_1c_code 
      ON work_schedules_1c(schedule_code)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_work_schedules_1c_date 
      ON work_schedules_1c(work_date)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_work_schedules_1c_month 
      ON work_schedules_1c(work_month)
    `);

    // Employee schedule assignments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_schedule_assignments (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        employee_number VARCHAR(255) NOT NULL,
        schedule_code VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        assigned_by VARCHAR(255) DEFAULT '1C',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for employee_schedule_assignments
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_employee 
      ON employee_schedule_assignments(employee_number)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_schedule 
      ON employee_schedule_assignments(schedule_code)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_dates 
      ON employee_schedule_assignments(start_date, end_date)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_active 
      ON employee_schedule_assignments(employee_number, end_date) 
      WHERE end_date IS NULL
    `);

    // Insert admin user if not exists
    await pool.query(`
      INSERT INTO users (employee_number, role) 
      VALUES ('admin12qw', 'admin')
      ON CONFLICT (employee_number) DO NOTHING
    `);

    await pool.query('COMMIT');
    console.log('✅ PostgreSQL database initialized successfully');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Helper function to execute queries
function query(text, params) {
  return pool.query(text, params);
}

// Helper function for single row queries
async function queryRow(text, params) {
  const result = await pool.query(text, params);
  return result.rows[0];
}

// Helper function for multiple row queries
async function queryRows(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

// Close database connection
async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  queryRow,
  queryRows,
  close,
  initializeDatabase
};