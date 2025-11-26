/**
 * Модуль отчётов
 * Эндпоинты: /admin/reports/*, /admin/payroll/*
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../database_pg');
const { getActualPayrollForPeriod, generateDateRange } = require('./helpers');

/**
 * GET /admin/reports/late-employees
 * Отчёт по опоздавшим сотрудникам
 * НОВАЯ ЛОГИКА: берём всех отметившихся, проверяем график, показываем "Вне графика"
 */
router.get('/late-employees', async (req, res) => {
    try {
        const { date, organization, department } = req.query;

        // Если дата не указана, используем сегодняшнюю
        const reportDate = date || new Date().toISOString().split('T')[0];

        console.log('Getting late employees report for:', reportDate, 'org:', organization, 'dept:', department);

        // НОВАЯ ЛОГИКА: Начинаем с time_events (все кто отметился на вход)
        // затем проверяем график и определяем "вне графика"
        let query = `
            WITH first_entry AS (
                -- Получаем первый вход каждого сотрудника за день
                SELECT DISTINCT ON (employee_number)
                    employee_number,
                    event_datetime
                FROM time_events
                WHERE event_type = '1'
                    AND DATE(event_datetime) = $1
                ORDER BY employee_number, event_datetime ASC
            ),
            schedule_for_date AS (
                -- Проверяем есть ли рабочая смена на указанную дату
                SELECT
                    esa.employee_number,
                    ws.schedule_code,
                    ws.schedule_name,
                    ws.work_start_time,
                    ws.work_end_time,
                    ws.work_hours,
                    TRUE as is_scheduled_workday
                FROM employee_schedule_assignments esa
                JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code
                    AND ws.work_date = $1
                WHERE esa.start_date <= $1
                    AND (esa.end_date IS NULL OR esa.end_date >= $1)
                    AND ws.work_start_time IS NOT NULL
                    AND ws.work_hours > 0
            ),
            typical_schedule AS (
                -- Получаем типичное время начала работы из графика сотрудника
                -- (для тех, у кого сегодня выходной, но они отметились)
                SELECT DISTINCT ON (esa.employee_number)
                    esa.employee_number,
                    esa.schedule_code,
                    ws.schedule_name as typical_schedule_name,
                    ws.work_start_time as typical_start_time
                FROM employee_schedule_assignments esa
                JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code
                WHERE esa.start_date <= $1
                    AND (esa.end_date IS NULL OR esa.end_date >= $1)
                    AND ws.work_start_time IS NOT NULL
                    AND ws.work_hours > 0
                ORDER BY esa.employee_number, ws.work_date DESC
            )
            SELECT
                e.full_name as employee_name,
                e.table_number,
                e.object_code,
                d.object_name as department_name,
                d.object_bin as organization,
                -- Если есть смена на сегодня - берём её данные, иначе типичные
                COALESCE(sfd.schedule_name, ts.typical_schedule_name) as schedule_name,
                COALESCE(sfd.work_start_time, ts.typical_start_time) as schedule_start_time,
                sfd.work_end_time as schedule_end_time,
                fe.event_datetime as actual_entry_time,
                -- Флаг: запланирована ли смена на сегодня
                COALESCE(sfd.is_scheduled_workday, FALSE) as is_scheduled_workday
            FROM first_entry fe
            JOIN employees e ON fe.employee_number = e.table_number
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN schedule_for_date sfd ON e.table_number = sfd.employee_number
            LEFT JOIN typical_schedule ts ON e.table_number = ts.employee_number
            WHERE 1=1
        `;

        const queryParams = [reportDate];
        let paramIndex = 2;

        // Добавляем фильтр по организации
        if (organization && organization.trim() !== '') {
            query += ` AND d.object_bin = $${paramIndex}`;
            queryParams.push(organization);
            paramIndex++;
        }

        // Добавляем фильтр по подразделению
        if (department && department.trim() !== '') {
            query += ` AND e.object_code = $${paramIndex}`;
            queryParams.push(department);
            paramIndex++;
        }

        query += ` ORDER BY e.full_name`;

        const result = await db.query(query, queryParams);

        console.log(`Found ${result.rows.length} employees who checked in on ${reportDate}`);

        // Обрабатываем результат для определения опозданий
        const lateEmployees = result.rows.map(row => {
            let status = 'on_time';
            let lateMinutes = 0;
            let actualEntryFormatted = '-';
            const isOffSchedule = !row.is_scheduled_workday;

            if (row.actual_entry_time) {
                const actualTime = new Date(row.actual_entry_time);
                const actualTimeStr = actualTime.toTimeString().substring(0, 5); // HH:MM
                actualEntryFormatted = actualTimeStr;

                // Сравниваем с графиком (или типичным временем начала)
                if (row.schedule_start_time) {
                    const scheduleTime = new Date(`1970-01-01T${row.schedule_start_time}`);
                    const actualTimeForComparison = new Date(`1970-01-01T${actualTimeStr}:00`);

                    const diffMs = actualTimeForComparison.getTime() - scheduleTime.getTime();
                    const diffMinutes = Math.floor(diffMs / (1000 * 60));

                    if (diffMinutes > 0) {
                        status = 'late';
                        lateMinutes = diffMinutes;
                    }
                }
            }

            return {
                employee_name: row.employee_name,
                table_number: row.table_number,
                department_name: row.department_name,
                organization: row.organization,
                schedule_name: row.schedule_name || '-',
                schedule_start_time: row.schedule_start_time || '-',
                actual_entry_time: actualEntryFormatted,
                status: status,
                late_minutes: lateMinutes,
                late_time_formatted: lateMinutes > 0 ? `${lateMinutes} мин` : '-',
                is_off_schedule: isOffSchedule
            };
        });

        // Фильтруем только опоздавших (включая тех, кто вышел вне графика и опоздал)
        const filteredEmployees = lateEmployees.filter(emp => emp.status === 'late');

        console.log(`Found ${filteredEmployees.length} late employees (including off-schedule)`);

        res.json({
            success: true,
            data: filteredEmployees,
            report_date: reportDate,
            total_count: filteredEmployees.length
        });

    } catch (error) {
        console.error('Error getting late employees report:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении отчета по опоздавшим: ' + error.message
        });
    }
});

