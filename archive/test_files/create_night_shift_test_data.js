const { pool, queryRows, queryRow, query } = require('./backend/database_pg');

async function createNightShiftTestData() {
  try {
    console.log('=== СОЗДАНИЕ ТЕСТОВЫХ ДАННЫХ ДЛЯ НОЧНЫХ СМЕН ===\n');

    // 1. Добавляем колонки времени в work_schedules_1c
    console.log('1. ОБНОВЛЕНИЕ СТРУКТУРЫ ТАБЛИЦЫ work_schedules_1c');
    console.log('=' .repeat(60));
    
    try {
      await query(`
        ALTER TABLE work_schedules_1c 
        ADD COLUMN IF NOT EXISTS work_start_time TIME,
        ADD COLUMN IF NOT EXISTS work_end_time TIME
      `);
      console.log('✅ Колонки work_start_time и work_end_time добавлены');
    } catch (error) {
      console.log('⚠️  Колонки уже существуют:', error.message);
    }

    // 2. Парсим время из названий существующих графиков
    console.log('\n2. ПАРСИНГ ВРЕМЕНИ ИЗ НАЗВАНИЙ ГРАФИКОВ');
    console.log('=' .repeat(60));
    
    const existingSchedules = await queryRows(`
      SELECT DISTINCT schedule_code, schedule_name, work_hours
      FROM work_schedules_1c 
      ORDER BY schedule_name
    `);
    
    for (const schedule of existingSchedules) {
      const name = schedule.schedule_name;
      let startTime = null;
      let endTime = null;
      
      // Ищем паттерн времени в названии (например "05:00-17:00")
      const timePattern = /(\d{2}:\d{2})-(\d{2}:\d{2})/;
      const match = name.match(timePattern);
      
      if (match) {
        startTime = match[1];
        endTime = match[2];
        
        await query(`
          UPDATE work_schedules_1c 
          SET work_start_time = $1, work_end_time = $2
          WHERE schedule_code = $3
        `, [startTime, endTime, schedule.schedule_code]);
        
        console.log(`✅ ${schedule.schedule_code}: ${name}`);
        console.log(`   Время: ${startTime} - ${endTime}`);
      } else {
        console.log(`⚠️  ${schedule.schedule_code}: ${name}`);
        console.log(`   Не удалось извлечь время из названия`);
      }
    }

    // 3. Создаем тестовые ночные графики
    console.log('\n3. СОЗДАНИЕ ТЕСТОВЫХ НОЧНЫХ ГРАФИКОВ');
    console.log('=' .repeat(60));
    
    const nightSchedules = [
      {
        code: 'NIGHT_22_06',
        name: 'Ночная смена 22:00-06:00',
        start_time: '22:00',
        end_time: '06:00',
        hours: 8
      },
      {
        code: 'NIGHT_23_07',
        name: 'Ночная смена 23:00-07:00',
        start_time: '23:00',
        end_time: '07:00',
        hours: 8
      },
      {
        code: 'NIGHT_00_12',
        name: 'Ночная смена 00:00-12:00',
        start_time: '00:00',
        end_time: '12:00',
        hours: 12
      }
    ];
    
    for (const nightSchedule of nightSchedules) {
      // Добавляем график для каждого дня текущего месяца
      for (let day = 1; day <= 31; day++) {
        const workDate = `2025-06-${day.toString().padStart(2, '0')}`;
        
        try {
          await query(`
            INSERT INTO work_schedules_1c 
            (schedule_name, schedule_code, work_date, work_month, time_type, work_hours, work_start_time, work_end_time)
            VALUES ($1, $2, $3, '2025-06-01', 'Рабочее время', $4, $5, $6)
            ON CONFLICT (schedule_code, work_date) DO UPDATE SET
              work_start_time = EXCLUDED.work_start_time,
              work_end_time = EXCLUDED.work_end_time
          `, [
            nightSchedule.name,
            nightSchedule.code,
            workDate,
            nightSchedule.hours,
            nightSchedule.start_time,
            nightSchedule.end_time
          ]);
        } catch (error) {
          // Игнорируем ошибки с несуществующими датами (31 число не во всех месяцах)
        }
      }
      
      console.log(`✅ Создан график: ${nightSchedule.name}`);
      console.log(`   Код: ${nightSchedule.code}`);
      console.log(`   Время: ${nightSchedule.start_time} - ${nightSchedule.end_time} (${nightSchedule.hours}ч)`);
    }

    // 4. Назначаем ночной график сотруднику АП00-00467
    console.log('\n4. НАЗНАЧЕНИЕ НОЧНОГО ГРАФИКА СОТРУДНИКУ АП00-00467');
    console.log('=' .repeat(60));
    
    const employee = await queryRow(`
      SELECT id FROM employees WHERE table_number = 'АП00-00467'
    `);
    
    if (employee) {
      await query(`
        INSERT INTO employee_schedule_assignments 
        (employee_id, employee_number, schedule_code, start_date, assigned_by)
        VALUES ($1, 'АП00-00467', 'NIGHT_22_06', '2025-06-01', 'test_assignment')
        ON CONFLICT DO NOTHING
      `, [employee.id]);
      
      console.log('✅ Назначен ночной график NIGHT_22_06 сотруднику АП00-00467');
    } else {
      console.log('❌ Сотрудник АП00-00467 не найден');
    }

    // 5. Создаем тестовые события времени для ночной смены
    console.log('\n5. СОЗДАНИЕ ТЕСТОВЫХ СОБЫТИЙ ДЛЯ НОЧНОЙ СМЕНЫ');
    console.log('=' .repeat(60));
    
    const testDates = [
      '2025-06-01',
      '2025-06-02', 
      '2025-06-03'
    ];
    
    for (const date of testDates) {
      // Приход в 22:00 предыдущего дня
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      const checkinTime = `${prevDate.toISOString().split('T')[0]} 22:00:00`;
      
      // Уход в 06:00 текущего дня  
      const checkoutTime = `${date} 06:00:00`;
      
      // Добавляем события входа и выхода
      await query(`
        INSERT INTO time_events (employee_number, event_datetime, event_type, object_code)
        VALUES 
          ('АП00-00467', $1, '1', 'АП000017'),
          ('АП00-00467', $2, '2', 'АП000017')
        ON CONFLICT DO NOTHING
      `, [checkinTime, checkoutTime]);
      
      console.log(`✅ События для ${date}:`);
      console.log(`   Приход: ${checkinTime}`);
      console.log(`   Уход:   ${checkoutTime}`);
    }

    // 6. Создаем записи времени с проблемой ночных смен
    console.log('\n6. СОЗДАНИЕ ПРОБЛЕМНЫХ ЗАПИСЕЙ ВРЕМЕНИ');
    console.log('=' .repeat(60));
    
    for (const date of testDates) {
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      const checkinTime = `${prevDate.toISOString().split('T')[0]} 22:00:00`;
      const checkoutTime = `${date} 06:00:00`;
      
      // Простой расчет часов (будет неправильный для ночных смен)
      const simpleHours = 6 - 22; // -16 часов (проблема!)
      const correctHours = 8; // правильные 8 часов
      
      await query(`
        INSERT INTO time_records 
        (employee_number, date, check_in, check_out, hours_worked, status, off_schedule)
        VALUES ($1, $2, $3, $4, $5, 'night_shift_error', true)
        ON CONFLICT (employee_number, date) DO UPDATE SET
          check_in = EXCLUDED.check_in,
          check_out = EXCLUDED.check_out,
          hours_worked = EXCLUDED.hours_worked,
          status = EXCLUDED.status
      `, ['АП00-00467', date, checkinTime, checkoutTime, simpleHours]);
      
      console.log(`❌ Проблемная запись для ${date}:`);
      console.log(`   ${checkinTime} - ${checkoutTime}`);
      console.log(`   Рассчитано часов: ${simpleHours} (ОШИБКА!)`);
      console.log(`   Должно быть: ${correctHours} часов`);
    }

    // 7. Проверяем результат
    console.log('\n7. ПРОВЕРКА СОЗДАННЫХ ДАННЫХ');
    console.log('=' .repeat(60));
    
    const nightScheduleCheck = await queryRows(`
      SELECT schedule_code, schedule_name, work_start_time, work_end_time, work_hours
      FROM work_schedules_1c 
      WHERE work_start_time > work_end_time
      ORDER BY schedule_code
      LIMIT 5
    `);
    
    console.log(`Найдено ночных графиков: ${nightScheduleCheck.length}`);
    nightScheduleCheck.forEach(schedule => {
      console.log(`- ${schedule.schedule_code}: ${schedule.work_start_time} - ${schedule.work_end_time} (${schedule.work_hours}ч)`);
    });
    
    const problemRecords = await queryRows(`
      SELECT employee_number, date, check_in, check_out, hours_worked, status
      FROM time_records 
      WHERE hours_worked < 0 OR status = 'night_shift_error'
      ORDER BY date DESC
    `);
    
    console.log(`\nПроблемных записей: ${problemRecords.length}`);
    problemRecords.forEach(record => {
      console.log(`❌ ${record.employee_number} | ${record.date} | ${record.hours_worked}ч | ${record.status}`);
    });

    console.log('\n=== ТЕСТОВЫЕ ДАННЫЕ СОЗДАНЫ ===');
    
  } catch (error) {
    console.error('❌ Ошибка при создании тестовых данных:', error);
  } finally {
    await pool.end();
  }
}

// Запуск создания тестовых данных
createNightShiftTestData().catch(console.error);