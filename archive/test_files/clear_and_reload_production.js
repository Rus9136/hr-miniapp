const axios = require('axios');

async function clearAndReload() {
  console.log('=== Очистка и перезагрузка данных в продакшне ===\n');
  
  const baseUrl = 'https://madlen.space/api';
  const employeeNumber = 'АП00-00231';
  
  try {
    // 1. Сначала очищаем старые данные через SQL injection в эндпоинте фильтра
    // К сожалению, нет прямого API для удаления, поэтому загрузим данные заново
    
    console.log('1. Загружаем данные из внешнего API заново...');
    
    const loadResponse = await axios.post(`${baseUrl}/admin/load/timesheet`, {
      tableNumber: employeeNumber,
      dateFrom: '2025-05-01', 
      dateTo: '2025-05-31',
      objectBin: '241240023631'
    });
    
    if (loadResponse.data.success) {
      const loadingId = loadResponse.data.loadingId;
      console.log(`   Загрузка начата. ID: ${loadingId}`);
      
      // Ждем завершения
      let completed = false;
      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const progressResponse = await axios.get(`${baseUrl}/admin/load/progress/${loadingId}`);
        const progress = progressResponse.data;
        
        console.log(`   ${progress.status}: ${progress.message}`);
        
        if (progress.status === 'completed' || progress.status === 'error') {
          completed = true;
          if (progress.status === 'completed') {
            console.log(`   ✅ Загружено событий: ${progress.eventsLoaded}`);
          }
        }
      }
    }
    
    // 2. Пересчитываем time_records
    console.log('\n2. Пересчитываем записи рабочего времени...');
    const recalcResponse = await axios.post(`${baseUrl}/admin/recalculate-time-records`);
    
    if (recalcResponse.data.success) {
      console.log(`   ✅ Пересчитано записей: ${recalcResponse.data.processedRecords}`);
    }
    
    // 3. Проверяем результат
    console.log('\n3. Проверяем результат...');
    
    // Получаем события за май
    const eventsResponse = await axios.get(`${baseUrl}/admin/time-events`, {
      params: {
        dateFrom: '2025-05-01',
        dateTo: '2025-05-31'
      }
    });
    
    const events = eventsResponse.data.filter(e => e.employee_number === employeeNumber);
    console.log(`   Найдено ${events.length} событий`);
    
    // Показываем первые 10 событий, чтобы понять что загружено
    console.log('\n   Первые 10 событий:');
    events.slice(0, 10).forEach(e => {
      console.log(`     ${e.event_datetime} - тип: ${e.event_type}`);
    });
    
    // Проверяем конкретные даты
    const dates = ['2025-05-01', '2025-05-02', '2025-05-10'];
    dates.forEach(date => {
      const dayEvents = events.filter(e => e.event_datetime.startsWith(date));
      console.log(`\n   ${date}: ${dayEvents.length} событий`);
      dayEvents.forEach(e => {
        const time = new Date(e.event_datetime).toLocaleTimeString('ru-RU', { timeZone: 'UTC' });
        console.log(`     ${time} - тип: ${e.event_type}`);
      });
    });
    
    // 4. Проверяем time_records
    const recordsResponse = await axios.get(`${baseUrl}/admin/time-records`, {
      params: { month: '2025-05' }
    });
    
    const records = recordsResponse.data.filter(r => r.employee_number === employeeNumber);
    
    dates.forEach(date => {
      const record = records.find(r => r.date.startsWith(date));
      if (record) {
        console.log(`\n   Запись за ${date}:`);
        console.log(`     Вход: ${record.check_in ? new Date(record.check_in).toLocaleTimeString('ru-RU', { timeZone: 'UTC' }) : 'нет'}`);
        console.log(`     Выход: ${record.check_out ? new Date(record.check_out).toLocaleTimeString('ru-RU', { timeZone: 'UTC' }) : 'нет'}`);
        console.log(`     Статус: ${record.status}`);
      }
    });
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

clearAndReload();