/**
 * GET /admin/reports/organizations
 * Получение списка организаций для фильтра отчётов
 */
router.get('/organizations', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT DISTINCT 
                object_bin as organization,
                object_company as company_name
            FROM departments 
            WHERE object_bin IS NOT NULL AND object_bin != ''
            ORDER BY object_company
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error getting organizations for reports:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении списка организаций: ' + error.message
        });
    }
});

/**
 * GET /admin/reports/departments
 * Получение списка подразделений для фильтра отчётов (по организации)
 */
router.get('/departments', async (req, res) => {
    try {
        const { organization } = req.query;
        
        let query = `
            SELECT object_code as id, object_name as name, object_bin as organization
            FROM departments 
            WHERE 1=1
        `;
        const queryParams = [];
        
        if (organization && organization.trim() !== '') {
            query += ` AND object_bin = $1`;
            queryParams.push(organization);
        }
        
        query += ` ORDER BY object_name`;
        
        const result = await db.query(query, queryParams);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error getting departments for reports:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении списка подразделений: ' + error.message
        });
    }
});

/**
 * GET /admin/reports/payroll
 * Отчёт по ФОТ
 */
router.get('/payroll', async (req, res) => {
    try {
        const { organization, department, dateFrom, dateTo } = req.query;
        
        if (!dateFrom || !dateTo) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо указать даты начала и конца периода'
            });
        }
        
        console.log('Payroll report request:', { organization, department, dateFrom, dateTo });
        
        // Правильный запрос: получаем сотрудников с количеством смен в выбранном периоде
        let query = `
            WITH employee_shifts AS (
                SELECT 
                    e.table_number,
                    e.full_name,
                    e.payroll,
                    d.object_name as department_name,
                    d.object_company as organization_name,
                    ws1c.work_date,
                    ws1c.work_hours,
                    ws1c.schedule_name,
                    COUNT(*) OVER (PARTITION BY e.table_number) as shifts_count_in_period
                FROM employees e
                INNER JOIN employee_schedule_assignments esa ON e.table_number = esa.employee_number
                INNER JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
                LEFT JOIN departments d ON e.object_code = d.object_code
                WHERE e.status = 1 
                AND e.payroll IS NOT NULL
                AND ws1c.work_date >= $1::date
                AND ws1c.work_date <= $2::date
                AND esa.start_date <= ws1c.work_date
                AND (esa.end_date IS NULL OR esa.end_date >= ws1c.work_date)
        `;
        
        const params = [dateFrom, dateTo];
        
        // Add organization filter
        if (organization) {
            query += ` AND e.object_bin = $${params.length + 1}`;
            params.push(organization);
        }
        
        // Add department filter
        if (department) {
            query += ` AND e.object_code = $${params.length + 1}`;
            params.push(department);
        }
        
        query += `
            )
            SELECT 
                work_date,
                table_number,
                full_name,
                department_name,
                organization_name,
                payroll,
                shifts_count_in_period,
                schedule_name,
                work_hours,
                ROUND(payroll::decimal / shifts_count_in_period, 2) as daily_payroll
            FROM employee_shifts
            ORDER BY full_name, work_date
            LIMIT 10000
        `;
        
        const result = await db.query(query, params);
        console.log(`Payroll report: found ${result.rows.length} records`);
        
        // Calculate total
        const total = result.rows.reduce((sum, row) => sum + parseFloat(row.daily_payroll), 0);
        
        res.json({
            success: true,
            data: result.rows.map(row => ({
                work_date: row.work_date.toISOString().split('T')[0],
                full_name: row.full_name,
                table_number: row.table_number,
                department_name: row.department_name,
                organization_name: row.organization_name,
                payroll: parseFloat(row.payroll),
                shifts_count: parseInt(row.shifts_count_in_period),
                daily_payroll: parseFloat(row.daily_payroll),
                schedule_name: row.schedule_name,
                work_hours: parseInt(row.work_hours)
            })),
            summary: {
                total: total.toFixed(2),
                recordsCount: result.rows.length,
                dateFrom,
                dateTo,
                filters: {
                    organization: organization || 'Все',
                    department: department || 'Все'
                }
            }
        });
        
    } catch (error) {
        console.error('Error generating payroll report:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при формировании отчета: ' + error.message
        });
    }
});

