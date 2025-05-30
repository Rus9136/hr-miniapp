const express = require('express');
const router = express.Router();
const db = require('../database');
const apiSync = require('../utils/apiSync');

// Get all employees with department and position info
router.get('/admin/employees', (req, res) => {
    const query = `
        SELECT 
            e.*,
            d.object_name as department_name,
            p.staff_position_name as position_name
        FROM employees e
        LEFT JOIN departments d ON e.object_code = d.object_code
        LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
        ORDER BY e.full_name
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching employees:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(rows);
    });
});

// Get all departments
router.get('/admin/departments', (req, res) => {
    db.all(
        'SELECT * FROM departments ORDER BY object_name',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching departments:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json(rows);
        }
    );
});

// Get all positions
router.get('/admin/positions', (req, res) => {
    db.all(
        'SELECT * FROM positions ORDER BY staff_position_name',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching positions:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json(rows);
        }
    );
});

// Admin login check (for now, just check if it's admin12qw)
router.post('/admin/check', (req, res) => {
    const { tableNumber } = req.body;
    
    if (tableNumber === 'admin12qw') {
        res.json({
            isAdmin: true,
            message: 'Admin access granted'
        });
    } else {
        res.json({
            isAdmin: false,
            message: 'Not an admin'
        });
    }
});

// Sync employees from external API
router.post('/admin/sync/employees', async (req, res) => {
    try {
        console.log('Starting employee sync...');
        const count = await apiSync.syncEmployees();
        res.json({ 
            success: true, 
            message: `Синхронизировано ${count} сотрудников`,
            count: count
        });
    } catch (error) {
        console.error('Employee sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка синхронизации сотрудников: ' + error.message 
        });
    }
});

// Sync departments from external API
router.post('/admin/sync/departments', async (req, res) => {
    try {
        console.log('Starting department sync...');
        const count = await apiSync.syncDepartments();
        res.json({ 
            success: true, 
            message: `Синхронизировано ${count} подразделений`,
            count: count
        });
    } catch (error) {
        console.error('Department sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка синхронизации подразделений: ' + error.message 
        });
    }
});

// Sync positions from external API
router.post('/admin/sync/positions', async (req, res) => {
    try {
        console.log('Starting position sync...');
        const count = await apiSync.syncPositions();
        res.json({ 
            success: true, 
            message: `Синхронизировано ${count} должностей`,
            count: count
        });
    } catch (error) {
        console.error('Position sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка синхронизации должностей: ' + error.message 
        });
    }
});

// Load time events from external API
router.post('/admin/load/timesheet', async (req, res) => {
    try {
        const { tableNumber, dateFrom, dateTo, objectBin } = req.body;
        
        if (!dateFrom || !dateTo) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать даты начала и конца периода' 
            });
        }

        console.log('Loading timesheet data:', { tableNumber, dateFrom, dateTo, objectBin });
        
        // Загрузка событий из внешнего API
        const events = await apiSync.loadTimeEvents({
            tableNumber,
            dateFrom,
            dateTo,
            objectBin
        });

        // Обработка и сохранение событий
        const processed = await apiSync.processTimeRecords(events);
        
        res.json({ 
            success: true, 
            message: `Загружено ${events.length} событий, обработано ${processed} записей`,
            eventsCount: events.length,
            recordsCount: processed
        });
    } catch (error) {
        console.error('Timesheet load error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки табельных данных: ' + error.message 
        });
    }
});

// Get organizations for dropdown
router.get('/admin/organizations', (req, res) => {
    db.all(
        'SELECT DISTINCT object_bin, object_company FROM departments WHERE object_company IS NOT NULL ORDER BY object_company',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching organizations:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json(rows);
        }
    );
});

module.exports = router;