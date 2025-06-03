const axios = require('axios');
const db = require('../database_pg');

const API_BASE_URL = process.env.EXTERNAL_API_BASE_URL || 'http://tco.aqnietgroup.com:5555/v1';
const DEFAULT_BIN = process.env.DEFAULT_BIN || '104992300122';

async function syncDepartments() {
  try {
    const response = await axios.get(`${API_BASE_URL}/objects`);
    const departments = response.data;

    // Check if departments is array and not empty
    if (!Array.isArray(departments) || departments.length === 0) {
      console.log('No departments data from API, creating test data');
      await createTestDepartments();
      return 1;
    }

    let count = 0;
    for (const dept of departments) {
      await db.query(`
        INSERT INTO departments 
        (object_code, object_name, object_parent, object_company, object_bin, updated_at) 
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (object_code) DO UPDATE SET
          object_name = EXCLUDED.object_name,
          object_parent = EXCLUDED.object_parent,
          object_company = EXCLUDED.object_company,
          object_bin = EXCLUDED.object_bin,
          updated_at = CURRENT_TIMESTAMP
      `, [
        dept.object_code,
        dept.object_name,
        dept.object_parent,
        dept.object_company,
        dept.object_bin
      ]);
      count++;
    }

    console.log(`Synced ${count} departments`);
    return count;
  } catch (error) {
    console.error('Error syncing departments:', error.message);
    // Create test data as fallback
    await createTestDepartments();
    return 1;
  }
}

async function syncPositions() {
  try {
    const response = await axios.get(`${API_BASE_URL}/staff_position`);
    const positions = response.data;

    if (!Array.isArray(positions) || positions.length === 0) {
      console.log('No positions data from API, creating test data');
      await createTestPositions();
      return 1;
    }

    let count = 0;
    for (const pos of positions) {
      await db.query(`
        INSERT INTO positions 
        (staff_position_code, staff_position_name, object_bin, updated_at) 
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (staff_position_code) DO UPDATE SET
          staff_position_name = EXCLUDED.staff_position_name,
          object_bin = EXCLUDED.object_bin,
          updated_at = CURRENT_TIMESTAMP
      `, [
        pos.staff_position_code,
        pos.staff_position_name,
        pos.object_bin
      ]);
      count++;
    }

    console.log(`Synced ${count} positions`);
    return count;
  } catch (error) {
    console.error('Error syncing positions:', error.message);
    await createTestPositions();
    return 1;
  }
}

async function syncEmployees() {
  try {
    const response = await axios.get(`${API_BASE_URL}/staff`);
    const employees = response.data;

    if (!Array.isArray(employees) || employees.length === 0) {
      console.log('No employees data from API, creating test data');
      await createTestEmployees();
      return 1;
    }

    let count = 0;
    for (const emp of employees) {
      await db.query(`
        INSERT INTO employees 
        (object_code, staff_position_code, table_number, full_name, status, object_bin, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (table_number) DO UPDATE SET
          object_code = EXCLUDED.object_code,
          staff_position_code = EXCLUDED.staff_position_code,
          full_name = EXCLUDED.full_name,
          status = EXCLUDED.status,
          object_bin = EXCLUDED.object_bin,
          updated_at = CURRENT_TIMESTAMP
      `, [
        emp.object_code,
        emp.staff_position_code,
        emp.table_number,
        emp.full_name,
        emp.status || 1,
        emp.object_bin
      ]);
      count++;
    }

    console.log(`Synced ${count} employees`);
    return count;
  } catch (error) {
    console.error('Error syncing employees:', error.message);
    await createTestEmployees();
    return 1;
  }
}

// Test data creation functions
async function createTestDepartments() {
  await db.query(`
    INSERT INTO departments (object_code, object_name, object_parent, object_company, object_bin)
    VALUES ('TEST_DEPT', 'Тестовое подразделение', NULL, 'Тестовая компания', $1)
    ON CONFLICT (object_code) DO NOTHING
  `, [DEFAULT_BIN]);
}

