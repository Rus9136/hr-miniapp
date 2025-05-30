const axios = require('axios');
const db = require('../database');

const API_BASE_URL = process.env.API_BASE_URL || 'http://tco.aqnietgroup.com:5555/v1';
const DEFAULT_BIN = process.env.DEFAULT_BIN || '104992300122';

async function syncDepartments() {
  try {
    const response = await axios.get(`${API_BASE_URL}/objects`);
    const departments = response.data;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO departments 
      (object_code, object_name, object_parent, object_company, object_bin, updated_at) 
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    departments.forEach(dept => {
      stmt.run(
        dept.object_code,
        dept.object_name,
        dept.object_parent,
        dept.object_company,
        dept.object_bin
      );
    });

    stmt.finalize();
    console.log(`Synced ${departments.length} departments`);
    return departments.length;
  } catch (error) {
    console.error('Error syncing departments:', error.message);
    throw error;
  }
}

async function syncPositions() {
  try {
    const response = await axios.get(`${API_BASE_URL}/staff_position`);
    const positions = response.data;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO positions 
      (staff_position_code, staff_position_name, object_bin, updated_at) 
      VALUES (?, ?, ?, datetime('now'))
    `);

    positions.forEach(pos => {
      stmt.run(
        pos.staff_position_code,
        pos.staff_position_name,
        pos.object_bin
      );
    });

    stmt.finalize();
    console.log(`Synced ${positions.length} positions`);
    return positions.length;
  } catch (error) {
    console.error('Error syncing positions:', error.message);
    throw error;
  }
}

async function syncEmployees() {
  try {
    const response = await axios.get(`${API_BASE_URL}/staff`);
    const employees = response.data;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO employees 
      (object_code, staff_position_code, table_number, full_name, status, object_bin, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    employees.forEach(emp => {
      stmt.run(
        emp.object_code,
        emp.staff_position_code,
        emp.table_number,
        emp.full_name,
        emp.status,
        emp.object_bin
      );
    });

    stmt.finalize();
    console.log(`Synced ${employees.length} employees`);
    return employees.length;
  } catch (error) {
    console.error('Error syncing employees:', error.message);
    throw error;
  }
}

async function syncEmployeeEvents(tableNumber, dateStart, dateStop, objectBIN = DEFAULT_BIN) {
  try {
    const response = await axios.get(`${API_BASE_URL}/event/filter`, {
      params: {
        tableNumber,
        dateStart,
        dateStop,
        objectBIN
      }
    });

    const events = response.data;

    // Get employee ID
    const employee = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM employees WHERE table_number = ?', [tableNumber], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!employee) {
      throw new Error(`Employee with table number ${tableNumber} not found`);
    }

    // Insert events
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO time_events 
      (employee_id, object_code, event_datetime, event_type) 
      VALUES (?, ?, ?, ?)
    `);

    events.forEach(event => {
      stmt.run(
        employee.id,
        event.object_code,
        event.event_datetime,
        event.event
      );
    });

    stmt.finalize();

    // Process events into time records
    await processTimeRecords(employee.id, dateStart, dateStop);

    return events.length;
  } catch (error) {
    console.error('Error syncing employee events:', error.message);
    throw error;
  }
}

