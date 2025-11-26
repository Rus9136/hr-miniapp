/**
 * Модуль управления подразделениями
 * Эндпоинты: /admin/departments, /admin/sync/departments, /admin/positions, /admin/sync/positions
 */

const express = require('express');
const router = express.Router();
const db = require('../../database_pg');
const apiSync = require('../../utils/apiSync_pg');

/**
 * GET /admin/departments
 * Получение списка всех подразделений (с опциональной фильтрацией по организации)
 */
router.get('/', async (req, res) => {
    try {
        const { organization } = req.query;
        
        let query = 'SELECT *, id_iiko::text as id_iiko FROM departments';
        let params = [];
        
        if (organization) {
            query += ' WHERE object_bin = $1';
            params.push(organization);
        }
        
        query += ' ORDER BY object_name';
        
        console.log('Departments query:', query, 'params:', params);
        const rows = await db.queryRows(query, params);
        console.log(`Found ${rows.length} departments for organization: ${organization || 'all'}`);
        
        res.json(rows);
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /admin/departments/:id
 * Получение подразделения по ID или id_iiko
 */
router.get('/:id', async (req, res) => {
    try {
        const identifier = req.params.id;
        
        console.log(`Getting department with identifier: ${identifier}`);
        
        // Check if the identifier is a UUID (id_iiko format)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
        
        let query;
        let queryParam;
        
        if (isUUID) {
            // Search by id_iiko
            console.log('Searching by id_iiko (UUID format)');
            query = `
                SELECT 
                    id,
                    id_iiko::text as id_iiko,
                    object_name,
                    object_code,
                    object_parent,
                    object_company,
                    object_bin,
                    hall_area,
                    kitchen_area,
                    seats_count,
                    trade_point
                FROM departments 
                WHERE id_iiko = $1
            `;
            queryParam = identifier;
        } else {
            // Search by numeric ID
            console.log('Searching by numeric ID');
            query = `
                SELECT 
                    id,
                    id_iiko::text as id_iiko,
                    object_name,
                    object_code,
                    object_parent,
                    object_company,
                    object_bin,
                    hall_area,
                    kitchen_area,
                    seats_count,
                    trade_point
                FROM departments 
                WHERE id = $1
            `;
            queryParam = identifier;
        }
        
        const rows = await db.queryRows(query, [queryParam]);
        
        if (rows.length === 0) {
            const identifierType = isUUID ? 'id_iiko' : 'ID';
            return res.status(404).json({ 
                error: 'Department not found',
                message: `Подразделение с ${identifierType} ${identifier} не найдено`
            });
        }
        
        console.log('Department found:', rows[0]);
        
        // Return the department data
        res.json(rows[0]);
        
    } catch (err) {
        console.error('Error fetching department:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Ошибка при получении данных подразделения'
        });
    }
});

/**
 * PUT /admin/departments/:id
 * Обновление подразделения
 */
router.put('/:id', async (req, res) => {
    try {
        const departmentId = req.params.id;
        const { id_iiko, hall_area, kitchen_area, seats_count, trade_point } = req.body;
        
        console.log(`Updating department ${departmentId} with data:`, { id_iiko, hall_area, kitchen_area, seats_count, trade_point });
        
        // Validate input
        if (!departmentId || isNaN(departmentId)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный ID подразделения'
            });
        }
        
        // Check if department exists
        const existingDept = await db.queryRow(
            'SELECT * FROM departments WHERE id = $1',
            [departmentId]
        );
        
        if (!existingDept) {
            return res.status(404).json({
                success: false,
                error: 'Подразделение не найдено'
            });
        }
        
        // Validate UUID format if id_iiko is provided
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (id_iiko && id_iiko.trim() !== '' && !uuidRegex.test(id_iiko)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный формат UUID для ID IIKO. Ожидается формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
            });
        }
        
        // Validate area fields (must be positive numbers if provided)
        if (hall_area !== undefined && hall_area !== null && hall_area !== '') {
            const hallAreaNum = parseFloat(hall_area);
            if (isNaN(hallAreaNum) || hallAreaNum <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Площадь зала должна быть положительным числом'
                });
            }
        }
        
        if (kitchen_area !== undefined && kitchen_area !== null && kitchen_area !== '') {
            const kitchenAreaNum = parseFloat(kitchen_area);
            if (isNaN(kitchenAreaNum) || kitchenAreaNum <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Площадь кухни должна быть положительным числом'
                });
            }
        }
        
        // Validate seats_count (must be non-negative integer if provided)
        if (seats_count !== undefined && seats_count !== null && seats_count !== '') {
            const seatsNum = parseInt(seats_count);
            if (isNaN(seatsNum) || seatsNum < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Количество посадочных мест должно быть неотрицательным целым числом'
                });
            }
        }
        
        // Prepare update data
        const updateIdIiko = id_iiko && id_iiko.trim() !== '' ? id_iiko.trim() : null;
        const updateHallArea = hall_area && hall_area !== '' ? parseFloat(hall_area) : null;
        const updateKitchenArea = kitchen_area && kitchen_area !== '' ? parseFloat(kitchen_area) : null;
        const updateSeatsCount = seats_count && seats_count !== '' ? parseInt(seats_count) : null;
        const updateTradePoint = trade_point !== undefined ? trade_point : null;
        
        // Update department
        const updateResult = await db.query(
            'UPDATE departments SET id_iiko = $1, hall_area = $2, kitchen_area = $3, seats_count = $4, trade_point = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
            [updateIdIiko, updateHallArea, updateKitchenArea, updateSeatsCount, updateTradePoint, departmentId]
        );
        
        if (updateResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Не удалось обновить подразделение'
            });
        }
        
        // Get updated department data
        const updatedDept = await db.queryRow(
            'SELECT *, id_iiko::text as id_iiko FROM departments WHERE id = $1',
            [departmentId]
        );
        
        console.log(`✅ Successfully updated department ${departmentId}`);
        
        res.json({
            success: true,
            message: 'Подразделение успешно обновлено',
            data: updatedDept
        });
        
    } catch (error) {
        console.error('Error updating department:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при обновлении подразделения'
        });
    }
});

/**
 * POST /admin/sync/departments
 * Синхронизация подразделений из внешнего API
 */
router.post('/sync', async (req, res) => {
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

/**
 * GET /admin/positions
 * Получение списка всех должностей
 */
router.get('/positions/list', async (req, res) => {
    try {
        const rows = await db.queryRows('SELECT * FROM positions ORDER BY staff_position_name');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching positions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /admin/sync/positions
 * Синхронизация должностей из внешнего API
 */
router.post('/positions/sync', async (req, res) => {
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

module.exports = router;



