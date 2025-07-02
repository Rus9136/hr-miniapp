const { Pool } = require('pg');
const pool = new Pool({
  user: 'hr_user',
  host: 'localhost',
  database: 'hr_tracker',
  password: 'hr_secure_password',
  port: 5432,
});

async function checkDates() {
  try {
    // Проверяем несколько конкретных дат
    const dates = ['2025-05-01', '2025-05-02', '2025-05-10'];
    
    for (const date of dates) {
      console.log('\n=== Дата:', date, '===');
      
      // События из time_events
      const events = await pool.query(
        `SELECT event_datetime, event_type 
         FROM time_events 
         WHERE employee_number = $1 
         AND DATE(event_datetime) = $2 
         ORDER BY event_datetime`,
        ['АП00-00231', date]
      );
      
      console.log('События в time_events:');
      events.rows.forEach(e => {
        console.log('  ', e.event_datetime.toISOString().replace('T', ' ').slice(0, 19), '- тип:', e.event_type);
      });
      
      // Запись в time_records
      const record = await pool.query(
        `SELECT check_in, check_out, hours_worked, status 
         FROM time_records 
         WHERE employee_number = $1 
         AND date = $2`,
        ['АП00-00231', date]
      );
      
      if (record.rows.length > 0) {
        const r = record.rows[0];
        console.log('\nЗапись в time_records:');
        console.log('  Вход:', r.check_in ? new Date(r.check_in).toISOString().replace('T', ' ').slice(0, 19) : 'нет');
        console.log('  Выход:', r.check_out ? new Date(r.check_out).toISOString().replace('T', ' ').slice(0, 19) : 'нет');
        console.log('  Часов:', r.hours_worked ? Number(r.hours_worked).toFixed(2) : 'н/д');
        console.log('  Статус:', r.status);
      }
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
  } finally {
    pool.end();
  }
}

checkDates();