async function processTimeRecords(employeeId, dateStart, dateStop) {
  const events = await new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM time_events 
       WHERE employee_id = ? 
       AND date(event_datetime) BETWEEN ? AND ?
       ORDER BY event_datetime`,
      [employeeId, dateStart, dateStop],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  // Group events by date
  const eventsByDate = {};
  events.forEach(event => {
    const date = event.event_datetime.split(' ')[0];
    if (!eventsByDate[date]) {
      eventsByDate[date] = [];
    }
    eventsByDate[date].push(event);
  });

  // Process each day
  for (const [date, dayEvents] of Object.entries(eventsByDate)) {
    const checkIn = dayEvents.find(e => e.event_type === '1');
    const checkOutEvents = dayEvents.filter(e => e.event_type === '2');
    const checkOut = checkOutEvents.length > 0 ? checkOutEvents[checkOutEvents.length - 1] : null;

    if (checkIn) {
      const checkInTime = new Date(checkIn.event_datetime);
      const checkOutTime = checkOut ? new Date(checkOut.event_datetime) : null;
      
      let hoursWorked = 0;
      if (checkOutTime) {
        hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      }

      // Determine status
      let status = 'absent';
      if (checkIn) {
        const checkInHour = checkInTime.getHours();
        const checkInMinutes = checkInTime.getMinutes();
        
        if (checkInHour < 9 || (checkInHour === 9 && checkInMinutes === 0)) {
          status = 'on_time';
        } else {
          status = 'late';
        }
        
        if (checkOutTime) {
          const checkOutHour = checkOutTime.getHours();
          if (checkOutHour < 18) {
            status = 'early_leave';
          }
        }
      }

      // Insert or update time record
      db.run(
        `INSERT OR REPLACE INTO time_records 
         (employee_id, date, check_in, check_out, hours_worked, status, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          employeeId,
          date,
          checkIn.event_datetime,
          checkOut ? checkOut.event_datetime : null,
          hoursWorked,
          status
        ]
      );
    }
  }
}

async function syncAllData() {
  await syncDepartments();
  await syncPositions();
  await syncEmployees();
}