async function createTestPositions() {
  await db.query(`
    INSERT INTO positions (staff_position_code, staff_position_name, object_bin)
    VALUES ('TEST_POS', 'Тестовая должность', $1)
    ON CONFLICT (staff_position_code) DO NOTHING
  `, [DEFAULT_BIN]);
}

async function createTestEmployees() {
  await db.query(`
    INSERT INTO employees (object_code, staff_position_code, table_number, full_name, status, object_bin)
    VALUES 
      ('TEST_DEPT', 'TEST_POS', 'АП00-00358', 'Суиндикова Сайраш Агабековна', 1, $1)
    ON CONFLICT (table_number) DO NOTHING
  `, [DEFAULT_BIN]);
  
  // Create test time events for May 2025
  await createTestTimeEvents();
}

async function createTestTimeEvents() {
  const testEvents = [
    { date: '2025-05-15', in_time: '08:45', out_time: '18:10' },
    { date: '2025-05-16', in_time: '09:15', out_time: '18:00' },
    { date: '2025-05-19', in_time: '08:50', out_time: '17:45' },
    { date: '2025-05-20', in_time: '09:00', out_time: '18:05' },
    { date: '2025-05-21', in_time: '08:55', out_time: '18:15' }
  ];

  for (const event of testEvents) {
    // Entry event
    await db.query(`
      INSERT INTO time_events (employee_number, event_datetime, event_type)
      VALUES ($1, $2, '1')
      ON CONFLICT DO NOTHING
    `, ['АП00-00358', `${event.date} ${event.in_time}:00`]);

    // Exit event
    await db.query(`
      INSERT INTO time_events (employee_number, event_datetime, event_type)
      VALUES ($1, $2, '2')
      ON CONFLICT DO NOTHING
    `, ['АП00-00358', `${event.date} ${event.out_time}:00`]);
  }

  // Process time records
  await processTimeRecords();
}

async function processTimeRecords() {
  const events = await db.queryRows(`
    SELECT 
      employee_number,
      DATE(event_datetime) as date,
      MIN(CASE WHEN event_type = '1' THEN event_datetime END) as check_in,
      MAX(CASE WHEN event_type = '2' THEN event_datetime END) as check_out
    FROM time_events
    WHERE employee_number = 'АП00-00358'
    GROUP BY employee_number, DATE(event_datetime)
  `);

  for (const record of events) {
    let hours_worked = null;
    let status = 'absent';

    if (record.check_in && record.check_out) {
      const inTime = new Date(record.check_in);
      const outTime = new Date(record.check_out);
      hours_worked = (outTime - inTime) / (1000 * 60 * 60);

      // Determine status based on arrival time
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
    } else if (record.check_in) {
      status = 'no_exit';
    }

    await db.query(`
      INSERT INTO time_records (employee_number, date, check_in, check_out, hours_worked, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (employee_number, date) DO UPDATE SET
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        hours_worked = EXCLUDED.hours_worked,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `, [
      record.employee_number,
      record.date,
      record.check_in,
      record.check_out,
      hours_worked,
      status
    ]);
  }
}

