// Migration script to add work_schedules_1c table to production database
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Use production database configuration
const { Pool } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',  // Docker exposed on localhost
  port: process.env.DB_PORT || 5433,         // Docker exposed port
  database: process.env.DB_NAME || 'hr_tracker',
  user: process.env.DB_USER || 'hr_user',
  password: process.env.DB_PASSWORD || 'hr_secure_password',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  options: '-c timezone=Asia/Almaty'
};

const pool = new Pool(dbConfig);

async function runMigration() {
  let client;
  try {
    console.log('🔌 Connecting to database...');
    console.log('📊 Database config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user
    });

    client = await pool.connect();
    console.log('✅ Connected to database successfully');

    // Set timezone
    await client.query("SET TIME ZONE 'Asia/Almaty'");
    console.log('🕐 Timezone set to Asia/Almaty');

    // Check if table already exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'work_schedules_1c'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log('ℹ️ Table work_schedules_1c already exists, skipping creation');
      
      // Show current table info
      const tableInfo = await client.query(`
        SELECT 
          COUNT(*) as record_count,
          COUNT(DISTINCT schedule_code) as unique_schedules,
          MIN(work_date) as earliest_date,
          MAX(work_date) as latest_date
        FROM work_schedules_1c
      `);
      
      console.log('📊 Current table statistics:', tableInfo.rows[0]);
    } else {
      console.log('🔨 Creating work_schedules_1c table...');

      // Read and execute migration
      const migrationPath = path.join(__dirname, 'migrations', '004_work_schedules_1c.sql');
      
      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log('📄 Loaded migration from:', migrationPath);

      await client.query(migrationSQL);
      console.log('✅ Migration executed successfully');

      // Verify table creation
      const verify = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'work_schedules_1c' 
        ORDER BY ordinal_position
      `);

      console.log('📋 Created table structure:');
      verify.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    // Test a simple insert and delete to verify functionality
    console.log('🧪 Testing table functionality...');
    
    const testScheduleCode = 'TEST-' + Date.now();
    await client.query(`
      INSERT INTO work_schedules_1c 
      (schedule_name, schedule_code, work_date, work_month, time_type, work_hours)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'Test Schedule',
      testScheduleCode,
      '2025-06-04',
      '2025-06-01',
      'Test Time Type',
      8
    ]);

    console.log('✅ Test insert successful');

    const testResult = await client.query(`
      SELECT * FROM work_schedules_1c WHERE schedule_code = $1
    `, [testScheduleCode]);

    console.log('✅ Test select successful:', testResult.rows[0]);

    await client.query(`
      DELETE FROM work_schedules_1c WHERE schedule_code = $1
    `, [testScheduleCode]);

    console.log('✅ Test delete successful');

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Ready for 1C integration:');
    console.log('   POST /api/admin/schedules/import-1c');
    console.log('   GET  /api/admin/schedules/1c');
    console.log('   GET  /api/admin/schedules/1c/list');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

// Run migration if this script is called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = runMigration;