// Load time events from external API
// Enhanced version with progress tracking
async function loadTimeEventsWithProgress({ tableNumber, dateFrom, dateTo, objectBin }, progressCallback = () => {}) {
  try {
    let allEvents = [];
    
    // Если указан конкретный табельный номер
    if (tableNumber && tableNumber.trim() !== '') {
      const params = {
        dateStart: dateFrom,
        dateStop: dateTo,
        tableNumber: tableNumber
      };
      
      // ВАЖНО: добавляем objectBIN если он указан
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
      allEvents = events;
      
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
      const employees = await new Promise((resolve, reject) => {
        db.all(
          `SELECT DISTINCT e.table_number, d.object_name as department_name
           FROM employees e 
           LEFT JOIN departments d ON e.object_code = d.object_code
           WHERE e.object_bin = ? AND e.status = 1
           ORDER BY d.object_name, e.table_number
           LIMIT 100`, // Ограничиваем для тестирования
          [targetBin],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      
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
              allEvents.push(...eventsWithTableNumber);
              totalEvents += events.length;
            }
            
            processedCount++;
            
            // Обновляем прогресс каждые несколько сотрудников
            if (processedCount % 5 === 0 || processedCount === employees.length) {
              progressCallback({
                message: `Подразделение "${deptName}" - обработано ${processedCount - employeesByDept[deptName].length + deptEmployees.indexOf(emp) + 1}/${deptEmployees.length} сотрудников`,
                currentDepartment: deptName,
                processedEmployees: processedCount,
                eventsLoaded: totalEvents
              });
            }
            
            // Задержка между запросами чтобы не перегружать API
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (err) {
            console.error(`Error loading events for ${emp.table_number}:`, err.message);
          }
        }
        
        progressCallback({
          message: `Подразделение "${deptName}" завершено - загружено ${totalEvents} событий`,
          currentDepartment: deptName,
          processedEmployees: processedCount,
          eventsLoaded: totalEvents
        });
      }
    }
    
    const events = allEvents;
    
    console.log(`Loaded ${events.length} events from API`);
    
    // Save events to database
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO time_events 
      (employee_id, object_code, event_datetime, event_type, employee_number) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    let savedCount = 0;
    
    // Process and save events with progress updates
    progressCallback({
      message: 'Сохранение событий в базу данных...',
      eventsLoaded: events.length
    });
    
    for (const event of events) {
      try {
        // Определяем employee_id на основе table_number если он есть
        let employeeId = null;
        const tableNumber = event.table_number || tableNumber;
        
        if (tableNumber) {
          const employee = await new Promise((resolve, reject) => {
            db.get(
              'SELECT id FROM employees WHERE table_number = ?', 
              [tableNumber], 
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });
          employeeId = employee?.id;
        }
        
        // Определяем тип события на основе времени если он не указан
        let eventType = event.event_type;
        if (!eventType || eventType === '' || eventType === null) {
          const eventTime = new Date(event.event_datetime);
          const hour = eventTime.getHours();
          // Логика: если время до 14:00 - это вход (1), после 14:00 - выход (2)
          eventType = hour < 14 ? '1' : '2';
        }
        
        console.log(`Saving event: ${event.event_datetime}, type: ${eventType}, table: ${tableNumber}`);
        
        stmt.run(
          employeeId,
          event.object_code,
          event.event_datetime,
          eventType,
          tableNumber
        );
        savedCount++;
      } catch (err) {
        console.error('Error saving event:', err);
      }
    }
    
    stmt.finalize();
    
    progressCallback({
      message: `Сохранено ${savedCount} событий в базу данных`,
      eventsLoaded: events.length,
      eventsSaved: savedCount
    });
    
    return events;
  } catch (error) {
    console.error('Error loading time events:', error.message);
    progressCallback({
      message: 'Ошибка загрузки: ' + error.message,
      error: error.message
    });
    throw error;
  }
}

// Original function for backward compatibility
async function loadTimeEvents({ tableNumber, dateFrom, dateTo, objectBin }) {
  try {
    let allEvents = [];
    
    // Если указан конкретный табельный номер
    if (tableNumber && tableNumber.trim() !== '') {
      const params = {
        dateStart: dateFrom,
        dateStop: dateTo,
        tableNumber: tableNumber
      };
      
      // ВАЖНО: добавляем objectBIN если он указан
      if (objectBin) {
        params.objectBIN = objectBin;
      }
      
      console.log('Loading events for employee:', params);
      
      const response = await axios.get(`${API_BASE_URL}/event/filter`, { params });
      const events = response.data || [];
      allEvents = events;
      
    } else {
      // Если табельный номер не указан, загружаем для всех сотрудников организации
      const targetBin = objectBin || DEFAULT_BIN;
      console.log('Loading events for organization:', targetBin);
      
      // Получаем список сотрудников организации
      const employees = await new Promise((resolve, reject) => {
        db.all(
          `SELECT DISTINCT e.table_number 
           FROM employees e 
           WHERE e.object_bin = ? AND e.status = 1
           LIMIT 100`, // Ограничиваем для тестирования
          [targetBin],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      
      console.log(`Found ${employees.length} employees in organization ${targetBin}`);
      
      // Загружаем события для каждого сотрудника
      for (const emp of employees) {
        try {
          const params = {
            dateStart: dateFrom,
            dateStop: dateTo,
            tableNumber: emp.table_number,
            objectBIN: targetBin // Добавляем BIN организации
          };
          
          console.log(`Loading events for ${emp.table_number}...`);
          
          const response = await axios.get(`${API_BASE_URL}/event/filter`, { params });
          const events = response.data || [];
          
          if (events.length > 0) {
            console.log(`Found ${events.length} events for ${emp.table_number}`);
            // Добавляем table_number к каждому событию, так как API его не возвращает
            const eventsWithTableNumber = events.map(e => ({
              ...e,
              table_number: emp.table_number
            }));
            allEvents.push(...eventsWithTableNumber);
          }
          
          // Задержка между запросами чтобы не перегружать API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (err) {
          console.error(`Error loading events for ${emp.table_number}:`, err.message);
        }
      }
    }
    
    const events = allEvents;
    
    console.log(`Loaded ${events.length} events from API`);
    
    // Save events to database
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO time_events 
      (employee_id, object_code, event_datetime, event_type) 
      VALUES (?, ?, ?, ?)
    `);
    
    let savedCount = 0;
    
    // Если загружаем для конкретного сотрудника, находим его ID
    let employeeId = null;
    if (tableNumber) {
      const employee = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM employees WHERE table_number = ?', 
          [tableNumber], 
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      if (employee) {
        employeeId = employee.id;
      }
    }
    
    for (const event of events) {
      // Если employeeId еще не определен, пытаемся найти по table_number из события
      let currentEmployeeId = employeeId;
      
      if (!currentEmployeeId && event.table_number) {
        const employee = await new Promise((resolve, reject) => {
          db.get(
            'SELECT id FROM employees WHERE table_number = ?', 
            [event.table_number], 
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        if (employee) {
          currentEmployeeId = employee.id;
        }
      }
      
      if (currentEmployeeId) {
        // Определяем тип события на основе времени если он не указан
        let eventType = event.event_type;
        if (!eventType || eventType === '' || eventType === null) {
          const eventTime = new Date(event.event_datetime);
          const hour = eventTime.getHours();
          // Логика: если время до 14:00 - это вход (1), после 14:00 - выход (2)
          eventType = hour < 14 ? '1' : '2';
        }
        
        stmt.run(
          currentEmployeeId,
          event.object_code,
          event.event_datetime,
          eventType
        );
        savedCount++;
      }
    }
    
    stmt.finalize();
    console.log(`Saved ${savedCount} events to database`);
    
    return events;
  } catch (error) {
    console.error('Error loading time events:', error.message);
    throw error;
  }
}

// Process time events into time records
async function processTimeRecords(events) {
  let processedCount = 0;
  
  if (!events || events.length === 0) {
    console.log('No events to process');
    return 0;
  }
  
  // Get all employee IDs from time_events that were just saved
  const employeeEvents = await new Promise((resolve, reject) => {
    db.all(
      `SELECT DISTINCT te.employee_id, te.event_datetime, te.event_type, e.table_number
       FROM time_events te
       JOIN employees e ON te.employee_id = e.id
       WHERE te.id IN (
         SELECT id FROM time_events 
         ORDER BY id DESC 
         LIMIT ?
       )`,
      [Math.max(100, (events.length || 0) * 2)], // Берем с запасом, минимум 100
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
  
  console.log(`Found ${employeeEvents.length} events in database to process`);
  
  // Group events by employee and date
  const eventsByEmployeeDate = {};
  
  for (const event of employeeEvents) {
    const date = event.event_datetime.split(' ')[0];
    const key = `${event.employee_id}_${date}`;
    
    if (!eventsByEmployeeDate[key]) {
      eventsByEmployeeDate[key] = {
        employeeId: event.employee_id,
        date: date,
        events: []
      };
    }
    
    eventsByEmployeeDate[key].events.push({
      event_datetime: event.event_datetime,
      event_type: event.event_type,
      table_number: event.table_number
    });
  }
  
  // Process each employee's day
  for (const data of Object.values(eventsByEmployeeDate)) {
    const checkIn = data.events.find(e => e.event_type == 1 || e.event_type === '1');
    const checkOutEvents = data.events.filter(e => e.event_type == 2 || e.event_type === '2');
    const checkOut = checkOutEvents.length > 0 ? checkOutEvents[checkOutEvents.length - 1] : null;
    
    if (checkIn) {
      const checkInTime = new Date(checkIn.event_datetime);
      const checkOutTime = checkOut ? new Date(checkOut.event_datetime) : null;
      
      let hoursWorked = 0;
      if (checkOutTime) {
        hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      }
      
      // Determine status
      let status = 'absent';
      const checkInHour = checkInTime.getHours();
      const checkInMinutes = checkInTime.getMinutes();
      
      if (checkInHour < 9 || (checkInHour === 9 && checkInMinutes === 0)) {
        status = 'on_time';
      } else {
        status = 'late';
      }
      
      if (checkOutTime) {
        const checkOutHour = checkOutTime.getHours();
        if (checkOutHour < 18 && status !== 'late') {
          status = 'early_leave';
        }
      }
      
      // Insert or update time record
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO time_records 
           (employee_id, date, check_in, check_out, hours_worked, status, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            data.employeeId,
            data.date,
            checkIn.event_datetime,
            checkOut ? checkOut.event_datetime : null,
            hoursWorked,
            status
          ],
          (err) => {
            if (err) reject(err);
            else {
              processedCount++;
              resolve();
            }
          }
        );
      });
    }
  }
  
  return processedCount;
}

module.exports = {
  syncAllData,
  syncDepartments,
  syncPositions,
  syncEmployees,
  syncEmployeeEvents,
  loadTimeEvents,
  loadTimeEventsWithProgress,
  processTimeRecords
};