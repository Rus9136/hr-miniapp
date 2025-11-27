/**
 * Модуль управления графиками работы
 * Эндпоинты: /admin/schedules/templates, /admin/schedules/1c, /admin/schedules/assign
 */

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const db = require('../../database_pg');
const { debugLog, extractWorkTimesFromScheduleName } = require('./helpers');

// Create special parser for large 1C imports
const largeJsonParser = bodyParser.json({ limit: '100mb' });

// ==================== SCHEDULE TEMPLATES ====================

/**
 * GET /admin/schedules/templates
 * Получение всех шаблонов графиков
 */
router.get('/templates', async (req, res) => {
    try {
        const query = `
            SELECT 
                t.*,
                COUNT(DISTINCT esh.employee_id) as employee_count,
                STRING_AGG(DISTINCT d.object_company, ', ') as organizations,
                COUNT(DISTINCT wsd.work_date) as work_days_count
            FROM work_schedule_templates t
            LEFT JOIN employee_schedule_history esh ON t.id = esh.template_id AND esh.end_date IS NULL
            LEFT JOIN employees e ON esh.employee_id = e.id
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN work_schedule_dates wsd ON t.id = wsd.template_id
            WHERE t.is_active = true
            GROUP BY t.id
            ORDER BY t.name
        `;
        
        const templates = await db.queryRows(query);
        res.json(templates);
    } catch (error) {
        console.error('Error fetching schedule templates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /admin/schedules/templates/:id
 * Получение шаблона графика с датами
 */
router.get('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get template
        const template = await db.queryRow(
            'SELECT * FROM work_schedule_templates WHERE id = $1',
            [id]
        );
        
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Get work dates
        const dates = await db.queryRows(
            'SELECT * FROM work_schedule_dates WHERE template_id = $1 ORDER BY work_date',
            [id]
        );
        
        // Get assigned employees with departments
        const employees = await db.queryRows(`
            SELECT 
                e.id,
                e.full_name,
                e.table_number,
                d.object_name as department_name,
                d.object_company as organization,
                esh.start_date
            FROM employee_schedule_history esh
            JOIN employees e ON esh.employee_id = e.id
            LEFT JOIN departments d ON e.object_code = d.object_code
            WHERE esh.template_id = $1 AND esh.end_date IS NULL
            ORDER BY d.object_company, d.object_name, e.full_name
        `, [id]);
        
        res.json({ template, dates, employees });
    } catch (error) {
        console.error('Error fetching schedule template:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /admin/schedules/templates
 * Создание нового шаблона графика
 */
router.post('/templates', async (req, res) => {
    try {
        const { name, description, check_in_time, check_out_time, dates } = req.body;
        
        // Start transaction
        await db.query('BEGIN');
        
        // Create template
        const templateResult = await db.queryRow(`
            INSERT INTO work_schedule_templates 
            (name, description, check_in_time, check_out_time, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING *
        `, [name, description, check_in_time || '09:00', check_out_time || '18:00']);
        
        // Create dates
        if (dates && dates.length > 0) {
            for (const date of dates) {
                await db.query(`
                    INSERT INTO work_schedule_dates
                    (template_id, work_date)
                    VALUES ($1, $2)
                `, [templateResult.id, date]);
            }
        }
        
        await db.query('COMMIT');
        res.json({ success: true, template: templateResult });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error creating schedule template:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /admin/schedules/templates/:id
 * Обновление шаблона графика
 */
router.put('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, check_in_time, check_out_time, dates } = req.body;
        
        await db.query('BEGIN');
        
        // Update template
        const templateResult = await db.queryRow(`
            UPDATE work_schedule_templates 
            SET name = $1, description = $2, check_in_time = $3, check_out_time = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [name, description, check_in_time, check_out_time, id]);
        
        if (!templateResult) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Update dates if provided
        if (dates !== undefined) {
            // Delete existing dates
            await db.query('DELETE FROM work_schedule_dates WHERE template_id = $1', [id]);
            
            // Insert new dates
            if (dates.length > 0) {
                for (const date of dates) {
                    await db.query(`
                        INSERT INTO work_schedule_dates
                        (template_id, work_date)
                        VALUES ($1, $2)
                    `, [id, date]);
                }
            }
        }
        
        await db.query('COMMIT');
        res.json({ success: true, template: templateResult });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error updating schedule template:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /admin/schedules/assign
 * Назначение графика сотрудникам
 */
router.post('/assign', async (req, res) => {
    try {
        const { template_id, employee_ids, start_date, assigned_by } = req.body;
        
        // Improved validation
        if (!template_id || !employee_ids || !start_date) {
            return res.status(400).json({ 
                success: false,
                error: 'Необходимо указать шаблон графика, сотрудников и дату начала' 
            });
        }
        
        // Validate employee_ids is an array
        if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Необходимо выбрать хотя бы одного сотрудника' 
            });
        }
        
        // Check if template exists
        const template = await db.queryRow(
            'SELECT id, name FROM work_schedule_templates WHERE id = $1 AND is_active = true',
            [template_id]
        );
        
        if (!template) {
            return res.status(400).json({ 
                success: false,
                error: 'Указанный шаблон графика не найден или неактивен' 
            });
        }
        
        console.log(`Assigning schedule "${template.name}" to ${employee_ids.length} employees from ${start_date}`);
        
        await db.query('BEGIN');
        
        let assignedCount = 0;
        let skippedCount = 0;
        const errors = [];
        
        for (const employee_id of employee_ids) {
            try {
                // Get employee info
                const employee = await db.queryRow(
                    'SELECT id, table_number, full_name FROM employees WHERE id = $1',
                    [employee_id]
                );
                
                if (!employee) {
                    errors.push(`Сотрудник с ID ${employee_id} не найден`);
                    skippedCount++;
                    continue;
                }
                
                console.log(`Processing employee: ${employee.full_name} (${employee.table_number})`);
                
                // Check for overlapping schedules in the future
                const existingSchedule = await db.queryRow(`
                    SELECT 
                        esh.id,
                        esh.start_date,
                        esh.end_date,
                        wst.name as template_name
                    FROM employee_schedule_history esh
                    JOIN work_schedule_templates wst ON esh.template_id = wst.id
                    WHERE esh.employee_id = $1 
                    AND (
                        esh.end_date IS NULL 
                        OR esh.end_date >= $2::date
                    )
                    AND esh.start_date <= $2::date
                `, [employee_id, start_date]);
                
                if (existingSchedule) {
                    console.log(`Found existing schedule for ${employee.full_name}: ${existingSchedule.template_name} from ${existingSchedule.start_date}`);
                    
                    // Check if new start date is after existing start date
                    const newStartDate = new Date(start_date);
                    const existingStartDate = new Date(existingSchedule.start_date);
                    
                    if (newStartDate > existingStartDate) {
                        // End current schedule the day before the new one starts
                        const endDate = new Date(start_date);
                        endDate.setDate(endDate.getDate() - 1);
                        const endDateStr = endDate.toISOString().split('T')[0];
                        
                        await db.query(`
                            UPDATE employee_schedule_history 
                            SET end_date = $1::date
                            WHERE id = $2
                        `, [endDateStr, existingSchedule.id]);
                        
                        console.log(`Ended previous schedule for ${employee.full_name} on ${endDateStr}`);
                    } else {
                        // New schedule starts before or same as existing - remove existing schedule entirely
                        await db.query(`
                            DELETE FROM employee_schedule_history 
                            WHERE id = $1
                        `, [existingSchedule.id]);
                        
                        console.log(`Removed previous schedule for ${employee.full_name} (conflicting dates)`);
                    }
                }
                
                // Create new schedule assignment
                await db.query(`
                    INSERT INTO employee_schedule_history
                    (employee_id, employee_number, template_id, start_date, assigned_by)
                    VALUES ($1, $2, $3, $4, $5)
                `, [employee_id, employee.table_number, template_id, start_date, assigned_by || 'admin']);
                
                console.log(`Assigned new schedule to ${employee.full_name} from ${start_date}`);
                assignedCount++;
                
            } catch (empError) {
                console.error(`Error processing employee ${employee_id}:`, empError);
                errors.push(`Ошибка для сотрудника ${employee_id}: ${empError.message}`);
                skippedCount++;
            }
        }
        
        await db.query('COMMIT');
        
        let message = `График "${template.name}" назначен ${assignedCount} сотрудникам`;
        if (skippedCount > 0) {
            message += `, пропущено ${skippedCount} сотрудников`;
        }
        
        console.log(`Assignment completed: ${assignedCount} assigned, ${skippedCount} skipped`);
        
        res.json({ 
            success: true, 
            message: message,
            assignedCount,
            skippedCount,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error assigning schedule:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка при назначении графика: ' + error.message 
        });
    }
});

/**
 * GET /admin/schedules/available-employees
 * Получение сотрудников для назначения графика (с фильтрами)
 */
router.get('/available-employees', async (req, res) => {
    try {
        const { organization, department, position } = req.query;
        
        let query = `
            SELECT 
                e.id,
                e.full_name,
                e.table_number,
                d.object_name as department_name,
                p.staff_position_name as position_name,
                d.object_company as organization,
                wst.name as current_schedule
            FROM employees e
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN employee_schedule_history esh ON e.id = esh.employee_id AND esh.end_date IS NULL
            LEFT JOIN work_schedule_templates wst ON esh.template_id = wst.id
            WHERE e.status = 1
        `;
        
        const params = [];
        
        if (organization) {
            query += ` AND e.object_bin = $${params.length + 1}`;
            params.push(organization);
        }
        
        if (department) {
            query += ` AND e.object_code = $${params.length + 1}`;
            params.push(department);
        }
        
        if (position) {
            query += ` AND e.staff_position_code = $${params.length + 1}`;
            params.push(position);
        }
        
        query += ` ORDER BY d.object_company, d.object_name, e.full_name`;
        
        const employees = await db.queryRows(query, params);
        res.json(employees);
    } catch (error) {
        console.error('Error fetching available employees:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /admin/schedules/employee/:employeeId/history
 * Получение истории графиков сотрудника
 */
router.get('/employee/:employeeId/history', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        const history = await db.queryRows(`
            SELECT 
                esh.*,
                wst.name as template_name,
                wst.schedule_type
            FROM employee_schedule_history esh
            JOIN work_schedule_templates wst ON esh.template_id = wst.id
            WHERE esh.employee_id = $1
            ORDER BY esh.start_date DESC
        `, [employeeId]);
        
        res.json(history);
    } catch (error) {
        console.error('Error fetching employee schedule history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== 1C SCHEDULES ====================

/**
 * POST /admin/schedules/import-1c
 * Импорт графиков работы из 1С
 */
router.post('/import-1c', largeJsonParser, async (req, res) => {
    try {
        const { ДатаВыгрузки, КоличествоГрафиков, Графики } = req.body;
        
        console.log('Received 1C schedules import request:', {
            exportDate: ДатаВыгрузки,
            schedulesCount: КоличествоГрафиков,
            schedulesReceived: Графики?.length || 0
        });
        
        // Log first schedule's organizations if available (support both field names)
        if (Графики && Графики.length > 0) {
            const firstScheduleOrgs = Графики[0].Организации || Графики[0].БИНОрганизации;
            const fieldName = Графики[0].Организации ? 'Организации' : Графики[0].БИНОрганизации ? 'БИНОрганизации' : 'none';
            if (firstScheduleOrgs) {
                console.error(`[STDERR] First schedule has organizations (field: ${fieldName}):`, firstScheduleOrgs);
            } else {
                console.error(`[STDERR] First schedule has NO organizations field or it's empty`);
            }
        }
        
        // Basic validation
        if (!Графики || !Array.isArray(Графики) || Графики.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Нет данных для импорта. Массив "Графики" отсутствует или пуст.'
            });
        }
        
        let totalProcessed = 0;
        let totalInserted = 0;
        let totalUpdated = 0;
        let errors = [];
        
        // Process each schedule
        for (const график of Графики) {
            // Get a client from the pool for this transaction
            const client = await db.pool.connect();
            
            try {
                const { НаименованиеГрафика, КодГрафика, РабочиеДни, Организации, БИНОрганизации } = график;

                // Support both field names: "Организации" and "БИНОрганизации"
                const организации = Организации || БИНОрганизации;

                // Log received data
                console.error(`[STDERR] Received schedule data:`, {
                    НаименованиеГрафика,
                    КодГрафика,
                    РабочиеДни: РабочиеДни?.length,
                    Организации: организации,
                    fieldUsed: Организации ? 'Организации' : БИНОрганизации ? 'БИНОрганизации' : 'none'
                });
                
                // Validate schedule data
                if (!НаименованиеГрафика || !КодГрафика || !РабочиеДни || !Array.isArray(РабочиеДни)) {
                    errors.push(`Неполные данные для графика: ${НаименованиеГрафика || КодГрафика || 'UNKNOWN'}`);
                    client.release();
                    continue;
                }
                
                console.log(`Processing schedule: ${НаименованиеГрафика} (${КодГрафика}) with ${РабочиеДни.length} work days`);
                console.error(`[STDERR] Processing schedule: ${НаименованиеГрафика}, Organizations:`, организации);

                // Start transaction for this schedule using the same client
                await client.query('BEGIN');

                // Validate and prepare organizations if provided (inside transaction)
                let validOrgBins = [];
                if (организации && Array.isArray(организации) && организации.length > 0) {
                    try {
                        debugLog(`Validating ${организации.length} organizations for schedule ${КодГрафика}`, организации);
                        // Check if all organization BINs exist in departments (inside transaction)
                        const placeholders = организации.map((_, i) => `$${i + 1}`).join(',');
                        const orgCheckResult = await client.query(
                            `SELECT DISTINCT object_bin FROM departments WHERE object_bin IN (${placeholders})`,
                            организации
                        );
                        debugLog(`Found ${orgCheckResult.rows.length} organizations in departments`);
                        const existingBins = new Set(orgCheckResult.rows.map(row => row.object_bin));
                        const invalidBins = организации.filter(bin => !existingBins.has(bin));

                        if (invalidBins.length > 0) {
                            errors.push(`Несуществующие БИНы организаций для графика ${НаименованиеГрафика}: ${invalidBins.join(', ')}`);
                            debugLog(`Invalid BINs`, invalidBins);
                        }

                        // Store valid BINs for later use in transaction
                        validOrgBins = Array.from(existingBins);
                        debugLog(`Valid organization BINs for ${КодГрафика}`, validOrgBins);
                    } catch (orgError) {
                        debugLog(`ERROR validating organizations`, { error: orgError.message, stack: orgError.stack });
                        errors.push(`Ошибка проверки организаций для графика ${НаименованиеГрафика}: ${orgError.message}`);
                    }
                } else {
                    debugLog(`No organizations provided for schedule ${КодГрафика}`);
                }
                
                // Delete existing records for this schedule code (replace existing data)
                const deleteResult = await client.query(
                    'DELETE FROM work_schedules_1c WHERE schedule_code = $1',
                    [КодГрафика]
                );
                
                const deletedCount = deleteResult.rowCount || 0;
                if (deletedCount > 0) {
                    console.log(`Deleted ${deletedCount} existing records for schedule ${КодГрафика}`);
                }
                
                // Delete existing organization links for this schedule
                await client.query(
                    'DELETE FROM schedule_organizations WHERE schedule_code = $1',
                    [КодГрафика]
                );
                
                // Insert organization links if we have valid organizations
                debugLog(`About to insert organizations for ${КодГрафика}`, { count: validOrgBins.length, bins: validOrgBins });
                if (validOrgBins.length > 0) {
                    debugLog(`Inserting ${validOrgBins.length} organization links for schedule ${КодГрафика}`, validOrgBins);
                    for (const orgBin of validOrgBins) {
                        try {
                            const insertResult = await client.query(
                                'INSERT INTO schedule_organizations (schedule_code, organization_bin) VALUES ($1, $2) ON CONFLICT (schedule_code, organization_bin) DO NOTHING RETURNING id',
                                [КодГрафика, orgBin]
                            );
                            if (insertResult.rows.length === 0) {
                                debugLog(`Organization ${orgBin} already linked (conflict)`);
                            } else {
                                debugLog(`Linked organization ${orgBin}`, { id: insertResult.rows[0].id });
                            }
                        } catch (insertError) {
                            debugLog(`ERROR inserting organization ${orgBin}`, { error: insertError.message, stack: insertError.stack });
                            throw insertError;
                        }
                    }
                    debugLog(`Linked schedule ${КодГрафика} to ${validOrgBins.length} organizations`);
                } else {
                    debugLog(`No valid organizations to link for schedule ${КодГрафика}`, { validOrgBins });
                }
                
                let scheduleInsertCount = 0;
                
                // Extract work times from schedule name (fallback if not provided by 1C)
                const extractedTimes = extractWorkTimesFromScheduleName(НаименованиеГрафика);
                
                // Insert new records for this schedule
                for (const рабочийДень of РабочиеДни) {
                    const { 
                        Дата, 
                        Месяц, 
                        ВидУчетаВремени, 
                        ДополнительноеЗначение,
                        ВремяНачалоРаботы,
                        ВремяЗавершениеРаботы 
                    } = рабочийДень;
                    
                    // Validate work day data
                    if (!Дата || !Месяц || !ВидУчетаВремени || ДополнительноеЗначение === undefined) {
                        errors.push(`Неполные данные для рабочего дня в графике ${НаименованиеГрафика}: ${JSON.stringify(рабочийДень)}`);
                        continue;
                    }
                    
                    // Use times from 1C if provided, otherwise use extracted times from schedule name
                    const finalStartTime = ВремяНачалоРаботы || extractedTimes.work_start_time;
                    const finalEndTime = ВремяЗавершениеРаботы || extractedTimes.work_end_time;
                    
                    // Insert work day record
                    await client.query(`
                        INSERT INTO work_schedules_1c 
                        (schedule_name, schedule_code, work_date, work_month, time_type, work_hours, work_start_time, work_end_time)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        НаименованиеГрафика,
                        КодГрафика,
                        Дата,              // work_date
                        Месяц,             // work_month
                        ВидУчетаВремени,   // time_type
                        ДополнительноеЗначение,  // work_hours
                        finalStartTime,    // work_start_time (from 1C or extracted)
                        finalEndTime       // work_end_time (from 1C or extracted)
                    ]);
                    
                    scheduleInsertCount++;
                }
                
                // Verify organizations were inserted before commit
                if (validOrgBins.length > 0) {
                    const verifyOrgs = await client.query(
                        'SELECT COUNT(*) as count FROM schedule_organizations WHERE schedule_code = $1',
                        [КодГрафика]
                    );
                    debugLog(`Organizations in DB before commit for ${КодГрафика}`, { count: verifyOrgs.rows[0].count, expected: validOrgBins.length });
                }

                debugLog(`Committing transaction for schedule ${КодГрафика}`);
                await client.query('COMMIT');
                debugLog(`Transaction committed for schedule ${КодГрафика}`);

                // Verify organizations after commit using a new connection
                if (validOrgBins.length > 0) {
                    const verifyAfterCommit = await db.pool.query(
                        'SELECT COUNT(*) as count FROM schedule_organizations WHERE schedule_code = $1',
                        [КодГрафика]
                    );
                    debugLog(`Organizations in DB after commit for ${КодГрафика}`, { count: verifyAfterCommit.rows[0].count, expected: validOrgBins.length });
                    if (verifyAfterCommit.rows[0].count === 0) {
                        debugLog(`ERROR: Organizations were not saved for ${КодГрафика}!`, { expected: validOrgBins.length, actual: 0 });
                    }
                }
                
                console.log(`Successfully processed schedule ${НаименованиеГрафика}: inserted ${scheduleInsertCount} work days`);
                totalProcessed++;
                totalInserted += scheduleInsertCount;
                if (deletedCount > 0) {
                    totalUpdated++;
                }
                
            } catch (scheduleError) {
                await client.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
                const errorMsg = `Ошибка обработки графика ${график.НаименованиеГрафика || график.КодГрафика || 'UNKNOWN'}: ${scheduleError.message}`;
                console.error(errorMsg, scheduleError);
                console.error(`[ERROR] Stack:`, scheduleError.stack);
                errors.push(errorMsg);
            } finally {
                // Always release the client back to the pool
                client.release();
            }
        }
        
        const response = {
            success: true,
            message: `Импорт завершен успешно`,
            statistics: {
                totalSchedulesReceived: Графики.length,
                totalSchedulesProcessed: totalProcessed,
                totalSchedulesUpdated: totalUpdated,
                totalWorkDaysInserted: totalInserted,
                errorsCount: errors.length
            },
            exportDate: ДатаВыгрузки,
            errors: errors.length > 0 ? errors : undefined
        };
        
        console.log('1C import completed:', response.statistics);
        res.json(response);
        
    } catch (error) {
        console.error('Error importing 1C schedules:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка импорта данных из 1С: ' + error.message
        });
    }
});

/**
 * GET /admin/schedules/1c
 * Получение графиков из 1С с фильтрами
 */
router.get('/1c', async (req, res) => {
    try {
        const { scheduleCode, scheduleName, dateFrom, dateTo, month } = req.query;
        
        // First, try a simple query without subqueries
        let query = `
            SELECT 
                ws.schedule_name,
                ws.schedule_code,
                ws.work_date,
                ws.work_month,
                ws.time_type,
                ws.work_hours,
                ws.work_start_time,
                ws.work_end_time,
                ws.created_at,
                ws.updated_at
            FROM work_schedules_1c ws
            WHERE 1=1
        `;
        
        const params = [];
        
        if (scheduleCode) {
            query += ` AND ws.schedule_code = $${params.length + 1}`;
            params.push(scheduleCode);
        }
        
        if (scheduleName) {
            query += ` AND ws.schedule_name ILIKE $${params.length + 1}`;
            params.push(`%${scheduleName}%`);
        }
        
        if (dateFrom) {
            query += ` AND ws.work_date >= $${params.length + 1}`;
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ` AND ws.work_date <= $${params.length + 1}`;
            params.push(dateTo);
        }
        
        if (month) {
            query += ` AND ws.work_month = $${params.length + 1}`;
            params.push(month);
        }
        
        query += ` ORDER BY ws.schedule_name, ws.work_date LIMIT 1000`;
        
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const schedules = await db.queryRows(query, params);
        
        // Add organization info separately if we have schedules
        let organizations = [];
        if (schedules.length > 0 && scheduleCode) {
            try {
                // First, try to get organizations from schedule_organizations table
                organizations = await db.queryRows(`
                    SELECT DISTINCT
                        d.object_company as organization_name,
                        so.organization_bin
                    FROM schedule_organizations so
                    JOIN departments d ON so.organization_bin = d.object_bin
                    WHERE so.schedule_code = $1
                    ORDER BY d.object_company
                `, [scheduleCode]);
                
                // Fallback: if no organizations found in schedule_organizations, use old logic
                if (organizations.length === 0) {
                    organizations = await db.queryRows(`
                        SELECT DISTINCT
                            d.object_company as organization_name,
                            d.object_bin as organization_bin
                        FROM employee_schedule_assignments esa 
                        JOIN employees e ON esa.employee_id = e.id 
                        JOIN departments d ON e.object_code = d.object_code 
                        WHERE esa.schedule_code = $1 
                            AND d.object_bin IS NOT NULL
                            AND d.object_company IS NOT NULL
                        GROUP BY d.object_company, d.object_bin
                        ORDER BY COUNT(*) DESC, d.object_company
                    `, [scheduleCode]);
                }
                
                // Add organizations array to all schedule records (for backward compatibility, also add first org)
                schedules.forEach(schedule => {
                    schedule.organizations = organizations;
                    if (organizations.length > 0) {
                        schedule.organization_name = organizations[0].organization_name;
                        schedule.organization_bin = organizations[0].organization_bin;
                    } else {
                        schedule.organization_name = null;
                        schedule.organization_bin = null;
                    }
                });
            } catch (orgError) {
                console.error('Error getting organization info:', orgError);
                // Continue without organization info
                schedules.forEach(schedule => {
                    schedule.organizations = [];
                    schedule.organization_name = null;
                    schedule.organization_bin = null;
                });
            }
        } else {
            // If no scheduleCode, set empty organizations array
            schedules.forEach(schedule => {
                schedule.organizations = [];
                schedule.organization_name = null;
                schedule.organization_bin = null;
            });
        }
        
        // Get summary statistics - build a simplified stats query
        let statsQuery = `
            SELECT 
                COUNT(DISTINCT schedule_code) as total_schedules,
                COUNT(*) as total_work_days,
                MIN(work_date) as earliest_date,
                MAX(work_date) as latest_date,
                SUM(work_hours) as total_hours
            FROM work_schedules_1c
        `;
        
        // Build WHERE conditions for stats query (without subqueries)
        const statsParams = [];
        let whereConditions = [];
        
        if (scheduleCode) {
            whereConditions.push(`schedule_code = $${statsParams.length + 1}`);
            statsParams.push(scheduleCode);
        }
        
        if (scheduleName) {
            whereConditions.push(`schedule_name ILIKE $${statsParams.length + 1}`);
            statsParams.push(`%${scheduleName}%`);
        }
        
        if (dateFrom) {
            whereConditions.push(`work_date >= $${statsParams.length + 1}`);
            statsParams.push(dateFrom);
        }
        
        if (dateTo) {
            whereConditions.push(`work_date <= $${statsParams.length + 1}`);
            statsParams.push(dateTo);
        }
        
        if (month) {
            whereConditions.push(`work_month = $${statsParams.length + 1}`);
            statsParams.push(month);
        }
        
        if (whereConditions.length > 0) {
            statsQuery += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        const stats = await db.queryRow(statsQuery, statsParams);
        
        res.json({
            schedules,
            statistics: stats,
            filters: { scheduleCode, scheduleName, dateFrom, dateTo, month }
        });
        
    } catch (error) {
        console.error('Error fetching 1C schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /admin/schedules/1c/list
 * Получение уникальных названий и кодов графиков из 1С
 */
router.get('/1c/list', async (req, res) => {
    try {
        // Parse pagination parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        // Get total count for pagination
        const countResult = await db.queryRow(`
            SELECT COUNT(DISTINCT schedule_code) as total
            FROM work_schedules_1c
        `);
        const total = parseInt(countResult.total);
        const totalPages = Math.ceil(total / limit);

        // Get unique organizations dictionary (one query for all)
        const orgsResult = await db.queryRows(`
            SELECT DISTINCT
                so.organization_bin,
                d.object_company as organization_name
            FROM schedule_organizations so
            JOIN departments d ON so.organization_bin = d.object_bin
            WHERE d.object_company IS NOT NULL
            ORDER BY d.object_company
        `);

        // Build organizations dictionary: { bin: name }
        const organizations = {};
        orgsResult.forEach(org => {
            organizations[org.organization_bin] = org.organization_name;
        });

        // Optimized single query with CTE - eliminates N+1 problem
        const schedules = await db.queryRows(`
            WITH schedule_list AS (
                SELECT
                    ws.schedule_name,
                    ws.schedule_code,
                    COUNT(*) as work_days_count,
                    MIN(ws.work_date) as start_date,
                    MAX(ws.work_date) as end_date,
                    AVG(ws.work_hours) as avg_hours,
                    MAX(ws.created_at) as last_updated
                FROM work_schedules_1c ws
                GROUP BY ws.schedule_name, ws.schedule_code
                ORDER BY ws.schedule_name
                LIMIT $1 OFFSET $2
            ),
            schedule_orgs AS (
                SELECT
                    so.schedule_code,
                    array_agg(DISTINCT so.organization_bin ORDER BY so.organization_bin) as org_bins
                FROM schedule_organizations so
                WHERE so.schedule_code IN (SELECT schedule_code FROM schedule_list)
                GROUP BY so.schedule_code
            )
            SELECT
                sl.schedule_name,
                sl.schedule_code,
                sl.work_days_count,
                sl.start_date,
                sl.end_date,
                sl.avg_hours,
                sl.last_updated,
                COALESCE(orgs.org_bins, ARRAY[]::varchar[]) as org_bins
            FROM schedule_list sl
            LEFT JOIN schedule_orgs orgs ON sl.schedule_code = orgs.schedule_code
            ORDER BY sl.schedule_name
        `, [limit, offset]);

        // Return optimized response format
        res.json({
            organizations,
            schedules,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });
    } catch (error) {
        console.error('Error fetching 1C schedules list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /admin/schedules/1c/update-times
 * Обновление времени работы для всех дней графика
 */
router.put('/1c/update-times', async (req, res) => {
    try {
        const { scheduleCode, startTime, endTime } = req.body;
        
        // Валидация входных данных
        if (!scheduleCode || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны: scheduleCode, startTime, endTime'
            });
        }
        
        // Проверяем существование графика
        const checkQuery = `
            SELECT COUNT(*) as count 
            FROM work_schedules_1c 
            WHERE schedule_code = $1
        `;
        const checkResult = await db.queryRows(checkQuery, [scheduleCode]);
        
        if (checkResult[0].count == 0) {
            return res.status(404).json({
                success: false,
                message: 'График с указанным кодом не найден'
            });
        }
        
        // Обновляем время только для записей, где поля времени пустые (NULL)
        const updateQuery = `
            UPDATE work_schedules_1c 
            SET 
                work_start_time = $2,
                work_end_time = $3
            WHERE schedule_code = $1 
            AND (work_start_time IS NULL OR work_end_time IS NULL)
        `;
        
        await db.queryRows(updateQuery, [scheduleCode, startTime, endTime]);
        
        // Получаем количество обновленных записей
        const countQuery = `
            SELECT COUNT(*) as total_count,
                   COUNT(CASE WHEN work_start_time = $2 AND work_end_time = $3 THEN 1 END) as updated_count
            FROM work_schedules_1c 
            WHERE schedule_code = $1
        `;
        const countResult = await db.queryRows(countQuery, [scheduleCode, startTime, endTime]);
        
        res.json({
            success: true,
            message: 'Время успешно применено',
            updatedCount: countResult[0].updated_count,
            totalCount: countResult[0].total_count,
            scheduleCode: scheduleCode,
            appliedStartTime: startTime,
            appliedEndTime: endTime
        });
        
    } catch (error) {
        console.error('Error updating schedule times:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при обновлении времени',
            error: error.message
        });
    }
});

// ==================== EMPLOYEE SCHEDULE ASSIGNMENTS ====================

/**
 * POST /admin/schedules/assign-employee
 * Назначение графика одному сотруднику
 */
router.post('/assign-employee', async (req, res) => {
    try {
        const { employee_number, schedule_code, start_date } = req.body;
        
        // Validate input
        if (!employee_number || !schedule_code || !start_date) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо указать табельный номер, код графика и дату начала'
            });
        }
        
        await db.query('BEGIN');
        
        try {
            // Check if employee exists
            const employee = await db.queryRow(
                'SELECT id, full_name FROM employees WHERE table_number = $1',
                [employee_number]
            );
            
            if (!employee) {
                await db.query('ROLLBACK');
                return res.json({
                    success: false,
                    error: 'Сотрудник не найден',
                    skipped: true
                });
            }
            
            // Check if schedule exists
            const schedule = await db.queryRow(
                'SELECT DISTINCT schedule_code, schedule_name FROM work_schedules_1c WHERE schedule_code = $1',
                [schedule_code]
            );
            
            if (!schedule) {
                await db.query('ROLLBACK');
                return res.json({
                    success: false,
                    error: 'График не найден',
                    skipped: true
                });
            }
            
            // Close any existing active schedule
            const existingSchedule = await db.queryRow(`
                SELECT id, schedule_code, start_date 
                FROM employee_schedule_assignments 
                WHERE employee_number = $1 AND end_date IS NULL
            `, [employee_number]);
            
            if (existingSchedule) {
                // Set end_date to day before new schedule starts
                const endDate = new Date(start_date);
                endDate.setDate(endDate.getDate() - 1);
                
                await db.query(`
                    UPDATE employee_schedule_assignments 
                    SET end_date = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [endDate.toISOString().split('T')[0], existingSchedule.id]);
            }
            
            // Create new assignment
            const newAssignment = await db.queryRow(`
                INSERT INTO employee_schedule_assignments 
                (employee_id, employee_number, schedule_code, start_date, assigned_by)
                VALUES ($1, $2, $3, $4, '1C')
                RETURNING *
            `, [employee.id, employee_number, schedule_code, start_date]);
            
            await db.query('COMMIT');
            
            res.json({
                success: true,
                message: 'График успешно назначен',
                assignment: {
                    id: newAssignment.id,
                    employee_number: employee_number,
                    employee_name: employee.full_name,
                    schedule_code: schedule_code,
                    schedule_name: schedule.schedule_name,
                    start_date: start_date,
                    previous_schedule_ended: !!existingSchedule
                }
            });
            
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('Error assigning schedule to employee:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка назначения графика: ' + error.message
        });
    }
});

/**
 * POST /admin/schedules/assign-employees-batch
 * Массовое назначение графиков сотрудникам
 */
router.post('/assign-employees-batch', async (req, res) => {
    try {
        const { assignments } = req.body;
        
        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо передать массив назначений'
            });
        }
        
        const results = {
            success: true,
            totalReceived: assignments.length,
            assigned: 0,
            skipped: 0,
            errors: [],
            assignments: []
        };
        
        for (const assignment of assignments) {
            const { employee_number, schedule_code, start_date } = assignment;
            
            if (!employee_number || !schedule_code || !start_date) {
                results.errors.push(`Неполные данные: ${JSON.stringify(assignment)}`);
                results.skipped++;
                continue;
            }
            
            try {
                await db.query('BEGIN');
                
                // Check employee
                const employee = await db.queryRow(
                    'SELECT id, full_name FROM employees WHERE table_number = $1',
                    [employee_number]
                );
                
                if (!employee) {
                    results.errors.push(`Сотрудник ${employee_number} не найден`);
                    results.skipped++;
                    await db.query('ROLLBACK');
                    continue;
                }
                
                // Check schedule
                const schedule = await db.queryRow(
                    'SELECT DISTINCT schedule_code, schedule_name FROM work_schedules_1c WHERE schedule_code = $1',
                    [schedule_code]
                );
                
                if (!schedule) {
                    results.errors.push(`График ${schedule_code} не найден`);
                    results.skipped++;
                    await db.query('ROLLBACK');
                    continue;
                }
                
                // Close existing active schedule
                const existingSchedule = await db.queryRow(`
                    SELECT id FROM employee_schedule_assignments 
                    WHERE employee_number = $1 AND end_date IS NULL
                `, [employee_number]);
                
                if (existingSchedule) {
                    const endDate = new Date(start_date);
                    endDate.setDate(endDate.getDate() - 1);
                    
                    await db.query(`
                        UPDATE employee_schedule_assignments 
                        SET end_date = $1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2
                    `, [endDate.toISOString().split('T')[0], existingSchedule.id]);
                }
                
                // Create new assignment
                await db.queryRow(`
                    INSERT INTO employee_schedule_assignments 
                    (employee_id, employee_number, schedule_code, start_date, assigned_by)
                    VALUES ($1, $2, $3, $4, '1C')
                    RETURNING id
                `, [employee.id, employee_number, schedule_code, start_date]);
                
                await db.query('COMMIT');
                
                results.assigned++;
                results.assignments.push({
                    employee_number,
                    employee_name: employee.full_name,
                    schedule_code,
                    schedule_name: schedule.schedule_name,
                    start_date
                });
                
            } catch (error) {
                await db.query('ROLLBACK');
                results.errors.push(`Ошибка для ${employee_number}: ${error.message}`);
                results.skipped++;
            }
        }
        
        res.json(results);
        
    } catch (error) {
        console.error('Error in batch schedule assignment:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка массового назначения графиков: ' + error.message
        });
    }
});

module.exports = router;



