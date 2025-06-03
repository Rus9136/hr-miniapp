const db = require('./backend/database_pg');

async function checkData() {
  try {
    console.log('Checking database for АП00-00358...');
    
    // Check time_records
    const records = await db.queryRows(
      'SELECT * FROM time_records WHERE employee_number = $1 ORDER BY date',
      ['АП00-00358']
    );
    
    console.log('\n=== TIME RECORDS ===');
    console.log(`Found ${records.length} records:`);
    records.forEach(record => {
      console.log(`${record.date} | ${record.status} | In: ${record.check_in} | Out: ${record.check_out}`);
    });
    
    // Check time_events
    const events = await db.queryRows(
      'SELECT * FROM time_events WHERE employee_number = $1 ORDER BY event_datetime',
      ['АП00-00358']
    );
    
    console.log('\n=== TIME EVENTS ===');
    console.log(`Found ${events.length} events:`);
    events.forEach(event => {
      console.log(`${event.event_datetime} | Type: ${event.event_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking data:', error);
    process.exit(1);
  }
}

checkData();