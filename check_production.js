const axios = require('axios');

async function checkProductionData() {
  console.log('=== Проверка данных в продакшне ===\n');
  
  const baseUrl = 'https://madlen.space/api';
  const employeeNumber = 'АП00-00231';
  
  try {
    // 1. Проверяем события за конкретные даты
    console.log('1. Проверяем события за 1, 2 и 10 мая 2025:');
    
    const response = await axios.get(`${baseUrl}/admin/time-events`, {
      params: {
        dateFrom: '2025-05-01',
        dateTo: '2025-05-10'
      }
    });
    
    const events = response.data.filter(e => e.employee_number === employeeNumber);
    console.log(`   Найдено ${events.length} событий для сотрудника ${employeeNumber}`);
    
    // Группируем по датам
    const eventsByDate = {};
    events.forEach(event => {
      const date = event.event_datetime.split('T')[0];
      if (!eventsByDate[date]) {
        eventsByDate[date] = [];
      }
      eventsByDate[date].push(event);
    });
    
    // Показываем все события
    console.log('\n   Все найденные события:');
    events.slice(0, 10).forEach(event => {
      const time = new Date(event.event_datetime).toLocaleString('ru-RU', { timeZone: 'UTC' });
      console.log(`     ${time} - тип: ${event.event_type}`);
    });
    
    // Показываем события за интересующие даты
    ['2025-05-01', '2025-05-02', '2025-05-10'].forEach(date => {
      console.log(`\n   Дата ${date}:`);
      if (eventsByDate[date]) {
        eventsByDate[date].sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
        eventsByDate[date].forEach(event => {
          const time = new Date(event.event_datetime).toLocaleString('ru-RU', { timeZone: 'UTC' });
          console.log(`     ${time} - тип: ${event.event_type}`);
        });
      } else {
        console.log('     Нет событий');
      }
    });
    
    // 2. Проверяем time_records
    console.log('\n2. Проверяем обработанные записи времени:');
    
    const recordsResponse = await axios.get(`${baseUrl}/admin/time-records`, {
      params: {
        month: '2025-05'
      }
    });
    
    const records = recordsResponse.data.filter(r => r.employee_number === employeeNumber);
    console.log(`   Найдено ${records.length} записей за май 2025`);
    
    // Показываем записи за интересующие даты
    ['2025-05-01', '2025-05-02', '2025-05-10'].forEach(date => {
      const record = records.find(r => r.date.startsWith(date));
      if (record) {
        console.log(`\n   ${date}:`);
        console.log(`     Вход: ${record.check_in ? new Date(record.check_in).toLocaleTimeString('ru-RU', { timeZone: 'UTC' }) : 'нет'}`);
        console.log(`     Выход: ${record.check_out ? new Date(record.check_out).toLocaleTimeString('ru-RU', { timeZone: 'UTC' }) : 'нет'}`);
        console.log(`     Часов: ${record.hours_worked ? parseFloat(record.hours_worked).toFixed(2) : 'н/д'}`);
        console.log(`     Статус: ${record.status}`);
      }
    });
    
    // 3. Статистика
    const stats = {
      on_time: records.filter(r => r.status === 'on_time').length,
      late: records.filter(r => r.status === 'late').length,
      early_leave: records.filter(r => r.status === 'early_leave').length,
      absent: records.filter(r => r.status === 'absent').length
    };
    
    console.log('\n3. Статистика за май 2025:');
    console.log(`   Вовремя: ${stats.on_time}`);
    console.log(`   Опоздания: ${stats.late}`);
    console.log(`   Ранний уход: ${stats.early_leave}`);
    console.log(`   Отсутствия: ${stats.absent}`);
    
  } catch (error) {
    console.error('Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

checkProductionData();