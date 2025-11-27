/**
 * Модуль управления сотрудниками
 * Эндпоинты: /admin/employees, /admin/sync/employees, /admin/employees/update-iin
 */

const express = require('express');
const router = express.Router();
const db = require('../../database_pg');
const apiSync = require('../../utils/apiSync_pg');

/**
 * GET /admin/employees
 * Получение списка сотрудников с пагинацией и фильтрацией
 * Query params:
 *   - page: номер страницы (default: 1)
 *   - limit: записей на страницу (default: 50)
 *   - search: поиск по ФИО или табельному номеру
 *   - organization: фильтр по БИН организации
 */
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const organization = req.query.organization?.trim() || '';

        // Build WHERE conditions
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`(e.full_name ILIKE $${paramIndex} OR e.table_number ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (organization) {
            conditions.push(`e.object_bin = $${paramIndex}`);
            params.push(organization);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total records
        const countQuery = `
            SELECT COUNT(*) as total
            FROM employees e
            ${whereClause}
        `;
        const countResult = await db.queryRow(countQuery, params);
        const total = parseInt(countResult.total);
        const totalPages = Math.ceil(total / limit);

        // Get paginated data
        const dataQuery = `
            SELECT
                e.*,
                d.object_name as department_name,
                p.staff_position_name as position_name,
                e.object_bin,
                e.iin,
                ws.schedule_name as current_schedule
            FROM employees e
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN (
                SELECT DISTINCT ON (esa.employee_number)
                    esa.employee_number,
                    ws1c.schedule_name
                FROM employee_schedule_assignments esa
                LEFT JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
                WHERE esa.end_date IS NULL
                ORDER BY esa.employee_number, esa.created_at DESC
            ) ws ON e.table_number = ws.employee_number
            ${whereClause}
            ORDER BY e.full_name
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const employees = await db.queryRows(dataQuery, [...params, limit, offset]);

        res.json({
            employees,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /admin/sync/employees
 * Синхронизация сотрудников из внешнего API
 */
router.post('/sync', async (req, res) => {
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

/**
 * POST /admin/employees/update-iin
 * Обновление ИИН и ФОТ сотрудников из 1С
 */
router.post('/update-iin', async (req, res) => {
    try {
        const employees = req.body;
        
        console.log('Received employee data update request for', employees?.length || 0, 'employees');
        
        // Validation
        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Нет данных для обновления. Ожидается массив сотрудников.'
            });
        }
        
        let totalProcessed = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let errors = [];
        
        // Process each employee
        for (const employee of employees) {
            try {
                const { iin, table_number, payroll, full_name } = employee;
                
                // Validate employee data - require at least table_number and one of iin/payroll/full_name
                if (!table_number || (!iin && payroll === undefined && !full_name)) {
                    errors.push(`Неполные данные: табельный номер=${table_number}, ИИН=${iin}, ФОТ=${payroll}, ФИО=${full_name}`);
                    totalSkipped++;
                    continue;
                }
                
                // Validate IIN format if provided (12 digits)
                if (iin && !/^\d{12}$/.test(iin)) {
                    errors.push(`Неверный формат ИИН ${iin} для табельного номера ${table_number}. Ожидается 12 цифр.`);
                    totalSkipped++;
                    continue;
                }
                
                // Process and validate payroll format if provided
                let processedPayroll = payroll;
                if (payroll !== undefined) {
                    try {
                        // Handle payroll as string with spaces (from 1C)
                        if (typeof payroll === 'string') {
                            // Remove all types of spaces: regular space, non-breaking space, etc.
                            processedPayroll = payroll.replace(/\s/g, '').replace(/\u00A0/g, '');
                            
                            // If empty string after cleaning, treat as undefined
                            if (processedPayroll === '') {
                                processedPayroll = undefined;
                            }
                        }
                        
                        // Convert to number and validate
                        if (processedPayroll !== undefined) {
                            processedPayroll = parseFloat(processedPayroll);
                            
                            if (isNaN(processedPayroll) || processedPayroll < 0) {
                                errors.push(`Неверный формат ФОТ "${payroll}" для табельного номера ${table_number}. Ожидается положительное число.`);
                                totalSkipped++;
                                continue;
                            }
                        }
                    } catch (error) {
                        errors.push(`Ошибка обработки ФОТ "${payroll}" для табельного номера ${table_number}: ${error.message}`);
                        totalSkipped++;
                        continue;
                    }
                }
                
                console.log(`Processing employee: ${table_number}${iin ? ` with IIN: ${iin}` : ''}${processedPayroll !== undefined ? ` with payroll: ${processedPayroll} (original: "${payroll}")` : ''}${full_name ? ` with full_name: ${full_name}` : ''}`);
                
                // Check if employee exists
                const checkResult = await db.query(
                    'SELECT id, iin, payroll, full_name FROM employees WHERE table_number = $1',
                    [table_number]
                );
                
                if (checkResult.rows.length === 0) {
                    console.log(`Employee not found: ${table_number}`);
                    totalSkipped++;
                    continue;
                }
                
                const existingEmployee = checkResult.rows[0];
                
                // Prepare update fields and values
                let updateFields = [];
                let updateValues = [];
                let paramIndex = 1;
                let hasUpdates = false;
                
                // Handle IIN update
                if (iin) {
                    if (existingEmployee.iin === null || existingEmployee.iin === '') {
                        updateFields.push(`iin = $${paramIndex++}`);
                        updateValues.push(iin);
                        hasUpdates = true;
                        console.log(`  - Will update IIN: ${iin}`);
                    } else {
                        console.log(`  - Employee ${table_number} already has IIN: ${existingEmployee.iin}, skipping IIN update`);
                    }
                }
                
                // Handle payroll update (always update if provided)
                if (processedPayroll !== undefined) {
                    updateFields.push(`payroll = $${paramIndex++}`);
                    updateValues.push(processedPayroll);
                    hasUpdates = true;
                    console.log(`  - Will update payroll: ${processedPayroll} (original: "${payroll}", previous: ${existingEmployee.payroll})`);
                }
                
                // Handle full_name update (always update if provided)
                if (full_name) {
                    updateFields.push(`full_name = $${paramIndex++}`);
                    updateValues.push(full_name);
                    hasUpdates = true;
                    console.log(`  - Will update full_name: ${full_name} (previous: ${existingEmployee.full_name})`);
                }
                
                // Skip if no updates needed
                if (!hasUpdates) {
                    console.log(`  - No updates needed for employee ${table_number}`);
                    totalSkipped++;
                    continue;
                }
                
                // Add updated_at field
                updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
                updateValues.push(table_number); // WHERE clause parameter
                
                // Build and execute update query
                const updateQuery = `
                    UPDATE employees 
                    SET ${updateFields.join(', ')}
                    WHERE table_number = $${paramIndex}
                `;
                
                const updateResult = await db.query(updateQuery, updateValues);
                
                if (updateResult.rowCount > 0) {
                    console.log(`  ✅ Successfully updated employee: ${table_number}`);
                    totalUpdated++;
                } else {
                    console.log(`  ❌ No rows updated for employee: ${table_number}`);
                    totalSkipped++;
                }
                
                totalProcessed++;
                
            } catch (employeeError) {
                const errorMsg = `Ошибка обработки сотрудника ${employee.table_number || 'UNKNOWN'}: ${employeeError.message}`;
                console.error(errorMsg, employeeError);
                errors.push(errorMsg);
                totalSkipped++;
            }
        }
        
        const response = {
            success: true,
            message: `Статус ОК, обновлено ${totalUpdated} записей`,
            statistics: {
                totalReceived: employees.length,
                totalProcessed: totalProcessed,
                totalUpdated: totalUpdated,
                totalSkipped: totalSkipped,
                errorsCount: errors.length
            },
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit errors to first 10
        };
        
        console.log('Employee data update completed:', response.statistics);
        res.json(response);
        
    } catch (error) {
        console.error('Error updating employee data:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка обновления данных сотрудников: ' + error.message
        });
    }
});

