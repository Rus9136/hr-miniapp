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
async function loadTimeEvents({ tableNumber, dateFrom, dateTo, objectBin }) {
  try {
    const params = {
      dateStart: dateFrom,
      dateStop: dateTo
    };
    
    if (tableNumber) params.tableNumber = tableNumber;
    if (objectBin) params.objectBIN = objectBin;
    
    console.log('Loading events with params:', params);
    
    const response = await axios.get(`${API_BASE_URL}/event/filter`, { params });
    const events = response.data || [];
    
    console.log(`Loaded ${events.length} events from API`);
    
    // Save events to database
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO time_events 
      (employee_id, object_code, event_datetime, event_type) 
      VALUES (?, ?, ?, ?)
    `);
    
    let savedCount = 0;
    
    for (const event of events) {
      // Find employee by table number
      const employee = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM employees WHERE table_number = ?', 
          [event.table_number || tableNumber], 
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (employee) {
        stmt.run(
          employee.id,
          event.object_code,
          event.event_datetime,
          event.event
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
  
  // Group events by employee and date
  const eventsByEmployeeDate = {};
  
  for (const event of events) {
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
    
    if (!employee) continue;
    
    const date = event.event_datetime.split(' ')[0];
    const key = `${employee.id}_${date}`;
    
    if (!eventsByEmployeeDate[key]) {
      eventsByEmployeeDate[key] = {
        employeeId: employee.id,
        date: date,
        events: []
      };
    }
    
    eventsByEmployeeDate[key].events.push(event);
  }
  
  // Process each employee's day
  for (const data of Object.values(eventsByEmployeeDate)) {
    const checkIn = data.events.find(e => e.event === '1');
    const checkOutEvents = data.events.filter(e => e.event === '2');
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
  processTimeRecords
};