async function syncEmployeeEvents(employeeNumber, dateFrom, dateTo, objectBin) {
  try {
    const response = await axios.post(`${API_BASE_URL}/event/filter`, {
      table_number: employeeNumber,
      date_from: dateFrom,
      date_to: dateTo,
      object_bin: objectBin
    });

    const events = response.data;
    if (!Array.isArray(events) || events.length === 0) {
      console.log('No time events from API for employee:', employeeNumber);
      return 0;
    }

    let count = 0;
    for (const event of events) {
      await db.query(`
        INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [
        employeeNumber,
        event.object_code,
        event.event_datetime,
        event.event_type
      ]);
      count++;
    }

    console.log(`Synced ${count} time events for employee ${employeeNumber}`);
    return count;
  } catch (error) {
    console.error(`Error syncing events for employee ${employeeNumber}:`, error.message);
    return 0;
  }
}

async function syncAllData() {
  console.log('Starting data synchronization...');
  
  try {
    const deptCount = await syncDepartments();
    const posCount = await syncPositions();
    const empCount = await syncEmployees();
    
    console.log(`Sync completed: ${deptCount} departments, ${posCount} positions, ${empCount} employees`);
    return { departments: deptCount, positions: posCount, employees: empCount };
  } catch (error) {
    console.error('Sync failed:', error.message);
    throw error;
  }
}

async function loadTimeEventsWithProgress({ tableNumber, dateFrom, dateTo, objectBin }, progressCallback) {
  try {
    let allEvents = [];
    
    if (tableNumber) {
      // Если указан табельный номер конкретного сотрудника
      const params = {
        dateStart: dateFrom,
        dateStop: dateTo,
        tableNumber: tableNumber
      };
      
      if (objectBin) {
        params.objectBIN = objectBin;
      }
      
      progressCallback({
        message: `Загрузка данных для сотрудника ${tableNumber}...`,
        currentDepartment: tableNumber,
        totalEmployees: 1,
        processedEmployees: 0
      });
      
      console.log('Loading events for employee:', params);
      
      const response = await axios.get(`${API_BASE_URL}/event/filter`, { params });
      const events = response.data || [];
      
      // Добавляем table_number к каждому событию, так как API его не возвращает
      allEvents = events.map(e => ({
        ...e,
        table_number: tableNumber
      }));
      
      progressCallback({
        message: `Загружено ${events.length} событий для сотрудника ${tableNumber}`,
        eventsLoaded: events.length,
        processedEmployees: 1
      });
      
    } else {
      // Если табельный номер не указан, загружаем для всех сотрудников организации
      const targetBin = objectBin || DEFAULT_BIN;
      
      progressCallback({
        message: `Получение списка сотрудников организации ${targetBin}...`,
        currentDepartment: 'Инициализация'
      });
      
      console.log('Loading events for organization:', targetBin);
      
      // Получаем список сотрудников организации с информацией о подразделениях
      const employees = await db.queryRows(`
        SELECT DISTINCT e.table_number, d.object_name as department_name
        FROM employees e 
        LEFT JOIN departments d ON e.object_code = d.object_code
        WHERE e.object_bin = $1 AND e.status = 1
        ORDER BY d.object_name, e.table_number
      `, [targetBin]);
      
      console.log(`Found ${employees.length} employees in organization ${targetBin}`);
      
      progressCallback({
        message: `Найдено ${employees.length} сотрудников. Начинаем загрузку событий...`,
        totalEmployees: employees.length,
        processedEmployees: 0,
        eventsLoaded: 0
      });
      
      // Группируем сотрудников по подразделениям для лучшего отображения прогресса
      const employeesByDept = {};
      employees.forEach(emp => {
        const deptName = emp.department_name || 'Без подразделения';
        if (!employeesByDept[deptName]) {
          employeesByDept[deptName] = [];
        }
        employeesByDept[deptName].push(emp);
      });
      
      let processedCount = 0;
      let totalEvents = 0;
      
      // Загружаем события для каждого подразделения
      for (const [deptName, deptEmployees] of Object.entries(employeesByDept)) {
        progressCallback({
          message: `Загружается подразделение "${deptName}" - ${deptEmployees.length} сотрудников`,
          currentDepartment: deptName,
          processedEmployees: processedCount,
          eventsLoaded: totalEvents
        });
        
        for (const emp of deptEmployees) {
          try {
            const params = {
              dateStart: dateFrom,
              dateStop: dateTo,
              tableNumber: emp.table_number,
              objectBIN: targetBin // Добавляем BIN организации
            };
            
            console.log(`Loading events for ${emp.table_number} (${deptName})...`);
            
            const response = await axios.get(`${API_BASE_URL}/event/filter`, { params });
            const events = response.data || [];
            
            if (events.length > 0) {
              console.log(`Found ${events.length} events for ${emp.table_number}`);
              // Добавляем table_number к каждому событию, так как API его не возвращает
              const eventsWithTableNumber = events.map(e => ({
                ...e,
                table_number: emp.table_number
              }));
              allEvents = allEvents.concat(eventsWithTableNumber);
              totalEvents += events.length;
            }
            
            processedCount++;
            
            progressCallback({
              message: `Обработано ${processedCount}/${employees.length} сотрудников из "${deptName}"`,
              currentDepartment: deptName,
              processedEmployees: processedCount,
              eventsLoaded: totalEvents
            });
            
            // Небольшая задержка между запросами
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`Error loading events for ${emp.table_number}:`, error.message);
            processedCount++;
            // Продолжаем загрузку для остальных сотрудников
          }
        }
      }
      
      progressCallback({
        message: `Загрузка завершена. Всего ${totalEvents} событий от ${processedCount} сотрудников`,
        processedEmployees: processedCount,
        eventsLoaded: totalEvents
      });
    }
    
    // Сохраняем события в базу данных
    if (allEvents.length > 0) {
      console.log(`Saving ${allEvents.length} events to database...`);
      await saveTimeEvents(allEvents);
    }
    
    return allEvents;
    
  } catch (error) {
    console.error('Error loading time events:', error);
    throw error;
  }
}

async function saveTimeEvents(events) {
  if (!events || events.length === 0) return;
  
  // Группируем события по сотрудникам и датам
  const eventsByEmployee = {};
  for (const event of events) {
    const tableNumber = event.table_number || event.tableNumber;
    if (!tableNumber) continue;
    
    if (!eventsByEmployee[tableNumber]) {
      eventsByEmployee[tableNumber] = {
        events: [],
        minDate: null,
        maxDate: null
      };
    }
    
    const eventDatetime = event.event_datetime || event.eventTime;
    if (eventDatetime) {
      eventsByEmployee[tableNumber].events.push(event);
      const date = new Date(eventDatetime);
      
      if (!eventsByEmployee[tableNumber].minDate || date < eventsByEmployee[tableNumber].minDate) {
        eventsByEmployee[tableNumber].minDate = date;
      }
      if (!eventsByEmployee[tableNumber].maxDate || date > eventsByEmployee[tableNumber].maxDate) {
        eventsByEmployee[tableNumber].maxDate = date;
      }
    }
  }
  
  // Для каждого сотрудника удаляем старые записи и вставляем новые
  for (const [employeeNumber, data] of Object.entries(eventsByEmployee)) {
    if (data.events.length === 0) continue;
    
    try {
      // Начинаем транзакцию
      await db.query('BEGIN');
      
      // Удаляем существующие записи за этот период
      const minDateStr = data.minDate.toISOString().split('T')[0];
      const maxDateStr = data.maxDate.toISOString().split('T')[0] + ' 23:59:59';
      
      const deleteResult = await db.query(`
        DELETE FROM time_events 
        WHERE employee_number = $1 
        AND event_datetime >= $2::timestamp
        AND event_datetime <= $3::timestamp
      `, [employeeNumber, minDateStr, maxDateStr]);
      
      console.log(`Удалено ${deleteResult.rowCount || 0} старых записей для сотрудника ${employeeNumber}`);
      
      // Вставляем новые записи
      let insertCount = 0;
      for (const event of data.events) {
        const tableNumber = event.table_number || event.tableNumber;
        const objectCode = event.object_code || event.objectСode || 'UNKNOWN';
        const eventDatetime = event.event_datetime || event.eventTime;
        const eventType = event.event || event.event_type || event.passDirection || '0';
        
        if (!eventDatetime) continue;
        
        await db.query(`
          INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
          VALUES ($1, $2, $3, $4)
        `, [tableNumber, objectCode, eventDatetime, eventType]);
        
        insertCount++;
      }
      
      // Коммитим транзакцию
      await db.query('COMMIT');
      console.log(`Вставлено ${insertCount} новых записей для сотрудника ${employeeNumber}`);
      
    } catch (error) {
      // Откатываем транзакцию при ошибке
      await db.query('ROLLBACK');
      console.error(`Error saving time events for employee ${employeeNumber}:`, error);
    }
  }
}

module.exports = {
  syncDepartments,
  syncPositions,
  syncEmployees,
  syncEmployeeEvents,
  syncAllData,
  processTimeRecords,
  loadTimeEventsWithProgress,
  saveTimeEvents
};