/**
 * GET /admin/employees/:employee_number/current-schedule
 * Получение текущего графика сотрудника
 */
router.get('/:employee_number/current-schedule', async (req, res) => {
    try {
        const { employee_number } = req.params;
        
        const currentSchedule = await db.queryRow(`
            SELECT 
                esa.id,
                esa.employee_number,
                e.full_name as employee_name,
                esa.schedule_code,
                ws.schedule_name,
                esa.start_date,
                esa.assigned_by,
                esa.created_at
            FROM employee_schedule_assignments esa
            LEFT JOIN employees e ON esa.employee_id = e.id
            LEFT JOIN (
                SELECT DISTINCT schedule_code, schedule_name 
                FROM work_schedules_1c
            ) ws ON esa.schedule_code = ws.schedule_code
            WHERE esa.employee_number = $1 AND esa.end_date IS NULL
        `, [employee_number]);
        
        if (!currentSchedule) {
            return res.json({
                success: false,
                message: 'У сотрудника нет активного графика'
            });
        }
        
        res.json({
            success: true,
            schedule: currentSchedule
        });
        
    } catch (error) {
        console.error('Error fetching current schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /admin/employees/:employee_number/schedule-history
 * Получение истории графиков сотрудника
 */
router.get('/:employee_number/schedule-history', async (req, res) => {
    try {
        const { employee_number } = req.params;
        
        const history = await db.queryRows(`
            SELECT 
                esa.id,
                esa.schedule_code,
                ws.schedule_name,
                esa.start_date,
                esa.end_date,
                esa.assigned_by,
                esa.created_at,
                CASE 
                    WHEN esa.end_date IS NULL THEN 'active'
                    ELSE 'ended'
                END as status
            FROM employee_schedule_assignments esa
            LEFT JOIN (
                SELECT DISTINCT schedule_code, schedule_name 
                FROM work_schedules_1c
            ) ws ON esa.schedule_code = ws.schedule_code
            WHERE esa.employee_number = $1
            ORDER BY esa.start_date DESC
        `, [employee_number]);
        
        res.json({
            success: true,
            employee_number,
            history
        });
        
    } catch (error) {
        console.error('Error fetching schedule history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;



