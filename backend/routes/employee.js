const express = require('express');
const router = express.Router();
const db = require('../database_pg');
const { syncEmployeeEvents } = require('../utils/apiSync_pg');

// DEBUG: Get employee by table number for testing
router.get('/employee/debug/:tableNumber', async (req, res) => {
  const { tableNumber } = req.params;
  
  try {
    console.log(`DEBUG: Looking for employee with table_number: ${tableNumber}`);
    
    const employee = await db.queryRow('SELECT * FROM employees WHERE table_number = $1', [tableNumber]);
    
    if (!employee) {
      console.log(`DEBUG: No employee found with table_number: ${tableNumber}`);
      
      // Show all employees to debug
      const allEmployees = await db.queryRows('SELECT id, table_number, full_name FROM employees LIMIT 10');
      console.log('DEBUG: First 10 employees:', allEmployees);
      
      return res.status(404).json({ 
        error: 'Employee not found',
        debug: { tableNumber, sampleEmployees: allEmployees }
      });
    }
    
    console.log(`DEBUG: Found employee:`, employee);
    res.json({ employee });
  } catch (error) {
    console.error('DEBUG: Error finding employee:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DEPRECATED: Old endpoint - use /employee/by-number/:tableNumber/timesheet/:year/:month instead
router.get('/employee/:id/timesheet/:year/:month', async (req, res) => {
  const { id, year, month } = req.params;
  
  console.log(`🚨 DEPRECATED API CALLED: /employee/${id}/timesheet/${year}/${month}`);
  console.log(`🚨 Please use /employee/by-number/TABLE_NUMBER/timesheet/${year}/${month} instead`);
  
  // Return clear error to identify source
  return res.status(410).json({
    error: 'DEPRECATED ENDPOINT',
    message: `Old API endpoint /employee/${id}/timesheet/${year}/${month} is deprecated`,
    newEndpoint: `/employee/by-number/TABLE_NUMBER/timesheet/${year}/${month}`,
    fix: 'Update frontend to use tableNumber instead of id'
  });
  
  try {
    console.log(`Getting timesheet for employee ID: ${id}`);
    
    // Get employee info (using PostgreSQL)
    const employee = await db.queryRow('SELECT * FROM employees WHERE id = $1', [id]);

    if (!employee) {
      console.log(`Employee not found for ID: ${id}`);
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    console.log(`Found employee: ${employee.full_name} (${employee.table_number})`);

    // Calculate date range
    const dateStart = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateStop = `${year}-${month.padStart(2, '0')}-${lastDay}`;

    // Sync latest events from API
    try {
      await syncEmployeeEvents(employee.table_number, dateStart, dateStop, employee.object_bin);
    } catch (syncError) {
      console.error('Failed to sync events:', syncError);
      // Continue with cached data
    }

    // Get time records for the month (using PostgreSQL)
    const timeRecords = await db.queryRows(
      `SELECT 
         employee_number,
         to_char(date, 'YYYY-MM-DD') as date,
         check_in,
         check_out,
         hours_worked,
         status
       FROM time_records 
       WHERE employee_number = $1 
       AND date BETWEEN $2 AND $3
       ORDER BY date`,
      [employee.table_number, dateStart, dateStop]
    );
    
    console.log(`Found ${timeRecords.length} time records for ${employee.table_number}`);

    // Create a map of records by date with debug info
    const recordsMap = {};
    timeRecords.forEach(record => {
      // Normalize date format (YYYY-MM-DD)
      const dateKey = record.date instanceof Date 
        ? record.date.toISOString().split('T')[0]
        : record.date.toString().split('T')[0];
      recordsMap[dateKey] = record;
      console.log(`Mapped date key: ${dateKey}`);
    });

    // Generate calendar data
    const calendar = [];
    for (let day = 1; day <= lastDay; day++) {
      const date = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayOfWeek = new Date(date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const record = recordsMap[date];
      
      calendar.push({
        date,
        day,
        dayOfWeek,
        isWeekend,
        status: record ? record.status : (isWeekend ? 'weekend' : 'absent'),
        checkIn: record ? record.check_in : null,
        checkOut: record ? record.check_out : null,
        hoursWorked: record ? record.hours_worked : 0
      });
    }

    res.json({
      employee: {
        id: employee.id,
        fullName: employee.full_name,
        tableNumber: employee.table_number
      },
      year: parseInt(year),
      month: parseInt(month),
      calendar
    });
  } catch (error) {
    console.error('Error getting timesheet:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get employee statistics for a specific month
router.get('/employee/:id/statistics/:year/:month', async (req, res) => {
  const { id, year, month } = req.params;
  
  try {
    const dateStart = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateStop = `${year}-${month.padStart(2, '0')}-${lastDay}`;

    // Get employee info first
    const employee = await db.queryRow('SELECT * FROM employees WHERE id = $1', [id]);
    
    if (!employee) {
      console.log(`Employee not found for statistics ID: ${id}`);
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Get time records (using PostgreSQL)
    const timeRecords = await db.queryRows(
      `SELECT 
         employee_number,
         to_char(date, 'YYYY-MM-DD') as date,
         check_in,
         check_out,
         hours_worked,
         status
       FROM time_records 
       WHERE employee_number = $1 
       AND date BETWEEN $2 AND $3
       ORDER BY date`,
      [employee.table_number, dateStart, dateStop]
    );

    // Calculate statistics
    let totalHours = 0;
    let workDays = 0;
    let lateCount = 0;
    let earlyLeaves = 0;
    let onTimeCount = 0;
    let absentCount = 0;

    const detailedRecords = [];

    timeRecords.forEach(record => {
      totalHours += record.hours_worked || 0;
      workDays++;

      switch (record.status) {
        case 'late':
          lateCount++;
          break;
        case 'early_leave':
          earlyLeaves++;
          break;
        case 'on_time':
          onTimeCount++;
          break;
      }

      detailedRecords.push({
        date: record.date,
        checkIn: record.check_in,
        checkOut: record.check_out,
        hoursWorked: record.hours_worked,
        status: record.status
      });
    });

    // Calculate total working days (excluding weekends)
    let totalWorkingDays = 0;
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalWorkingDays++;
      }
    }

    absentCount = totalWorkingDays - workDays;

    res.json({
      period: {
        year: parseInt(year),
        month: parseInt(month),
        dateStart,
        dateStop
      },
      statistics: {
        totalHours: Math.round(totalHours * 10) / 10,
        workDays,
        totalWorkingDays,
        lateCount,
        earlyLeaves,
        onTimeCount,
        absentCount
      },
      detailedRecords
    });
  } catch (error) {
    console.error('Error getting statistics:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get employee time events for the last 2 months
router.get('/employee/:id/time-events', async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log(`Getting time events for employee ID: ${id}`);
    
    // Get employee info (using PostgreSQL)
    const employee = await db.queryRow('SELECT * FROM employees WHERE id = $1', [id]);

    if (!employee) {
      console.log(`Employee not found for time events ID: ${id}`);
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    console.log(`Found employee for time events: ${employee.full_name} (${employee.table_number})`);

    // Calculate date range (last 2 months)
    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    
    const dateFrom = twoMonthsAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    // Get time events grouped by date (using PostgreSQL)
    const timeEvents = await db.queryRows(
      `SELECT 
        DATE(event_datetime) as date,
        MIN(CASE WHEN event_type = '1' THEN event_datetime END) as first_entry,
        MAX(CASE WHEN event_type = '2' THEN event_datetime END) as last_exit,
        STRING_AGG(
          CASE 
            WHEN event_type = '1' THEN 'Вход: ' || TO_CHAR(event_datetime, 'HH24:MI')
            WHEN event_type = '2' THEN 'Выход: ' || TO_CHAR(event_datetime, 'HH24:MI')
            ELSE 'Событие: ' || TO_CHAR(event_datetime, 'HH24:MI')
          END, ' | '
        ) as all_events,
        COUNT(*) as event_count
      FROM time_events
      WHERE employee_number = $1
      AND DATE(event_datetime) BETWEEN $2 AND $3
      GROUP BY DATE(event_datetime)
      ORDER BY date DESC`,
      [employee.table_number, dateFrom, dateTo]
    );
    
    console.log(`Found ${timeEvents.length} event days for ${employee.table_number}`);

    // Calculate hours worked for each day
    const processedEvents = timeEvents.map(day => {
      let hoursWorked = null;
      let status = 'absent';
      
      if (day.first_entry && day.last_exit) {
        const inTime = new Date(day.first_entry);
        const outTime = new Date(day.last_exit);
        hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
        
        // Simplified logic - any entry means present
        status = 'present';
      } else if (day.first_entry) {
        status = 'present';
      }
      
      return {
        date: day.date,
        firstEntry: day.first_entry,
        lastExit: day.last_exit,
        hoursWorked: hoursWorked ? Math.round(hoursWorked * 10) / 10 : null,
        status,
        allEvents: day.all_events,
        eventCount: day.event_count
      };
    });

    res.json({
      employee: {
        id: employee.id,
        fullName: employee.full_name,
        tableNumber: employee.table_number
      },
      period: {
        dateFrom,
        dateTo
      },
      events: processedEvents
    });
  } catch (error) {
    console.error('Error getting time events:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Alternative endpoints using table_number instead of ID
router.get('/employee/by-number/:tableNumber/timesheet/:year/:month', async (req, res) => {
  const { tableNumber, year, month } = req.params;
  
  try {
    console.log(`Getting timesheet for employee table_number: ${tableNumber}`);
    
    // Get employee info by table_number
    const employee = await db.queryRow('SELECT * FROM employees WHERE table_number = $1', [tableNumber]);

    if (!employee) {
      console.log(`Employee not found for table_number: ${tableNumber}`);
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    console.log(`Found employee: ${employee.full_name} (${employee.table_number})`);

    // Calculate date range
    const dateStart = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateStop = `${year}-${month.padStart(2, '0')}-${lastDay}`;

    // Sync latest events from API
    try {
      await syncEmployeeEvents(employee.table_number, dateStart, dateStop, employee.object_bin);
    } catch (syncError) {
      console.error('Failed to sync events:', syncError);
      // Continue with cached data
    }

    // Get time records for the month (using PostgreSQL)
    const timeRecords = await db.queryRows(
      `SELECT 
         employee_number,
         to_char(date, 'YYYY-MM-DD') as date,
         check_in,
         check_out,
         hours_worked,
         status
       FROM time_records 
       WHERE employee_number = $1 
       AND date BETWEEN $2 AND $3
       ORDER BY date`,
      [employee.table_number, dateStart, dateStop]
    );
    
    console.log(`Found ${timeRecords.length} time records for ${employee.table_number}`);

    // Create a map of records by date with debug info
    const recordsMap = {};
    timeRecords.forEach(record => {
      // Normalize date format (YYYY-MM-DD)
      const dateKey = record.date instanceof Date 
        ? record.date.toISOString().split('T')[0]
        : record.date.toString().split('T')[0];
      recordsMap[dateKey] = record;
      console.log(`Mapped date key: ${dateKey}`);
    });

    // Get employee schedule for the month to determine work days
    const scheduleAssignment = await db.queryRow(`
      SELECT esa.schedule_code, esa.start_date, esa.end_date, ws.schedule_name
      FROM employee_schedule_assignments esa
      LEFT JOIN (
        SELECT DISTINCT schedule_code, schedule_name 
        FROM work_schedules_1c
      ) ws ON esa.schedule_code = ws.schedule_code
      WHERE esa.employee_number = $1 
      AND (esa.end_date IS NULL OR esa.end_date >= $2)
      ORDER BY esa.start_date DESC
      LIMIT 1
    `, [employee.table_number, dateStart]);

    // Get work days from schedule if exists
    let scheduleWorkDays = {};
    if (scheduleAssignment && scheduleAssignment.schedule_code) {
      const workDays = await db.queryRows(`
        SELECT 
          to_char(work_date, 'YYYY-MM-DD') as work_date,
          work_start_time,
          work_end_time,
          work_hours
        FROM work_schedules_1c 
        WHERE schedule_code = $1 
        AND work_date BETWEEN $2 AND $3
        AND work_hours > 0
      `, [scheduleAssignment.schedule_code, dateStart, dateStop]);
      
      workDays.forEach(workDay => {
        scheduleWorkDays[workDay.work_date] = {
          isWorkDay: true,
          startTime: workDay.work_start_time,
          endTime: workDay.work_end_time,
          workHours: workDay.work_hours
        };
      });
    }

    // Generate calendar data
    const calendar = [];
    for (let day = 1; day <= lastDay; day++) {
      const date = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayOfWeek = new Date(date).getDay();
      
      // Check if this is a work day according to schedule
      const scheduleDay = scheduleWorkDays[date];
      const isScheduledWorkDay = scheduleDay && scheduleDay.isWorkDay;
      
      // Use old logic as fallback if no schedule
      const isWeekend = !scheduleAssignment && (dayOfWeek === 0 || dayOfWeek === 6);
      
      const record = recordsMap[date];
      
      // Check if date is in the future (compare dates only, not time)
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const isFutureDate = date > today;
      
      // Function to normalize status to simplified logic
      const normalizeStatus = (status) => {
        switch (status) {
          case 'on_time':
          case 'late':
          case 'early_leave':
          case 'no_exit':
            return 'present';
          case 'absent':
            return 'absent';
          case 'weekend':
            return 'weekend';
          case 'planned':
            return 'planned';
          default:
            return status;
        }
      };

      // Determine status based on schedule or fallback to weekend logic
      let status;
      if (record) {
        status = normalizeStatus(record.status);
      } else if (isFutureDate && isScheduledWorkDay) {
        status = 'planned'; // Future work day with schedule
      } else if (isScheduledWorkDay) {
        status = 'absent'; // Past work day with no record
      } else if (scheduleAssignment && !isScheduledWorkDay) {
        status = 'weekend'; // Not a work day according to schedule
      } else {
        status = isWeekend ? 'weekend' : (isFutureDate ? 'planned' : 'absent'); // Fallback logic
      }
      
      calendar.push({
        date,
        day,
        dayOfWeek,
        isWeekend: !isScheduledWorkDay && (scheduleAssignment ? true : isWeekend),
        isScheduledWorkDay,
        scheduleStartTime: scheduleDay ? scheduleDay.startTime : null,
        scheduleEndTime: scheduleDay ? scheduleDay.endTime : null,
        scheduleHours: scheduleDay ? scheduleDay.workHours : null,
        status,
        checkIn: record ? record.check_in : null,
        checkOut: record ? record.check_out : null,
        hoursWorked: record ? record.hours_worked : 0
      });
    }

    res.json({
      employee: {
        id: employee.id,
        fullName: employee.full_name,
        tableNumber: employee.table_number
      },
      year: parseInt(year),
      month: parseInt(month),
      calendar
    });
  } catch (error) {
    console.error('Error getting timesheet by table_number:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.get('/employee/by-number/:tableNumber/time-events', async (req, res) => {
  const { tableNumber } = req.params;
  
  try {
    console.log(`Getting time events for employee table_number: ${tableNumber}`);
    
    // Get employee info by table_number
    const employee = await db.queryRow('SELECT * FROM employees WHERE table_number = $1', [tableNumber]);

    if (!employee) {
      console.log(`Employee not found for time events table_number: ${tableNumber}`);
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    console.log(`Found employee for time events: ${employee.full_name} (${employee.table_number})`);

    // Calculate date range (last 2 months)
    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    
    const dateFrom = twoMonthsAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    // Get time events grouped by date (using PostgreSQL)
    const timeEvents = await db.queryRows(
      `SELECT 
        DATE(event_datetime) as date,
        MIN(CASE WHEN event_type = '1' THEN event_datetime END) as first_entry,
        MAX(CASE WHEN event_type = '2' THEN event_datetime END) as last_exit,
        STRING_AGG(
          CASE 
            WHEN event_type = '1' THEN 'Вход: ' || TO_CHAR(event_datetime, 'HH24:MI')
            WHEN event_type = '2' THEN 'Выход: ' || TO_CHAR(event_datetime, 'HH24:MI')
            ELSE 'Событие: ' || TO_CHAR(event_datetime, 'HH24:MI')
          END, ' | '
        ) as all_events,
        COUNT(*) as event_count
      FROM time_events
      WHERE employee_number = $1
      AND DATE(event_datetime) BETWEEN $2 AND $3
      GROUP BY DATE(event_datetime)
      ORDER BY date DESC`,
      [employee.table_number, dateFrom, dateTo]
    );
    
    console.log(`Found ${timeEvents.length} event days for ${employee.table_number}`);

    // Calculate hours worked for each day
    const processedEvents = timeEvents.map(day => {
      let hoursWorked = null;
      let status = 'absent';
      
      if (day.first_entry && day.last_exit) {
        const inTime = new Date(day.first_entry);
        const outTime = new Date(day.last_exit);
        hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
        
        // Simplified logic - any entry means present
        status = 'present';
      } else if (day.first_entry) {
        status = 'present';
      }
      
      return {
        date: day.date,
        firstEntry: day.first_entry,
        lastExit: day.last_exit,
        hoursWorked: hoursWorked ? Math.round(hoursWorked * 10) / 10 : null,
        status,
        allEvents: day.all_events,
        eventCount: day.event_count
      };
    });

    res.json({
      employee: {
        id: employee.id,
        fullName: employee.full_name,
        tableNumber: employee.table_number
      },
      period: {
        dateFrom,
        dateTo
      },
      events: processedEvents
    });
  } catch (error) {
    console.error('Error getting time events by table_number:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get employee's current schedule for a specific month
router.get('/employee/by-number/:tableNumber/schedule/:year/:month', async (req, res) => {
  const { tableNumber, year, month } = req.params;
  
  try {
    console.log(`Getting schedule for employee ${tableNumber} for ${year}-${month}`);
    
    // Get employee's current schedule assignment
    const scheduleAssignment = await db.queryRow(`
      SELECT 
        esa.schedule_code,
        esa.start_date,
        esa.end_date,
        ws.schedule_name
      FROM employee_schedule_assignments esa
      LEFT JOIN (
        SELECT DISTINCT schedule_code, schedule_name 
        FROM work_schedules_1c
      ) ws ON esa.schedule_code = ws.schedule_code
      WHERE esa.employee_number = $1 
      AND (esa.end_date IS NULL OR esa.end_date >= $2)
      AND esa.start_date <= $3
      ORDER BY esa.start_date DESC
      LIMIT 1
    `, [
      tableNumber, 
      `${year}-${month.padStart(2, '0')}-01`,
      `${year}-${month.padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    ]);
    
    if (!scheduleAssignment) {
      console.log(`No schedule found for employee ${tableNumber}`);
      return res.json({
        success: true,
        hasSchedule: false,
        schedule: null,
        workDays: []
      });
    }
    
    console.log(`Found schedule: ${scheduleAssignment.schedule_name} (${scheduleAssignment.schedule_code})`);
    
    // Get work days for this schedule in the requested month
    const workDays = await db.queryRows(`
      SELECT 
        work_date,
        time_type,
        work_hours,
        work_start_time,
        work_end_time
      FROM work_schedules_1c
      WHERE schedule_code = $1
      AND EXTRACT(YEAR FROM work_date) = $2
      AND EXTRACT(MONTH FROM work_date) = $3
      ORDER BY work_date
    `, [scheduleAssignment.schedule_code, year, month]);
    
    console.log(`Found ${workDays.length} work days for schedule`);
    
    res.json({
      success: true,
      hasSchedule: true,
      schedule: {
        code: scheduleAssignment.schedule_code,
        name: scheduleAssignment.schedule_name,
        startDate: scheduleAssignment.start_date,
        endDate: scheduleAssignment.end_date
      },
      workDays: workDays.map(day => ({
        date: day.work_date,
        timeType: day.time_type,
        workHours: day.work_hours,
        startTime: day.work_start_time,
        endTime: day.work_end_time,
        isWorkDay: day.time_type === 'Рабочее'
      }))
    });
    
  } catch (error) {
    console.error('Error getting employee schedule:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get department statistics for current month
router.get('/employee/by-number/:tableNumber/department-stats/:year/:month', async (req, res) => {
  const { tableNumber, year, month } = req.params;
  
  try {
    console.log(`Getting department stats for employee ${tableNumber}, ${year}-${month}`);
    
    // First, get the employee and their department
    const employee = await db.queryRow(`
      SELECT e.*, d.object_name as department_name, d.object_code as department_code
      FROM employees e
      LEFT JOIN departments d ON e.object_code = d.object_code
      WHERE e.table_number = $1
    `, [tableNumber]);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    if (!employee.department_code) {
      return res.status(400).json({ error: 'Employee has no department assigned' });
    }
    
    console.log(`Employee department: ${employee.department_name} (Code: ${employee.department_code})`);
    
    // Get all employees in the same department
    const departmentEmployees = await db.queryRows(`
      SELECT e.id, e.table_number, e.full_name, e.object_code
      FROM employees e
      WHERE e.object_code = $1
      ORDER BY e.full_name
    `, [employee.object_code]);
    
    console.log(`Found ${departmentEmployees.length} employees in department`);
    console.log(`Looking for department stats for: ${tableNumber}`);
    
    // Get first and last day of the month
    const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayOfMonth = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    // Generate all days in the month
    const allDays = [];
    for (let day = 1; day <= lastDay; day++) {
      allDays.push(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
    }
    
    // Get time events for all employees in department for this month (first entry and last exit per day)
    const timeEvents = await db.queryRows(`
      WITH daily_events AS (
        SELECT 
          e.table_number,
          e.full_name,
          DATE(te.event_datetime) as event_date,
          MIN(te.event_datetime) as first_entry,
          MAX(te.event_datetime) as last_exit,
          COUNT(*) as event_count
        FROM time_events te
        JOIN employees e ON te.employee_number = e.table_number
        WHERE e.object_code = $1
        AND DATE(te.event_datetime) >= $2
        AND DATE(te.event_datetime) <= $3
        GROUP BY e.table_number, e.full_name, DATE(te.event_datetime)
      )
      SELECT * FROM daily_events
      ORDER BY event_date, full_name
    `, [employee.object_code, firstDay, lastDayOfMonth]);
    
    // Get schedule assignments for all employees in department
    const scheduleAssignments = await db.queryRows(`
      SELECT DISTINCT
        esa.employee_number,
        esa.schedule_code,
        ws1c.schedule_name,
        esa.start_date,
        esa.end_date
      FROM employee_schedule_assignments esa
      JOIN employees e ON esa.employee_number = e.table_number
      LEFT JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
      WHERE e.object_code = $1
      AND (esa.end_date IS NULL OR esa.end_date >= $2)
      AND esa.start_date <= $3
    `, [employee.object_code, firstDay, lastDayOfMonth]);
    
    // Get all work days for assigned schedules in this month
    const scheduleCodes = [...new Set(scheduleAssignments.map(sa => sa.schedule_code))];
    let workDaysSchedule = [];
    
    if (scheduleCodes.length > 0) {
      workDaysSchedule = await db.queryRows(`
        SELECT 
          schedule_code,
          work_date,
          time_type,
          work_hours,
          work_start_time,
          work_end_time
        FROM work_schedules_1c
        WHERE schedule_code = ANY($1)
        AND EXTRACT(YEAR FROM work_date) = $2
        AND EXTRACT(MONTH FROM work_date) = $3
        ORDER BY work_date
      `, [scheduleCodes, year, month]);
    }
    
    // Also get individual schedules for each employee in department
    const individualSchedules = {};
    for (const emp of departmentEmployees) {
      try {
        const empSchedule = await db.queryRow(`
          SELECT 
            esa.employee_number,
            esa.schedule_code,
            ws1c.schedule_name,
            esa.start_date,
            esa.end_date
          FROM employee_schedule_assignments esa
          LEFT JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
          WHERE esa.employee_number = $1
          AND (esa.end_date IS NULL OR esa.end_date >= $2)
          AND esa.start_date <= $3
          ORDER BY esa.created_at DESC
          LIMIT 1
        `, [emp.table_number, firstDay, lastDayOfMonth]);
        
        if (empSchedule) {
          console.log(`Individual schedule for ${emp.table_number}:`, {
            schedule_name: empSchedule.schedule_name,
            start_date: empSchedule.start_date,
            end_date: empSchedule.end_date
          });
          individualSchedules[emp.table_number] = empSchedule;
        } else {
          console.log(`No individual schedule found for ${emp.table_number}`);
        }
        
        if (empSchedule) {
          // Get work days for this employee's schedule
          const empWorkDays = await db.queryRows(`
            SELECT 
              schedule_code,
              work_date,
              time_type,
              work_hours,
              work_start_time,
              work_end_time
            FROM work_schedules_1c
            WHERE schedule_code = $1
            AND EXTRACT(YEAR FROM work_date) = $2
            AND EXTRACT(MONTH FROM work_date) = $3
            ORDER BY work_date
          `, [empSchedule.schedule_code, year, month]);
          
          // Add to workDaysSchedule if not already there
          empWorkDays.forEach(wd => {
            if (!workDaysSchedule.find(existing => 
              existing.schedule_code === wd.schedule_code && 
              existing.work_date.getTime() === wd.work_date.getTime()
            )) {
              workDaysSchedule.push(wd);
            }
          });
        }
      } catch (error) {
        console.log(`Could not get schedule for employee ${emp.table_number}:`, error.message);
      }
    }
    
    // Build result data structure
    const resultData = [];
    
    // For each day in the month
    allDays.forEach(date => {
      // For each employee in department
      departmentEmployees.forEach(emp => {
        // Get schedule for this employee on this date
        let assignment = scheduleAssignments.find(sa => {
          if (sa.employee_number !== emp.table_number) return false;
          
          const currentDate = new Date(date);
          const startDate = new Date(sa.start_date);
          const endDate = sa.end_date ? new Date(sa.end_date) : null;
          
          return currentDate >= startDate && (endDate === null || currentDate <= endDate);
        });
        
        // If not found in department assignments, check individual schedules
        if (!assignment && individualSchedules[emp.table_number]) {
          const indSchedule = individualSchedules[emp.table_number];
          const currentDate = new Date(date);
          const startDate = new Date(indSchedule.start_date);
          const endDate = indSchedule.end_date ? new Date(indSchedule.end_date) : null;
          
          if (currentDate >= startDate && 
              (endDate === null || currentDate <= endDate)) {
            assignment = indSchedule;
          }
        }
        
        // Get actual time events for this employee on this date (used in multiple places)
        const dayEvents = timeEvents.find(te => 
          te.table_number === emp.table_number &&
          te.event_date.toISOString().split('T')[0] === date
        );
        
        // If still no assignment but employee has actual time data,
        // use the most recent schedule assignment even if start_date is later
        if (!assignment && dayEvents && individualSchedules[emp.table_number]) {
          console.log(`Using fallback schedule for ${emp.table_number} on ${date}: ${individualSchedules[emp.table_number].schedule_name}`);
          assignment = individualSchedules[emp.table_number];
        }
        
        let scheduleData = null;
        if (assignment) {
          // First try to find specific work day record
          const workDay = workDaysSchedule.find(wd => 
            wd.schedule_code === assignment.schedule_code &&
            wd.work_date.toISOString().split('T')[0] === date
          );
          
          if (workDay) {
            // Use specific work day data
            scheduleData = {
              scheduleStartTime: workDay.work_start_time,
              scheduleEndTime: workDay.work_end_time,
              timeType: workDay.time_type,
              workHours: workDay.work_hours
            };
          } else {
            // If no specific work day found, try to get default times from schedule name
            const scheduleName = assignment.schedule_name || '';
            let defaultStartTime = null;
            let defaultEndTime = null;
            
            // Extract times from schedule name (e.g., "09:00-22:00/11мкр 1 смена")
            const timeMatch = scheduleName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
            if (timeMatch) {
              defaultStartTime = timeMatch[1] + ':00';
              defaultEndTime = timeMatch[2] + ':00';
            }
            
            // For weekdays, show default schedule even if no specific work_date record
            const dayOfWeek = new Date(date).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            if (defaultStartTime && defaultEndTime && !isWeekend) {
              scheduleData = {
                scheduleStartTime: defaultStartTime,
                scheduleEndTime: defaultEndTime,
                timeType: 'Рабочее',
                workHours: 8 // Default work hours
              };
            } else if (isWeekend) {
              scheduleData = {
                scheduleStartTime: null,
                scheduleEndTime: null,
                timeType: 'Выходной',
                workHours: 0
              };
            }
          }
        }
        
        // Determine status
        const dayOfWeek = new Date(date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Check if date is in the future (compare dates only, not time)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const isFutureDate = date > today;
        
        let status = 'absent';
        
        if (scheduleData) {
          if (scheduleData.timeType === 'Выходной') {
            status = 'weekend';
            // If employee worked on weekend day, show actual data
            if (dayEvents) {
              status = 'weekend_worked';
            }
          } else if (dayEvents) {
            // Has schedule and worked - simplified to just "present"
            status = 'present';
          } else {
            // Has schedule but didn't work
            status = isFutureDate ? 'planned' : 'absent';
          }
        } else {
          // No schedule
          if (isWeekend) {
            status = dayEvents ? 'weekend_worked' : 'weekend';
          } else {
            status = dayEvents ? 'present' : (isFutureDate ? 'planned' : 'absent');
          }
        }
        
        resultData.push({
          date: date,
          employeeName: emp.full_name,
          employeeTableNumber: emp.table_number,
          scheduleStartTime: scheduleData?.scheduleStartTime || null,
          scheduleEndTime: scheduleData?.scheduleEndTime || null,
          actualStartTime: dayEvents?.first_entry || null,
          actualEndTime: dayEvents?.last_exit || null,
          status: status,
          isWeekend: isWeekend
        });
      });
    });
    
    // Sort by date, then by employee name
    resultData.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.employeeName.localeCompare(b.employeeName);
    });
    
    res.json({
      success: true,
      departmentName: employee.department_name,
      employeeCount: departmentEmployees.length,
      period: {
        year: parseInt(year),
        month: parseInt(month),
        dateFrom: firstDay,
        dateTo: lastDayOfMonth
      },
      data: resultData
    });
    
  } catch (error) {
    console.error('Error getting department stats:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;