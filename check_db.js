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
    
    // Check news table
    const news = await db.queryRows(
      'SELECT id, title, author, created_at FROM news ORDER BY created_at DESC LIMIT 10'
    );
    
    console.log('\n=== NEWS TABLE ===');
    console.log(`Found ${news.length} news items:`);
    if (news.length === 0) {
      console.log('❌ No news found in database!');
    } else {
      news.forEach(newsItem => {
        console.log(`${newsItem.id} | ${newsItem.title} | ${newsItem.author} | ${newsItem.created_at}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking data:', error);
    process.exit(1);
  }
}

checkData();