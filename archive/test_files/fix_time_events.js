const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  user: 'hr_user',
  host: 'localhost',
  database: 'hr_tracker',
  password: 'hr_secure_password',
  port: 5432,
});

async function fixTimeEvents() {
  try {
    const employeeNumber = 'АП00-00231';
    
    // 1. Получаем данные из API
    console.log('1. Загружаем данные из внешнего API...');
    const response = await axios.get('http://tco.aqnietgroup.com:5555/v1/event/filter', {
      params: {
        tableNumber: employeeNumber,
        dateStart: '2025-05-01',
        dateStop: '2025-05-31',
        objectBIN: '241240023631'
      }
    });
    
    const apiEvents = response.data;
    console.log(`   Получено ${apiEvents.length} событий из API`);
    
    // 2. Получаем текущие данные из БД
    console.log('\n2. Проверяем текущие данные в БД...');
    const dbResult = await pool.query(
      `SELECT * FROM time_events 
       WHERE employee_number = $1 
       AND event_datetime >= '2025-05-01' 
       AND event_datetime <= '2025-05-31'
       ORDER BY event_datetime`,
      [employeeNumber]
    );
    console.log(`   Найдено ${dbResult.rows.length} событий в БД`);
    
    // 3. Очищаем старые данные
    console.log('\n3. Очищаем старые тестовые данные...');
    await pool.query(
      `DELETE FROM time_events 
       WHERE employee_number = $1 
       AND event_datetime >= '2025-05-01' 
       AND event_datetime <= '2025-05-31'`,
      [employeeNumber]
    );
    console.log('   Старые данные удалены');
    
    // 4. Вставляем новые данные из API
    console.log('\n4. Загружаем реальные данные из API...');
    let insertedCount = 0;
    
    for (const event of apiEvents) {
      await pool.query(`
        INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [
        employeeNumber,
        event.object_code,
        event.event_datetime,
        event.event // Обратите внимание: в API поле называется "event", а не "event_type"
      ]);
      insertedCount++;
    }
    
    console.log(`   Вставлено ${insertedCount} событий`);
    
    // 5. Проверяем результат
    console.log('\n5. Проверяем результат...');
    const newDbResult = await pool.query(
      `SELECT event_datetime, event_type, object_code 
       FROM time_events 
       WHERE employee_number = $1 
       AND event_datetime >= '2025-05-01' 
       AND event_datetime <= '2025-05-31'
       ORDER BY event_datetime
       LIMIT 10`,
      [employeeNumber]
    );
    
    console.log('   Первые 10 записей после загрузки:');
    newDbResult.rows.forEach(row => {
      const dt = new Date(row.event_datetime);
      console.log(`   ${dt.toISOString().replace('T', ' ').slice(0, 19)} - тип: ${row.event_type} - код: ${row.object_code}`);
    });
    
    // 6. Пересчитываем time_records
    console.log('\n6. Пересчитываем time_records...');
    await pool.query(
      `DELETE FROM time_records 
       WHERE employee_number = $1 
       AND date >= '2025-05-01' 
       AND date <= '2025-05-31'`,
      [employeeNumber]
    );
    
    // Группируем события по дням
    const groupedEvents = {};
    for (const event of apiEvents) {
      const date = event.event_datetime.split(' ')[0];
      if (!groupedEvents[date]) {
        groupedEvents[date] = [];
      }
      groupedEvents[date].push(event);
    }
    
    let recordsCount = 0;
    for (const [date, dayEvents] of Object.entries(groupedEvents)) {
      // Сортируем события дня по времени
      dayEvents.sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
      
      // Определяем вход и выход
      const entryEvents = dayEvents.filter(e => e.event === '1');
      const exitEvents = dayEvents.filter(e => e.event === '2');
      
      let checkIn = null;
      let checkOut = null;
      
      if (entryEvents.length > 0) {
        checkIn = entryEvents[0].event_datetime;
      }
      if (exitEvents.length > 0) {
        checkOut = exitEvents[exitEvents.length - 1].event_datetime;
      }
      
      // Если нет явных входов/выходов, берем первое и последнее событие
      if (!checkIn && !checkOut && dayEvents.length > 0) {
        checkIn = dayEvents[0].event_datetime;
        if (dayEvents.length > 1) {
          checkOut = dayEvents[dayEvents.length - 1].event_datetime;
        }
      }
      
      // Рассчитываем часы и статус
      let hoursWorked = null;
      let status = 'absent';
      
      if (checkIn && checkOut) {
        const inTime = new Date(checkIn);
        const outTime = new Date(checkOut);
        hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
        
        const inHour = inTime.getHours();
        const inMinute = inTime.getMinutes();
        const outHour = outTime.getHours();
        
        if (inHour < 9 || (inHour === 9 && inMinute === 0)) {
          status = 'on_time';
        } else {
          status = 'late';
        }
        
        if (outHour < 18) {
          status = 'early_leave';
        }
      } else if (checkIn) {
        status = 'no_exit';
      }
      
      // Вставляем запись
      await pool.query(`
        INSERT INTO time_records (employee_number, date, check_in, check_out, hours_worked, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        employeeNumber,
        date,
        checkIn,
        checkOut,
        hoursWorked,
        status
      ]);
      recordsCount++;
    }
    
    console.log(`   Создано ${recordsCount} записей в time_records`);
    
    // 7. Показываем итоговую статистику
    console.log('\n7. Итоговая статистика за май 2025:');
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN status = 'on_time' THEN 1 END) as on_time,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late,
        COUNT(CASE WHEN status = 'early_leave' THEN 1 END) as early_leave,
        COUNT(CASE WHEN status = 'no_exit' THEN 1 END) as no_exit,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
        ROUND(AVG(hours_worked)::numeric, 2) as avg_hours
      FROM time_records
      WHERE employee_number = $1
      AND date >= '2025-05-01'
      AND date <= '2025-05-31'
    `, [employeeNumber]);
    
    const s = stats.rows[0];
    console.log(`   Всего дней: ${s.total_days}`);
    console.log(`   Вовремя: ${s.on_time}`);
    console.log(`   Опоздания: ${s.late}`);
    console.log(`   Ранний уход: ${s.early_leave}`);
    console.log(`   Нет выхода: ${s.no_exit}`);
    console.log(`   Отсутствия: ${s.absent}`);
    console.log(`   Среднее время работы: ${s.avg_hours} часов`);
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем исправление
fixTimeEvents();