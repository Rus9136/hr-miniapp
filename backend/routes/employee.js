const express = require('express');
const router = express.Router();
const db = require('../database');
const { syncEmployeeEvents } = require('../utils/apiSync');

// Get employee timesheet for a specific month
router.get('/employee/:id/timesheet/:year/:month', async (req, res) => {
  const { id, year, month } = req.params;
  
  try {
    // Get employee info
    const employee = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM employees WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

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

    // Get time records for the month
    const timeRecords = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM time_records 
         WHERE employee_id = ? 
         AND date BETWEEN ? AND ?
         ORDER BY date`,
        [id, dateStart, dateStop],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Create a map of records by date
    const recordsMap = {};
    timeRecords.forEach(record => {
      recordsMap[record.date] = record;
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
    console.error('Error getting timesheet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get employee statistics for a specific month
router.get('/employee/:id/statistics/:year/:month', async (req, res) => {
  const { id, year, month } = req.params;
  
  try {
    const dateStart = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateStop = `${year}-${month.padStart(2, '0')}-${lastDay}`;

    // Get time records
    const timeRecords = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM time_records 
         WHERE employee_id = ? 
         AND date BETWEEN ? AND ?
         ORDER BY date`,
        [id, dateStart, dateStop],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

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
    console.error('Error getting statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get employee time events for the last 2 months
router.get('/employee/:id/time-events', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get employee info
    const employee = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM employees WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Calculate date range (last 2 months)
    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    
    const dateFrom = twoMonthsAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    // Get time events grouped by date
    const timeEvents = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          date(event_datetime) as date,
          MIN(CASE WHEN event_type = '1' THEN event_datetime END) as first_entry,
          MAX(CASE WHEN event_type = '2' THEN event_datetime END) as last_exit,
          GROUP_CONCAT(
            CASE 
              WHEN event_type = '1' THEN 'Вход: ' || time(event_datetime)
              WHEN event_type = '2' THEN 'Выход: ' || time(event_datetime)
              ELSE 'Событие: ' || time(event_datetime)
            END, ' | '
          ) as all_events,
          COUNT(*) as event_count
        FROM time_events
        WHERE employee_number = ?
        AND date(event_datetime) BETWEEN ? AND ?
        GROUP BY date(event_datetime)
        ORDER BY date DESC`,
        [employee.table_number, dateFrom, dateTo],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

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
    console.error('Error getting time events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;