/**
 * GET /admin/reports/off-schedule-attendance
 * Отчёт по сотрудникам, вышедшим на работу в выходной день
 */
router.get('/off-schedule-attendance', async (req, res) => {
    try {
        const { date, organization } = req.query;

        // Default to today if no date provided
        const reportDate = date || new Date().toISOString().split('T')[0];

        console.log(`Off-schedule attendance report for date: ${reportDate}, organization: ${organization || 'all'}`);

        // SQL query to find employees who came to work on their day off
        // Logic: If work_date is NOT in work_schedules_1c = weekend (day off)
        let query = `
            SELECT
                to_char(te.event_datetime, 'YYYY-MM-DD') as date,
                e.full_name as employee_name,
                e.table_number as employee_number,
                p.staff_position_name as position_name,
                d.object_company as organization_name,
                d.object_name as department_name,
                (SELECT DISTINCT schedule_name FROM work_schedules_1c WHERE schedule_code = esa.schedule_code LIMIT 1) as schedule_name,
                'Выходной' as schedule_type,
                TO_CHAR(MIN(te.event_datetime), 'HH24:MI:SS') as entry_time
            FROM time_events te
            JOIN employees e ON te.employee_number = e.table_number
            JOIN employee_schedule_assignments esa ON e.table_number = esa.employee_number
                AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            WHERE
                te.event_type = '1'
                AND te.event_datetime::date = $1::date
                AND NOT EXISTS (
                    SELECT 1 FROM work_schedules_1c ws
                    WHERE ws.schedule_code = esa.schedule_code
                      AND ws.work_date = $1::date
                )
        `;

        const params = [reportDate];

        // Add organization filter if provided
        if (organization) {
            query += ` AND d.object_company = $${params.length + 1}`;
            params.push(organization);
        }

        query += `
            GROUP BY
                to_char(te.event_datetime, 'YYYY-MM-DD'),
                e.full_name,
                e.table_number,
                p.staff_position_name,
                d.object_company,
                d.object_name,
                esa.schedule_code
            ORDER BY entry_time, e.full_name
        `;

        console.log('DEBUG SQL:', query);
        console.log('DEBUG PARAMS:', params);

        const result = await db.query(query, params);

        console.log(`Off-schedule attendance report: found ${result.rows.length} records`);
        if (result.rows.length > 0) {
            console.log('DEBUG FIRST ROW:', result.rows[0]);
        }

        res.json({
            success: true,
            date: reportDate,
            totalCount: result.rows.length,
            records: result.rows.map(row => ({
                date: row.date, // Already formatted as YYYY-MM-DD by to_char
                employeeName: row.employee_name,
                positionName: row.position_name || 'Не указана',
                organizationName: row.organization_name || 'Не указана',
                departmentName: row.department_name || 'Не указано',
                scheduleName: row.schedule_name || 'Не указан',
                scheduleType: row.schedule_type,
                entryTime: row.entry_time
            }))
        });

    } catch (error) {
        console.error('Error generating off-schedule attendance report:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при формировании отчета: ' + error.message
        });
    }
});

