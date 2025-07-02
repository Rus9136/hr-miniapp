const { pool, queryRows, queryRow, query } = require('./backend/database_pg');

async function fixNightShiftCalculation() {
  try {
    console.log('=== ИСПРАВЛЕНИЕ РАСЧЕТА НОЧНЫХ СМЕН ===\n');

    // 1. Функция для правильного расчета часов для ночных смен
    function calculateNightShiftHours(checkIn, checkOut) {
      const inTime = new Date(checkIn);
      const outTime = new Date(checkOut);
      
      // Если время выхода меньше времени входа, значит смена переходит через полночь
      if (outTime < inTime) {
        // Добавляем сутки к времени выхода
        outTime.setDate(outTime.getDate() + 1);
      }
      
      // Рассчитываем разность в миллисекундах и конвертируем в часы
      const diffMs = outTime.getTime() - inTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      return Math.round(diffHours * 100) / 100; // Округляем до 2 знаков
    }

    // 2. Найдем все проблемные записи с ночными сменами
    console.log('1. ПОИСК ПРОБЛЕМНЫХ ЗАПИСЕЙ НОЧНЫХ СМЕН');
    console.log('=' .repeat(60));
    
    const problematicRecords = await queryRows(`
      SELECT tr.*, ws.work_start_time, ws.work_end_time, ws.schedule_name
      FROM time_records tr
      LEFT JOIN employee_schedule_assignments esa ON esa.employee_number = tr.employee_number
        AND (esa.end_date IS NULL OR esa.end_date >= tr.date)
        AND esa.start_date <= tr.date
      LEFT JOIN work_schedules_1c ws ON ws.schedule_code = esa.schedule_code
        AND ws.work_date = tr.date
      WHERE tr.hours_worked < 0 
         OR tr.status = 'night_shift_error'
         OR (ws.work_start_time > ws.work_end_time)
      ORDER BY tr.date DESC
    `);
    
    console.log(`Найдено проблемных записей: ${problematicRecords.length}`);
    
    for (const record of problematicRecords) {
      console.log(`\n❌ ${record.employee_number} | ${record.date}`);
      console.log(`   Вход: ${record.check_in}`);
      console.log(`   Выход: ${record.check_out}`);
      console.log(`   Текущие часы: ${record.hours_worked}ч`);
      console.log(`   График: ${record.schedule_name || 'не назначен'}`);
      console.log(`   Время графика: ${record.work_start_time || 'нет'} - ${record.work_end_time || 'нет'}`);
      
      if (record.check_in && record.check_out) {
        const correctHours = calculateNightShiftHours(record.check_in, record.check_out);
        console.log(`   ✅ Правильные часы: ${correctHours}ч`);
        
        // Определяем статус
        let status = 'night_shift';
        if (record.work_start_time && record.work_end_time) {
          const scheduleStart = record.work_start_time;
          const scheduleEnd = record.work_end_time;
          const checkInTime = new Date(record.check_in).toTimeString().substr(0, 5);
          
          if (checkInTime <= scheduleStart || checkInTime >= '23:00') {
            status = 'night_shift_on_time';
          } else {
            status = 'night_shift_late';
          }
        }
        
        // Обновляем запись
        await query(`
          UPDATE time_records 
          SET hours_worked = $1, status = $2, off_schedule = false, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [correctHours, status, record.id]);
        
        console.log(`   🔄 Обновлено: ${correctHours}ч, статус: ${status}`);
      }
    }

    // 3. Создаем функцию для автоматического расчета ночных смен
    console.log('\n\n2. СОЗДАНИЕ ФУНКЦИИ РАСЧЕТА НОЧНЫХ СМЕН');
    console.log('=' .repeat(60));
    
    // Создаем SQL функцию для расчета часов ночных смен
    await query(`
      CREATE OR REPLACE FUNCTION calculate_night_shift_hours(
        check_in_time TIMESTAMP,
        check_out_time TIMESTAMP
      ) RETURNS DECIMAL AS $$
      DECLARE
        hours_worked DECIMAL;
        adjusted_check_out TIMESTAMP;
      BEGIN
        -- Если время выхода меньше времени входа, добавляем сутки
        IF check_out_time::TIME < check_in_time::TIME THEN
          adjusted_check_out := check_out_time + INTERVAL '1 day';
        ELSE
          adjusted_check_out := check_out_time;
        END IF;
        
        -- Рассчитываем часы
        hours_worked := EXTRACT(EPOCH FROM (adjusted_check_out - check_in_time)) / 3600;
        
        -- Округляем до 2 знаков
        RETURN ROUND(hours_worked, 2);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Создана SQL функция calculate_night_shift_hours()');

    // 4. Создаем функцию для автоматического пересчета всех записей
    console.log('\n3. ПЕРЕСЧЕТ ВСЕХ ЗАПИСЕЙ ВРЕМЕНИ');
    console.log('=' .repeat(60));
    
    const allRecords = await queryRows(`
      SELECT tr.*, esa.schedule_code, ws.work_start_time, ws.work_end_time
      FROM time_records tr
      LEFT JOIN employee_schedule_assignments esa ON esa.employee_number = tr.employee_number
        AND (esa.end_date IS NULL OR esa.end_date >= tr.date)
        AND esa.start_date <= tr.date
      LEFT JOIN work_schedules_1c ws ON ws.schedule_code = esa.schedule_code
        AND ws.work_date = tr.date
      WHERE tr.check_in IS NOT NULL AND tr.check_out IS NOT NULL
      ORDER BY tr.date DESC
    `);
    
    console.log(`Пересчитываем ${allRecords.length} записей...`);
    
    let updated = 0;
    let nightShifts = 0;
    
    for (const record of allRecords) {
      const isNightShift = record.work_start_time && record.work_end_time && 
                          record.work_start_time > record.work_end_time;
      
      if (isNightShift) {
        nightShifts++;
        const correctHours = calculateNightShiftHours(record.check_in, record.check_out);
        
        if (Math.abs(correctHours - parseFloat(record.hours_worked)) > 0.1) {
          await query(`
            UPDATE time_records 
            SET hours_worked = calculate_night_shift_hours($1, $2),
                status = CASE 
                  WHEN status LIKE '%night_shift%' OR hours_worked < 0 THEN 'night_shift_fixed'
                  ELSE status
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [record.check_in, record.check_out, record.id]);
          
          updated++;
        }
      }
    }
    
    console.log(`✅ Обновлено записей: ${updated}`);
    console.log(`📊 Ночных смен найдено: ${nightShifts}`);

    // 5. Создаем триггер для автоматического расчета при вставке/обновлении
    console.log('\n4. СОЗДАНИЕ ТРИГГЕРА ДЛЯ АВТОМАТИЧЕСКОГО РАСЧЕТА');
    console.log('=' .repeat(60));
    
    // Создаем функцию триггера
    await query(`
      CREATE OR REPLACE FUNCTION auto_calculate_work_hours()
      RETURNS TRIGGER AS $$
      DECLARE
        schedule_start_time TIME;
        schedule_end_time TIME;
        is_night_shift BOOLEAN;
      BEGIN
        -- Получаем информацию о графике работы
        SELECT ws.work_start_time, ws.work_end_time
        INTO schedule_start_time, schedule_end_time
        FROM employee_schedule_assignments esa
        JOIN work_schedules_1c ws ON ws.schedule_code = esa.schedule_code
        WHERE esa.employee_number = NEW.employee_number
          AND (esa.end_date IS NULL OR esa.end_date >= NEW.date)
          AND esa.start_date <= NEW.date
          AND ws.work_date = NEW.date
        LIMIT 1;
        
        -- Проверяем, является ли это ночной сменой
        is_night_shift := (schedule_start_time IS NOT NULL AND 
                          schedule_end_time IS NOT NULL AND 
                          schedule_start_time > schedule_end_time);
        
        -- Если есть время входа и выхода, рассчитываем часы
        IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
          IF is_night_shift THEN
            NEW.hours_worked := calculate_night_shift_hours(NEW.check_in, NEW.check_out);
            IF NEW.status IS NULL OR NEW.status = 'night_shift_error' THEN
              NEW.status := 'night_shift_auto';
            END IF;
          ELSE
            -- Обычный расчет для дневных смен
            NEW.hours_worked := EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600;
            NEW.hours_worked := ROUND(NEW.hours_worked, 2);
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Создаем триггер
    await query(`
      DROP TRIGGER IF EXISTS trigger_auto_calculate_work_hours ON time_records;
      CREATE TRIGGER trigger_auto_calculate_work_hours
        BEFORE INSERT OR UPDATE ON time_records
        FOR EACH ROW
        EXECUTE FUNCTION auto_calculate_work_hours();
    `);
    
    console.log('✅ Создан триггер auto_calculate_work_hours для автоматического расчета');

    // 6. Тестируем исправления
    console.log('\n5. ПРОВЕРКА ИСПРАВЛЕНИЙ');
    console.log('=' .repeat(60));
    
    const fixedRecords = await queryRows(`
      SELECT tr.*, esa.schedule_code, ws.work_start_time, ws.work_end_time, ws.schedule_name
      FROM time_records tr
      LEFT JOIN employee_schedule_assignments esa ON esa.employee_number = tr.employee_number
        AND (esa.end_date IS NULL OR esa.end_date >= tr.date)
        AND esa.start_date <= tr.date
      LEFT JOIN work_schedules_1c ws ON ws.schedule_code = esa.schedule_code
        AND ws.work_date = tr.date
      WHERE tr.employee_number = 'АП00-00467'
      ORDER BY tr.date DESC
    `);
    
    console.log(`Записи сотрудника АП00-00467 после исправления:`);
    fixedRecords.forEach(record => {
      const isNightShift = record.work_start_time && record.work_end_time && 
                          record.work_start_time > record.work_end_time;
      console.log(`\n📅 ${record.date}`);
      console.log(`   Вход:  ${record.check_in}`);
      console.log(`   Выход: ${record.check_out}`);
      console.log(`   Часов: ${record.hours_worked}ч`);
      console.log(`   Статус: ${record.status}`);
      console.log(`   График: ${record.schedule_name || 'не назначен'}`);
      console.log(`   ${isNightShift ? '🌙 НОЧНАЯ СМЕНА' : '☀️ ДНЕВНАЯ СМЕНА'}`);
    });

    // 7. Тест нового триггера
    console.log('\n6. ТЕСТИРОВАНИЕ ТРИГГЕРА');
    console.log('=' .repeat(60));
    
    // Вставляем тестовую запись для проверки триггера
    await query(`
      INSERT INTO time_records 
      (employee_number, date, check_in, check_out)
      VALUES 
      ('АП00-00467', '2025-06-04', '2025-06-03 22:00:00', '2025-06-04 06:00:00')
      ON CONFLICT (employee_number, date) DO UPDATE SET
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out
    `);
    
    const testRecord = await queryRow(`
      SELECT * FROM time_records 
      WHERE employee_number = 'АП00-00467' AND date = '2025-06-04'
    `);
    
    if (testRecord) {
      console.log('✅ Триггер работает! Тестовая запись:');
      console.log(`   Дата: ${testRecord.date}`);
      console.log(`   Вход: ${testRecord.check_in}`);
      console.log(`   Выход: ${testRecord.check_out}`);
      console.log(`   Часов: ${testRecord.hours_worked}ч (автоматически рассчитано)`);
      console.log(`   Статус: ${testRecord.status}`);
    }

    // 8. Итоговая статистика
    console.log('\n7. ИТОГОВАЯ СТАТИСТИКА');
    console.log('=' .repeat(60));
    
    const stats = await queryRow(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN hours_worked < 0 THEN 1 END) as negative_hours,
        COUNT(CASE WHEN status LIKE '%night_shift%' THEN 1 END) as night_shift_records,
        COUNT(CASE WHEN status = 'night_shift_fixed' THEN 1 END) as fixed_records,
        AVG(hours_worked) as avg_hours
      FROM time_records
      WHERE check_in IS NOT NULL AND check_out IS NOT NULL
    `);
    
    console.log('Общая статистика записей:');
    console.log(`- Всего записей: ${stats.total_records}`);
    console.log(`- Отрицательных часов: ${stats.negative_hours}`);
    console.log(`- Ночных смен: ${stats.night_shift_records}`);
    console.log(`- Исправленных записей: ${stats.fixed_records}`);
    console.log(`- Средние часы: ${Math.round(stats.avg_hours * 100) / 100}ч`);

    console.log('\n=== ИСПРАВЛЕНИЕ ЗАВЕРШЕНО ===');
    console.log('\nТеперь система корректно рассчитывает ночные смены!');
    console.log('Все новые записи будут автоматически рассчитываться триггером.');
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error);
  } finally {
    await pool.end();
  }
}

// Запуск исправления
fixNightShiftCalculation().catch(console.error);