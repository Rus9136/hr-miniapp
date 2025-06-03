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
        
        // Determine status
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
      } else if (day.first_entry) {
        status = 'no_exit';
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
        
        // Determine status
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
      } else if (day.first_entry) {
        status = 'no_exit';
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

module.exports = router;