/**
 * GET /admin/reports/payroll-overtime
 * Отчёт по переработкам ФОТ - сравнение плановых и фактических сотрудников по должностям
 */
router.get('/payroll-overtime', async (req, res) => {
    try {
        let { organization, date } = req.query;

        // Fix UTF-8 encoding for organization parameter (cyrillic support)
        if (organization) {
            try {
                const buffer = Buffer.from(organization, 'latin1');
                const decoded = buffer.toString('utf8');
                if (/[А-Яа-яЁё]/.test(decoded)) {
                    organization = decoded;
                }
            } catch (e) {
                console.error('Organization UTF-8 decode error:', e);
            }
        }

        // Validation
        if (!organization) {
            return res.status(400).json({
                success: false,
                error: 'Параметр "organization" обязателен'
            });
        }

        // Default to today if no date provided
        const reportDate = date || new Date().toISOString().split('T')[0];

        console.log(`Payroll overtime report: organization=${organization}, date=${reportDate}`);
        console.log(`Organization encoding test: ${Buffer.from(organization).toString('hex').substring(0, 40)}`);

        // Get target month/year for working days calculation
        const reportDateObj = new Date(reportDate);
        const targetYear = reportDateObj.getFullYear();
        const targetMonth = reportDateObj.getMonth() + 1; // JavaScript months are 0-indexed

        // STEP 1: Get PLANNED employees (who SHOULD work according to schedule)
        const plannedQuery = `
            SELECT
                e.table_number,
                e.full_name,
                COALESCE(e.payroll, 0) as payroll,
                p.staff_position_name as position,
                d.object_company as organization,
                d.object_name as department,
                d.object_code as department_code,
                esa.schedule_code,
                ws.schedule_name,
                ws.work_date
            FROM work_schedules_1c ws
            JOIN employee_schedule_assignments esa ON ws.schedule_code = esa.schedule_code
            JOIN employees e ON esa.employee_number = e.table_number
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN departments d ON e.object_code = d.object_code
            WHERE ws.work_date = $1::date
                AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
                AND d.object_bin = $2
            ORDER BY d.object_name, p.staff_position_name, e.full_name
        `;

        // STEP 2: Get ACTUAL employees (who REALLY came to work)
        const actualQuery = `
            SELECT
                e.table_number,
                e.full_name,
                COALESCE(e.payroll, 0) as payroll,
                p.staff_position_name as position,
                d.object_company as organization,
                d.object_name as department,
                d.object_code as department_code,
                esa.schedule_code,
                te.event_datetime
            FROM time_events te
            JOIN employees e ON te.employee_number = e.table_number
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN employee_schedule_assignments esa ON e.table_number = esa.employee_number
                AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
            WHERE te.event_type = '1'
                AND te.event_datetime::date = $1::date
                AND d.object_bin = $2
            ORDER BY d.object_name, p.staff_position_name, e.full_name
        `;

        // STEP 3: Get working days in target month for each schedule
        const workingDaysQuery = `
            SELECT
                schedule_code,
                COUNT(*) as working_days_count
            FROM work_schedules_1c
            WHERE EXTRACT(YEAR FROM work_date) = $1
                AND EXTRACT(MONTH FROM work_date) = $2
            GROUP BY schedule_code
        `;

        // Execute all queries
        console.log(`DEBUG: Executing queries with params: date=${reportDate}, org=${organization}`);
        const [plannedResult, actualResult, workingDaysResult] = await Promise.all([
            db.query(plannedQuery, [reportDate, organization]),
            db.query(actualQuery, [reportDate, organization]),
            db.query(workingDaysQuery, [targetYear, targetMonth])
        ]);

        console.log(`Found ${plannedResult.rows.length} planned employees, ${actualResult.rows.length} actual employees`);
        if (plannedResult.rows.length > 0) {
            console.log(`DEBUG: First planned employee:`, plannedResult.rows[0]);
        }
        if (actualResult.rows.length > 0) {
            console.log(`DEBUG: First actual employee:`, actualResult.rows[0]);
        }

        // Build working days map for quick lookup
        const workingDaysMap = {};
        workingDaysResult.rows.forEach(row => {
            workingDaysMap[row.schedule_code] = parseInt(row.working_days_count);
        });

        // Helper function to calculate daily payroll
        const calculateDailyPayroll = (payroll, scheduleCode) => {
            const monthlyPayroll = parseFloat(payroll) || 0;

            if (monthlyPayroll === 0) {
                return 0;
            }

            const workingDays = workingDaysMap[scheduleCode] || 0;

            if (workingDays === 0) {
                // No schedule data - cannot calculate daily payroll
                return 0;
            }

            return monthlyPayroll / workingDays;
        };

        // Helper function to aggregate employees by position
        const aggregateByPosition = (employees) => {
            const positionMap = {};

            employees.forEach(emp => {
                const position = emp.position || 'Должность не указана';

                if (!positionMap[position]) {
                    positionMap[position] = {
                        positionName: position,
                        count: 0,
                        totalPayroll: 0,
                        employees: []
                    };
                }

                const dailyPayroll = calculateDailyPayroll(emp.payroll, emp.schedule_code);

                positionMap[position].count++;
                positionMap[position].totalPayroll += dailyPayroll;
                positionMap[position].employees.push({
                    tableNumber: emp.table_number,
                    fullName: emp.full_name,
                    monthlyPayroll: parseFloat(emp.payroll),
                    dailyPayroll: dailyPayroll,
                    scheduleCode: emp.schedule_code
                });
            });

            return Object.values(positionMap);
        };

        // Group by departments
        const departmentMap = {};

        // Process PLANNED employees
        plannedResult.rows.forEach(emp => {
            const deptKey = emp.department_code || 'unknown';

            if (!departmentMap[deptKey]) {
                departmentMap[deptKey] = {
                    departmentName: emp.department || 'Подразделение не указано',
                    departmentCode: emp.department_code,
                    planned: [],
                    actual: []
                };
            }

            departmentMap[deptKey].planned.push(emp);
        });

        // Process ACTUAL employees
        actualResult.rows.forEach(emp => {
            const deptKey = emp.department_code || 'unknown';

            if (!departmentMap[deptKey]) {
                departmentMap[deptKey] = {
                    departmentName: emp.department || 'Подразделение не указано',
                    departmentCode: emp.department_code,
                    planned: [],
                    actual: []
                };
            }

            departmentMap[deptKey].actual.push(emp);
        });

        // Build final report structure
        const departments = Object.values(departmentMap).map(dept => {
            const plannedByPosition = aggregateByPosition(dept.planned);
            const actualByPosition = aggregateByPosition(dept.actual);

            // Merge planned and actual positions
            const allPositions = new Set([
                ...plannedByPosition.map(p => p.positionName),
                ...actualByPosition.map(p => p.positionName)
            ]);

            const positions = Array.from(allPositions).map(positionName => {
                const planned = plannedByPosition.find(p => p.positionName === positionName) || {
                    count: 0,
                    totalPayroll: 0,
                    employees: []
                };

                const actual = actualByPosition.find(p => p.positionName === positionName) || {
                    count: 0,
                    totalPayroll: 0,
                    employees: []
                };

                return {
                    positionName,
                    planned: {
                        count: planned.count,
                        payroll: Math.round(planned.totalPayroll * 100) / 100
                    },
                    actual: {
                        count: actual.count,
                        payroll: Math.round(actual.totalPayroll * 100) / 100
                    },
                    difference: Math.round((actual.totalPayroll - planned.totalPayroll) * 100) / 100
                };
            });

            // Calculate department summary
            const plannedCount = plannedByPosition.reduce((sum, p) => sum + p.count, 0);
            const plannedPayroll = plannedByPosition.reduce((sum, p) => sum + p.totalPayroll, 0);
            const actualCount = actualByPosition.reduce((sum, p) => sum + p.count, 0);
            const actualPayroll = actualByPosition.reduce((sum, p) => sum + p.totalPayroll, 0);

            return {
                departmentName: dept.departmentName,
                departmentCode: dept.departmentCode,
                positions,
                summary: {
                    plannedCount,
                    plannedPayroll: Math.round(plannedPayroll * 100) / 100,
                    actualCount,
                    actualPayroll: Math.round(actualPayroll * 100) / 100,
                    difference: Math.round((actualPayroll - plannedPayroll) * 100) / 100,
                    differencePercent: plannedPayroll > 0
                        ? Math.round(((actualPayroll - plannedPayroll) / plannedPayroll) * 10000) / 100
                        : 0
                }
            };
        });

        // Calculate total summary
        const totalPlannedPayroll = departments.reduce((sum, d) => sum + d.summary.plannedPayroll, 0);
        const totalActualPayroll = departments.reduce((sum, d) => sum + d.summary.actualPayroll, 0);

        res.json({
            success: true,
            date: reportDate,
            organization,
            departments,
            totalSummary: {
                plannedPayroll: Math.round(totalPlannedPayroll * 100) / 100,
                actualPayroll: Math.round(totalActualPayroll * 100) / 100,
                difference: Math.round((totalActualPayroll - totalPlannedPayroll) * 100) / 100,
                differencePercent: totalPlannedPayroll > 0
                    ? Math.round(((totalActualPayroll - totalPlannedPayroll) / totalPlannedPayroll) * 10000) / 100
                    : 0
            }
        });

    } catch (error) {
        console.error('Error generating payroll overtime report:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при формировании отчета: ' + error.message
        });
    }
});

