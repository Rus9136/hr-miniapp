const axios = require('axios');

async function fixProductionData() {
  console.log('=== Исправление данных через API админ-панели ===\n');
  
  const baseUrl = 'https://madlen.space/HR/api';
  
  try {
    // 1. Загружаем данные через API админ-панели
    console.log('1. Запускаем загрузку данных через API...');
    
    const loadResponse = await axios.post(`${baseUrl}/admin/load/timesheet`, {
      tableNumber: 'АП00-00231',
      dateFrom: '2025-05-01',
      dateTo: '2025-05-31',
      objectBin: '241240023631'
    });
    
    if (loadResponse.data.success) {
      const loadingId = loadResponse.data.loadingId;
      console.log(`   Загрузка начата. ID процесса: ${loadingId}`);
      
      // 2. Отслеживаем прогресс
      console.log('\n2. Отслеживаем прогресс загрузки...');
      
      let completed = false;
      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
        
        const progressResponse = await axios.get(`${baseUrl}/admin/load/progress/${loadingId}`);
        const progress = progressResponse.data;
        
        console.log(`   Статус: ${progress.status} - ${progress.message}`);
        console.log(`   Загружено событий: ${progress.eventsLoaded || 0}`);
        
        if (progress.status === 'completed' || progress.status === 'error') {
          completed = true;
          
          if (progress.status === 'completed') {
            console.log('\n✅ Загрузка завершена успешно!');
            console.log(`   Загружено событий: ${progress.eventsLoaded}`);
            console.log(`   Обработано записей: ${progress.recordsProcessed}`);
            
            // 3. Пересчитываем записи времени
            console.log('\n3. Пересчитываем записи рабочего времени...');
            const recalcResponse = await axios.post(`${baseUrl}/admin/recalculate-time-records`);
            
            if (recalcResponse.data.success) {
              console.log('✅ Пересчет завершен!');
              console.log(`   Обработано записей: ${recalcResponse.data.processedRecords}`);
            }
          } else {
            console.log('\n❌ Ошибка при загрузке:', progress.error);
          }
        }
      }
    } else {
      console.log('❌ Не удалось начать загрузку');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('   Статус:', error.response.status);
      console.error('   Данные:', error.response.data);
    }
  }
}

// Запускаем исправление
fixProductionData();