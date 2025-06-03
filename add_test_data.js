const db = require('./backend/database_pg');

async function addTestData() {
  try {
    console.log('Adding test data for АП00-00358...');
    
    // Add time events for May 2025
    const events = [
      { date: '2025-05-01', type: '1', time: '08:45:00' },  // Entry
      { date: '2025-05-01', type: '2', time: '18:15:00' },  // Exit
      { date: '2025-05-02', type: '1', time: '09:15:00' },  // Late entry
      { date: '2025-05-02', type: '2', time: '18:00:00' },  // Exit
      { date: '2025-05-03', type: '1', time: '08:30:00' },  // Early entry
      { date: '2025-05-03', type: '2', time: '17:30:00' },  // Early exit
      { date: '2025-05-06', type: '1', time: '09:00:00' },  // On time
      { date: '2025-05-06', type: '2', time: '18:00:00' },  // On time exit
      { date: '2025-05-07', type: '1', time: '08:55:00' },  // On time
      { date: '2025-05-07', type: '2', time: '18:10:00' },  // Exit
    ];
    
    for (const event of events) {
      const datetime = `${event.date} ${event.time}`;
      await db.query(
        `INSERT INTO time_events (employee_number, event_datetime, event_type, object_code)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        ['АП00-00358', datetime, event.type, 'АП000049']
      );
    }
    
    // Add time records (processed data)
    const records = [
      {
        date: '2025-05-01',
        check_in: '2025-05-01 08:45:00',
        check_out: '2025-05-01 18:15:00',
        hours_worked: 9.5,
        status: 'on_time'
      },
      {
        date: '2025-05-02',
        check_in: '2025-05-02 09:15:00',
        check_out: '2025-05-02 18:00:00',
        hours_worked: 8.75,
        status: 'late'
      },
      {
        date: '2025-05-03',
        check_in: '2025-05-03 08:30:00',
        check_out: '2025-05-03 17:30:00',
        hours_worked: 9.0,
        status: 'early_leave'
      },
      {
        date: '2025-05-06',
        check_in: '2025-05-06 09:00:00',
        check_out: '2025-05-06 18:00:00',
        hours_worked: 9.0,
        status: 'on_time'
      },
      {
        date: '2025-05-07',
        check_in: '2025-05-07 08:55:00',
        check_out: '2025-05-07 18:10:00',
        hours_worked: 9.25,
        status: 'on_time'
      }
    ];
    
    for (const record of records) {
      await db.query(
        `INSERT INTO time_records (employee_number, date, check_in, check_out, hours_worked, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (employee_number, date) DO UPDATE SET
         check_in = EXCLUDED.check_in,
         check_out = EXCLUDED.check_out,
         hours_worked = EXCLUDED.hours_worked,
         status = EXCLUDED.status`,
        [
          'АП00-00358',
          record.date,
          record.check_in,
          record.check_out,
          record.hours_worked,
          record.status
        ]
      );
    }
    
    console.log('✅ Test data added successfully!');
    console.log(`Added ${events.length} time events and ${records.length} time records`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding test data:', error);
    process.exit(1);
  }
}

addTestData();