/**
 * GET /admin/reports/revenue-to-payroll
 * Отчёт по соотношению выручки к ФОТ (эффективность)
 */
router.get('/revenue-to-payroll', async (req, res) => {
    try {
        let { organization, date_from, date_to, department_code, bonus_percent } = req.query;

        // Parse bonus_percent with default value 4%
        const bonusPercent = parseFloat(bonus_percent) || 4;

        // Fix UTF-8 encoding for organization parameter (cyrillic support)
        if (organization) {
            try {
                // Try to fix double-encoded UTF-8
                const buffer = Buffer.from(organization, 'latin1');
                const decoded = buffer.toString('utf8');
                // Check if decoded string looks correct (contains cyrillic characters)
                if (/[А-Яа-яЁё]/.test(decoded)) {
                    organization = decoded;
                }
            } catch (e) {
                // If decoding fails, use original value
                console.error('Organization UTF-8 decode error:', e);
            }
        }

        // Validation
        if (!organization) {
            return res.status(400).json({
                success: false,
                error: 'Параметр "organization" обязателен'
            });
        }

        if (!date_from || !date_to) {
            return res.status(400).json({
                success: false,
                error: 'Параметры "date_from" и "date_to" обязательны'
            });
        }

        // Check that period is not more than 31 days
        const dateFromObj = new Date(date_from);
        const dateToObj = new Date(date_to);
        const daysDiff = Math.ceil((dateToObj - dateFromObj) / (1000 * 60 * 60 * 24));

        if (daysDiff > 31) {
            return res.status(400).json({
                success: false,
                error: 'Максимальный период отчета: 31 день'
            });
        }

        if (daysDiff < 0) {
            return res.status(400).json({
                success: false,
                error: 'Дата "date_from" должна быть меньше или равна "date_to"'
            });
        }

        console.log(`Revenue to Payroll report: organization=${organization}, period=${date_from} to ${date_to}`);

        // STEP 1: Get all departments for organization
        // organization parameter is object_bin (БИН)
        const departmentsQuery = `
            SELECT
                object_code,
                object_name,
                object_company,
                object_bin,
                id_iiko
            FROM departments
            WHERE object_bin = $1
                ${department_code ? 'AND object_code = $2' : ''}
            ORDER BY object_name
        `;

        const departmentsParams = department_code
            ? [organization, department_code]
            : [organization];

        const departmentsResult = await db.query(departmentsQuery, departmentsParams);

        if (departmentsResult.rows.length === 0) {
            return res.json({
                success: true,
                period: { start: date_from, end: date_to },
                organization,
                departments: [],
                totalSummary: {
                    total_revenue: 0,
                    total_payroll: 0,
                    overall_coefficient: 0
                },
                message: 'Нет подразделений для выбранной организации'
            });
        }

        console.log(`Found ${departmentsResult.rows.length} departments for organization`);

        // STEP 2: Aggregate data by days across ALL departments
        const dateRange = generateDateRange(date_from, date_to);

        // Initialize aggregated data structure: { date: { revenue, payroll, employees_count } }
        const aggregatedByDay = {};
        dateRange.forEach(date => {
            aggregatedByDay[date] = {
                revenue: 0,
                payroll: 0,
                employees_count: 0
            };
        });

        // STEP 2A: Process payroll for each department (must be done per department)
        for (const dept of departmentsResult.rows) {
            try {
                console.log(`Processing payroll for department: ${dept.object_name} (${dept.object_code})`);

                // Get actual payroll for this department
                const payrollData = await getActualPayrollForPeriod(
                    dept.object_code,
                    date_from,
                    date_to
                );

                // Add payroll to aggregated data
                Object.keys(payrollData).forEach(date => {
                    if (aggregatedByDay[date]) {
                        aggregatedByDay[date].payroll += payrollData[date].total_payroll || 0;
                        aggregatedByDay[date].employees_count += payrollData[date].employees_count || 0;
                    }
                });

            } catch (error) {
                console.error(`Error processing payroll for department ${dept.object_name}:`, error);
                // Continue with next department
            }
        }

        // STEP 2B: Get iiko_department_ids from organizations table
        // organization parameter is already object_bin (БИН)
        let uniqueIikoIds = [];

        // Get iiko_department_ids from organizations table by БИН
        const orgResult = await db.queryRows(
            'SELECT iiko_department_ids FROM organizations WHERE object_bin = $1',
            [organization]
        );

        if (orgResult.length > 0 && orgResult[0].iiko_department_ids) {
            const iikoIds = orgResult[0].iiko_department_ids;
            // JSONB array - filter out nulls and empty strings
            uniqueIikoIds = Array.isArray(iikoIds)
                ? iikoIds.filter(id => id && id.trim && id.trim() !== '')
                : [];
        }

        console.log(`Organization БИН ${organization} has ${uniqueIikoIds.length} iiko IDs from organizations table: ${uniqueIikoIds.join(', ') || 'none'}`);

        // Fetch revenue data for each UNIQUE id_iiko
        for (const iikoId of uniqueIikoIds) {
            try {
                console.log(`Fetching sales for iiko ID: ${iikoId}`);

                const revenueResponse = await axios.get('https://aqniet.site/api/sales/summary', {
                    params: {
                        department_id: iikoId,
                        from_date: date_from,
                        to_date: date_to,
                        skip: 0,
                        limit: 1000
                    },
                    headers: {
                        'Authorization': `Bearer ${process.env.SALES_FORECAST_API_KEY}`
                    },
                    timeout: 10000
                });

                const salesData = revenueResponse.data;

                if (salesData && salesData.length > 0) {
                    console.log(`Got ${salesData.length} sales records for iiko ID ${iikoId}`);

                    // Add revenue to aggregated data
                    salesData.forEach(item => {
                        if (aggregatedByDay[item.date]) {
                            aggregatedByDay[item.date].revenue += item.total_sales || 0;
                        }
                    });
                } else {
                    console.warn(`Sales API: No data for iiko ID ${iikoId}`);
                }
            } catch (salesError) {
                console.error(`Sales API error for iiko ID ${iikoId}:`, salesError.message);
                // Continue - revenue stays 0 for this iiko ID
            }
        }

        // STEP 3: Convert aggregated data to array and calculate coefficients with bonus
        const days = [];
        let totalRevenue = 0;
        let totalPayroll = 0;
        let totalBonus = 0;
        let totalEmployees = 0;

        dateRange.forEach(date => {
            const dayData = aggregatedByDay[date];

            // Calculate bonus from revenue
            const bonus = Math.round(dayData.revenue * (bonusPercent / 100));
            const totalPayrollWithBonus = dayData.payroll + bonus;

            // Coefficient: revenue / (payroll + bonus)
            const coefficient = totalPayrollWithBonus > 0
                ? Math.round((dayData.revenue / totalPayrollWithBonus) * 100) / 100
                : 0;

            days.push({
                date,
                revenue: dayData.revenue,
                actual_payroll: dayData.payroll,
                bonus: bonus,
                total_payroll: totalPayrollWithBonus,
                employees_count: dayData.employees_count,
                coefficient
            });

            totalRevenue += dayData.revenue;
            totalPayroll += dayData.payroll;
            totalBonus += bonus;
            if (dayData.employees_count > totalEmployees) {
                totalEmployees = dayData.employees_count;
            }
        });

        // STEP 4: Calculate summary with bonus
        const grandTotalPayroll = totalPayroll + totalBonus;
        const avgCoefficient = grandTotalPayroll > 0
            ? Math.round((totalRevenue / grandTotalPayroll) * 100) / 100
            : 0;

        const summary = {
            total_revenue: totalRevenue,
            total_payroll: totalPayroll,
            total_bonus: totalBonus,
            grand_total_payroll: grandTotalPayroll,
            total_employees: totalEmployees,
            avg_coefficient: avgCoefficient
        };

        res.json({
            success: true,
            period: { start: date_from, end: date_to },
            organization,
            bonus_percent: bonusPercent,
            days,
            summary
        });

    } catch (error) {
        console.error('Error in revenue-to-payroll report:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при формировании отчета: ' + error.message
        });
    }
});

