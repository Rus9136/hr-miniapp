#!/usr/bin/env node

/**
 * Production Table Cleaner
 * Clears time_events and time_records tables in production
 * 
 * Usage: node clear_production_tables.js
 */

const { Pool } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hr_tracker',
  user: process.env.DB_USER || 'hr_user',
  password: process.env.DB_PASSWORD || 'hr_secure_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(dbConfig);

async function clearProductionTables() {
  console.log('🌐 PRODUCTION TABLE CLEANER');
  console.log('===========================');
  console.log('⚠️  WARNING: This will permanently delete ALL records from:');
  console.log('   - time_events table');
  console.log('   - time_records table');
  console.log('');

  const client = await pool.connect();
  try {
    console.log('🔌 Connected to database:', dbConfig.database);
    console.log('🏠 Host:', dbConfig.host);
    console.log('');

    // Check current record counts
    console.log('📊 Current record counts:');
    const eventsCountBefore = await client.query('SELECT COUNT(*) FROM time_events');
    const recordsCountBefore = await client.query('SELECT COUNT(*) FROM time_records');
    console.log(`   time_events:  ${eventsCountBefore.rows[0].count} records`);
    console.log(`   time_records: ${recordsCountBefore.rows[0].count} records`);
    console.log('');

    if (eventsCountBefore.rows[0].count === '0' && recordsCountBefore.rows[0].count === '0') {
      console.log('ℹ️  Tables are already empty. Nothing to clear.');
      return;
    }

    // Clear time_events table
    console.log('🗑️  Clearing time_events table...');
    const eventsResult = await client.query('DELETE FROM time_events');
    console.log(`✅ Deleted ${eventsResult.rowCount} records from time_events`);

    // Clear time_records table
    console.log('🗑️  Clearing time_records table...');
    const recordsResult = await client.query('DELETE FROM time_records');
    console.log(`✅ Deleted ${recordsResult.rowCount} records from time_records`);

    // Verify tables are empty
    console.log('');
    console.log('📊 Verification - Records remaining:');
    const eventsCountAfter = await client.query('SELECT COUNT(*) FROM time_events');
    const recordsCountAfter = await client.query('SELECT COUNT(*) FROM time_records');
    console.log(`   time_events:  ${eventsCountAfter.rows[0].count} records`);
    console.log(`   time_records: ${recordsCountAfter.rows[0].count} records`);
    console.log('');

    if (eventsCountAfter.rows[0].count === '0' && recordsCountAfter.rows[0].count === '0') {
      console.log('🎉 SUCCESS: Both tables are now empty!');
      console.log('');
      console.log('Summary:');
      console.log(`   ✅ time_events: ${eventsResult.rowCount} records deleted`);
      console.log(`   ✅ time_records: ${recordsResult.rowCount} records deleted`);
    } else {
      console.log('⚠️  WARNING: Some records may still remain');
    }

  } catch (error) {
    console.error('❌ Error clearing tables:', error.message);
    console.error('Full error details:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

// Handle cleanup on process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Process interrupted. Closing database connection...');
  pool.end();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  pool.end();
  process.exit(1);
});

// Run the cleaner
clearProductionTables()
  .then(() => {
    console.log('✅ Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  });