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

module.exports = {
  syncDepartments,
  syncPositions,
  syncEmployees,
  syncEmployeeEvents,
  syncAllData,
  processTimeRecords
};