/**
 * GET /admin/payroll/attendance
 * Детальный отчёт по сменам с расчётом ФОТ
 */
router.get('/attendance', async (req, res) => {
    try {
        const { department_id, from_date, to_date } = req.query;
        
        // Validate required parameters
        if (!department_id || !from_date || !to_date) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо указать department_id, from_date и to_date'
            });
        }
        
        // Validate UUID format for department_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(department_id)) {
            return res.status(400).json({
                success: false,
                error: 'department_id должен быть в формате UUID'
            });
        }
        
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from_date) || !dateRegex.test(to_date)) {
            return res.status(400).json({
                success: false,
                error: 'Даты должны быть в формате YYYY-MM-DD'
            });
        }
        
        // Validate date range
        const fromDate = new Date(from_date);
        const toDate = new Date(to_date);
        if (fromDate > toDate) {
            return res.status(400).json({
                success: false,
                error: 'from_date не может быть позже to_date'
            });
        }
        
        console.log('Payroll attendance request:', { department_id, from_date, to_date });
        
        // Get all employees for the department with their shifts
        const query = `
            WITH department_employees AS (
                -- Get employees for the department by id_iiko
                SELECT DISTINCT
                    e.id as employee_id,
                    e.table_number,
                    e.full_name,
                    e.payroll,
                    e.object_code
                FROM employees e
                INNER JOIN departments d ON e.object_code = d.object_code
                WHERE d.id_iiko = $1::uuid
                AND e.status = 1
                AND e.payroll IS NOT NULL
                AND e.payroll > 0
            ),
            employee_shifts AS (
                -- Get all shifts for these employees in the period
                SELECT 
                    de.employee_id,
                    de.table_number,
                    de.full_name,
                    de.payroll,
                    ws.work_date,
                    ws.schedule_name,
                    ws.work_hours
                FROM department_employees de
                INNER JOIN employee_schedule_assignments esa ON de.table_number = esa.employee_number
                INNER JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code
                WHERE ws.work_date >= $2::date
                AND ws.work_date <= $3::date
                AND esa.start_date <= ws.work_date
                AND (esa.end_date IS NULL OR esa.end_date >= ws.work_date)
                AND ws.time_type != 'В' -- Exclude weekends/holidays
                ORDER BY de.full_name, ws.work_date
            ),
            employee_shift_counts AS (
                -- Count shifts per employee
                SELECT 
                    employee_id,
                    COUNT(*) as shift_count
                FROM employee_shifts
                GROUP BY employee_id
            )
            SELECT 
                es.employee_id::text,
                es.table_number,
                es.full_name,
                es.payroll,
                es.work_date,
                es.schedule_name,
                es.work_hours,
                esc.shift_count
            FROM employee_shifts es
            INNER JOIN employee_shift_counts esc ON es.employee_id = esc.employee_id
            ORDER BY es.full_name, es.work_date
        `;
        
        const result = await db.query(query, [department_id, from_date, to_date]);
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: [],
                summary: {
                    department_id,
                    from_date,
                    to_date,
                    total_employees: 0,
                    total_shifts: 0,
                    total_payroll: 0
                }
            });
        }
        
        // Group results by employee
        const employeesMap = new Map();
        
        result.rows.forEach(row => {
            const employeeId = row.employee_id;
            const payrollTotal = parseFloat(row.payroll);
            const shiftCount = parseInt(row.shift_count);
            const payrollPerShift = Math.round(payrollTotal / shiftCount * 100) / 100;
            
            if (!employeesMap.has(employeeId)) {
                employeesMap.set(employeeId, {
                    employee_id: employeeId,
                    employee_name: row.full_name,
                    table_number: row.table_number,
                    payroll_total: payrollTotal,
                    shifts: []
                });
            }
            
            employeesMap.get(employeeId).shifts.push({
                date: row.work_date.toISOString().split('T')[0],
                payroll_for_shift: payrollPerShift,
                schedule_name: row.schedule_name,
                work_hours: parseInt(row.work_hours)
            });
        });
        
        // Convert map to array
        const employeesData = Array.from(employeesMap.values());
        
        // Calculate summary
        const totalShifts = result.rows.length;
        const totalPayroll = employeesData.reduce((sum, emp) => {
            return sum + emp.shifts.reduce((shiftSum, shift) => shiftSum + shift.payroll_for_shift, 0);
        }, 0);
        
        res.json({
            success: true,
            data: employeesData,
            summary: {
                department_id,
                from_date,
                to_date,
                total_employees: employeesData.length,
                total_shifts: totalShifts,
                total_payroll: Math.round(totalPayroll * 100) / 100
            }
        });
        
    } catch (error) {
        console.error('Error in payroll attendance endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при формировании отчета: ' + error.message
        });
    }
});

module.exports = router;



