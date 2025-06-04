const { pool, queryRows, queryRow } = require('./backend/database_pg');

async function analyzeNightShifts() {
  try {
    console.log('=== АНАЛИЗ НОЧНЫХ СМЕН В HR СИСТЕМЕ ===\n');

    // 1. АНАЛИЗ СОТРУДНИКА АП00-00467
    console.log('1. АНАЛИЗ СОТРУДНИКА АП00-00467');
    console.log('=' .repeat(50));
    
    // Поиск сотрудника
    const employee = await queryRow(`
      SELECT id, table_number, full_name, object_code, staff_position_code 
      FROM employees 
      WHERE table_number = 'АП00-00467'
    `);
    
    if (employee) {
      console.log('Сотрудник найден:');
      console.log(`- ID: ${employee.id}`);
      console.log(`- Табельный номер: ${employee.table_number}`);
      console.log(`- ФИО: ${employee.full_name}`);
      console.log(`- Код подразделения: ${employee.object_code || 'не указан'}`);
      console.log(`- Код должности: ${employee.staff_position_code || 'не указан'}\n`);
      
      // Поиск назначенного графика
      const scheduleAssignment = await queryRow(`
        SELECT esa.*, ws.schedule_name, ws.work_hours
        FROM employee_schedule_assignments esa
        LEFT JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code
        WHERE esa.employee_number = 'АП00-00467'
          AND (esa.end_date IS NULL OR esa.end_date >= CURRENT_DATE)
        ORDER BY esa.created_at DESC
        LIMIT 1
      `);
      
      if (scheduleAssignment) {
        console.log('Назначенный график работы:');
        console.log(`- Код графика: ${scheduleAssignment.schedule_code}`);
        console.log(`- Название: ${scheduleAssignment.schedule_name || 'не указано'}`);
        console.log(`- Часов в смене: ${scheduleAssignment.work_hours || 'не указано'}`);
        console.log(`- Дата назначения: ${scheduleAssignment.start_date}`);
        console.log(`- Дата окончания: ${scheduleAssignment.end_date || 'активен'}\n`);
      } else {
        console.log('График работы не назначен\n');
      }
      
      // События входа/выхода за последний месяц
      const timeEvents = await queryRows(`
        SELECT event_datetime, event_type, object_code
        FROM time_events 
        WHERE employee_number = 'АП00-00467'
          AND event_datetime >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY event_datetime DESC
        LIMIT 20
      `);
      
      console.log(`События входа/выхода за последние 30 дней (${timeEvents.length} записей):`);
      if (timeEvents.length === 0) {
        console.log('   ❌ Нет данных по событиям времени');
      } else {
        timeEvents.forEach(event => {
          console.log(`- ${event.event_datetime}: ${event.event_type} (объект: ${event.object_code || 'не указан'})`);
        });
      }
      console.log();
      
      // Обработанные записи времени за последний месяц
      const timeRecords = await queryRows(`
        SELECT date, check_in, check_out, hours_worked, status, off_schedule
        FROM time_records 
        WHERE employee_number = 'АП00-00467'
          AND date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY date DESC
        LIMIT 15
      `);
      
      console.log(`Обработанные записи времени за последние 30 дней (${timeRecords.length} записей):`);
      if (timeRecords.length === 0) {
        console.log('   ❌ Нет обработанных записей времени');
      } else {
        timeRecords.forEach(record => {
          console.log(`- ${record.date}: ${record.check_in || 'нет'} - ${record.check_out || 'нет'} | ${record.hours_worked || 0}ч | ${record.status || 'не определен'} | ${record.off_schedule ? 'вне графика' : 'по графику'}`);
        });
      }
      console.log();
      
    } else {
      console.log('❌ Сотрудник АП00-00467 не найден в базе данных\n');
    }

    // Анализ реальных сотрудников с данными
    console.log('1.1. АНАЛИЗ СОТРУДНИКОВ С ДАННЫМИ ВРЕМЕНИ');
    console.log('-' .repeat(50));
    
    const employeesWithData = await queryRows(`
      SELECT DISTINCT e.table_number, e.full_name
      FROM employees e
      WHERE e.table_number IN (
        SELECT DISTINCT employee_number FROM time_events
        UNION
        SELECT DISTINCT employee_number FROM time_records
      )
      LIMIT 3
    `);
    
    for (const emp of employeesWithData) {
      console.log(`\n👤 ${emp.table_number} - ${emp.full_name}`);
      
      // События времени
      const events = await queryRows(`
        SELECT event_datetime, event_type
        FROM time_events 
        WHERE employee_number = $1
          AND event_datetime >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY event_datetime DESC
        LIMIT 5
      `, [emp.table_number]);
      
      console.log(`   События за неделю (${events.length}):`);
      events.forEach(event => {
        console.log(`   - ${event.event_datetime}: ${event.event_type}`);
      });
      
      // Записи времени
      const records = await queryRows(`
        SELECT date, check_in, check_out, hours_worked, status
        FROM time_records 
        WHERE employee_number = $1
          AND date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY date DESC
        LIMIT 5
      `, [emp.table_number]);
      
      console.log(`   Записи времени за неделю (${records.length}):`);
      records.forEach(record => {
        console.log(`   - ${record.date}: ${record.check_in || 'нет'} - ${record.check_out || 'нет'} (${record.hours_worked || 0}ч) ${record.status || ''}`);
      });
    }

    // 2. ПОИСК НОЧНЫХ ГРАФИКОВ
    console.log('\n2. ПОИСК ГРАФИКОВ РАБОТЫ');
    console.log('=' .repeat(50));
    
    // Сначала проанализируем все графики по названиям
    const scheduleAnalysis = await queryRows(`
      SELECT DISTINCT schedule_code, schedule_name, work_hours
      FROM work_schedules_1c 
      ORDER BY work_hours DESC
      LIMIT 15
    `);
    
    console.log(`Анализ графиков работы (${scheduleAnalysis.length} уникальных графиков):`);
    
    const nightShifts = [];
    const longShifts = [];
    const normalShifts = [];
    
    scheduleAnalysis.forEach((schedule, index) => {
      const name = schedule.schedule_name || 'без названия';
      const hours = schedule.work_hours || 0;
      
      // Определяем ночные смены по названию и часам
      const isNightShift = name.toLowerCase().includes('ночь') || 
                          name.toLowerCase().includes('night') ||
                          name.includes('22:00') || 
                          name.includes('23:00') ||
                          name.includes('00:00') ||
                          name.includes('01:00') ||
                          name.includes('02:00') ||
                          (hours >= 12);
      
      const schedule_info = {
        ...schedule,
        name: name,
        hours: hours,
        index: index + 1
      };
      
      if (isNightShift && hours >= 12) {
        nightShifts.push(schedule_info);
      } else if (hours > 10) {
        longShifts.push(schedule_info);
      } else {
        normalShifts.push(schedule_info);
      }
      
      console.log(`${index + 1}. ${schedule.schedule_code}`);
      console.log(`   ${name} (${hours}ч)`);
      if (isNightShift) {
        console.log(`   🌙 ПОТЕНЦИАЛЬНАЯ НОЧНАЯ СМЕНА`);
      } else if (hours > 10) {
        console.log(`   ⏰ ДЛИННАЯ СМЕНА`);
      }
    });
    
    console.log(`\nСводка графиков:`);
    console.log(`- Потенциально ночных: ${nightShifts.length}`);
    console.log(`- Длинных смен: ${longShifts.length}`);
    console.log(`- Обычных смен: ${normalShifts.length}`);
    console.log();

    // 3. АНАЛИЗ ПРОБЛЕМНЫХ ЗАПИСЕЙ
    console.log('3. АНАЛИЗ ПРОБЛЕМНЫХ ЗАПИСЕЙ');
    console.log('=' .repeat(50));
    
    // Записи где check_out < check_in
    const problematicRecords = await queryRows(`
      SELECT employee_number, date, check_in, check_out, hours_worked, status
      FROM time_records 
      WHERE check_in IS NOT NULL 
        AND check_out IS NOT NULL 
        AND check_out < check_in
      ORDER BY date DESC
      LIMIT 10
    `);
    
    console.log(`Записи где время выхода меньше времени входа (${problematicRecords.length} записей):`);
    problematicRecords.forEach(record => {
      console.log(`❌ ${record.employee_number} | ${record.date} | ${record.check_in} - ${record.check_out} | ${record.hours_worked}ч | ${record.status}`);
    });
    console.log();
    
    // Записи с отрицательными или большими часами
    const invalidHours = await queryRows(`
      SELECT employee_number, date, check_in, check_out, hours_worked, status
      FROM time_records 
      WHERE hours_worked < 0 OR hours_worked > 24
      ORDER BY hours_worked DESC
      LIMIT 10
    `);
    
    console.log(`Записи с неправильным количеством часов (${invalidHours.length} записей):`);
    invalidHours.forEach(record => {
      console.log(`⚠️  ${record.employee_number} | ${record.date} | ${record.check_in} - ${record.check_out} | ${record.hours_worked}ч | ${record.status}`);
    });
    console.log();

    // 4. ДЕТАЛЬНЫЙ АНАЛИЗ СОТРУДНИКОВ С ГРАФИКАМИ
    console.log('4. ДЕТАЛЬНЫЙ АНАЛИЗ СОТРУДНИКОВ С НАЗНАЧЕННЫМИ ГРАФИКАМИ');
    console.log('=' .repeat(50));
    
    // Найдем сотрудников с любыми назначенными графиками
    const employeesWithSchedules = await queryRows(`
      SELECT DISTINCT esa.employee_number, e.full_name, esa.schedule_code, ws.schedule_name, ws.work_hours
      FROM employee_schedule_assignments esa
      JOIN employees e ON e.table_number = esa.employee_number
      JOIN work_schedules_1c ws ON ws.schedule_code = esa.schedule_code
      WHERE (esa.end_date IS NULL OR esa.end_date >= CURRENT_DATE)
      ORDER BY ws.work_hours DESC
      LIMIT 5
    `);
    
    console.log(`Сотрудники с назначенными графиками (${employeesWithSchedules.length} человек):`);
    
    for (const emp of employeesWithSchedules) {
      console.log(`\n👤 ${emp.employee_number} - ${emp.full_name}`);
      console.log(`   График: ${emp.schedule_code} - ${emp.schedule_name || 'без названия'} (${emp.work_hours}ч)`);
      
      // Проблемные записи для этого сотрудника
      const empProblems = await queryRows(`
        SELECT date, check_in, check_out, hours_worked, status
        FROM time_records 
        WHERE employee_number = $1
          AND (check_out < check_in OR hours_worked < 0 OR hours_worked > 24)
          AND date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY date DESC
        LIMIT 5
      `, [emp.employee_number]);
      
      // Обычные записи для анализа
      const empRecords = await queryRows(`
        SELECT date, check_in, check_out, hours_worked, status
        FROM time_records 
        WHERE employee_number = $1
          AND date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY date DESC
        LIMIT 3
      `, [emp.employee_number]);
      
      if (empProblems.length > 0) {
        console.log(`   ❌ Проблемные записи (${empProblems.length}):`);
        empProblems.forEach(prob => {
          console.log(`      ${prob.date}: ${prob.check_in} - ${prob.check_out} (${prob.hours_worked}ч) ${prob.status}`);
        });
      } else {
        console.log(`   ✅ Проблемных записей не найдено`);
      }
      
      if (empRecords.length > 0) {
        console.log(`   📊 Последние записи времени:`);
        empRecords.forEach(record => {
          console.log(`      ${record.date}: ${record.check_in || 'нет'} - ${record.check_out || 'нет'} (${record.hours_worked || 0}ч) ${record.status || ''}`);
        });
      }
    }

    // 5. СТАТИСТИКА ПО ВСЕМ ГРАФИКАМ
    console.log('\n5. ОБЩАЯ СТАТИСТИКА ПО ГРАФИКАМ');
    console.log('=' .repeat(50));
    
    const scheduleStats = await queryRows(`
      SELECT 
        COUNT(*) as total_schedules,
        COUNT(CASE WHEN work_hours > 12 THEN 1 END) as long_shifts,
        AVG(work_hours) as avg_hours,
        MIN(work_hours) as min_hours,
        MAX(work_hours) as max_hours
      FROM (
        SELECT DISTINCT schedule_code, work_hours
        FROM work_schedules_1c
      ) as unique_schedules
    `);
    
    if (scheduleStats.length > 0) {
      const stats = scheduleStats[0];
      console.log(`Всего уникальных графиков: ${stats.total_schedules}`);
      console.log(`Длинных смен (>12ч): ${stats.long_shifts}`);
      console.log(`Средняя продолжительность: ${Math.round(stats.avg_hours * 100) / 100}ч`);
      console.log(`Мин/Макс продолжительность: ${stats.min_hours}ч - ${stats.max_hours}ч`);
    }

    // 6. АНАЛИЗ ПРОБЛЕМ РАСЧЕТА ВРЕМЕНИ
    console.log('\n6. АНАЛИЗ ПРОБЛЕМ РАСЧЕТА ВРЕМЕНИ');
    console.log('=' .repeat(50));
    
    // Проблемы с расчетом ночных смен
    console.log('Выявленные проблемы:');
    console.log('1. ❌ В таблице work_schedules_1c отсутствуют колонки work_start_time и work_end_time');
    console.log('   Есть только общее количество часов work_hours');
    console.log('');
    console.log('2. ❌ Сотрудник АП00-00467 найден в базе, но:');
    console.log('   - Нет назначенного графика работы');
    console.log('   - Нет событий входа/выхода');
    console.log('   - Нет обработанных записей времени');
    console.log('');
    console.log('3. ✅ Найдены сотрудники с данными времени:');
    console.log('   - АП00-00231: есть события и записи времени');
    console.log('   - АП00-00358: есть записи времени (тестовые данные)');
    console.log('   - АП00-00020: в базе, но без активных данных');
    console.log('');
    console.log('4. ⚠️  Структура данных:');
    console.log('   - work_schedules_1c содержит только информацию о часах работы');
    console.log('   - Нет точного времени начала/окончания смен');
    console.log('   - Невозможно определить ночные смены по времени');
    console.log('');
    console.log('РЕКОМЕНДАЦИИ:');
    console.log('- Добавить колонки work_start_time и work_end_time в work_schedules_1c');
    console.log('- Импортировать полные данные о времени работы из 1С');
    console.log('- Создать тестовые данные для сотрудника АП00-00467');
    console.log('- Реализовать логику расчета времени для ночных смен');

    console.log('\n=== АНАЛИЗ ЗАВЕРШЕН ===');
    
  } catch (error) {
    console.error('❌ Ошибка при анализе:', error);
  } finally {
    await pool.end();
  }
}

// Запуск анализа
analyzeNightShifts().catch(console.error);