/**
 * Вспомогательные функции для админ-панели
 * Модуль: backend/routes/admin/helpers.js
 */

const fs = require('fs');
const db = require('../../database_pg');

/**
 * Логгер для отладки операций импорта
 * @param {string} message - Сообщение для логирования
 * @param {any} data - Дополнительные данные (опционально)
 */
const debugLog = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data, null, 2) : ''}\n`;

    // Log to console
    console.log(message, data || '');

    // Log to file
    try {
        fs.appendFileSync('/tmp/import_debug.log', logMessage);
    } catch (err) {
        console.error('Failed to write to debug log:', err);
    }
};

/**
 * Расширенный калькулятор рабочих часов с учётом графика
 * @param {string|Date} checkIn - Время входа
 * @param {string|Date} checkOut - Время выхода
 * @param {Object} scheduleData - Данные графика работы
 * @param {string} workDate - Рабочая дата
 * @returns {Object} Расчётные часы
 */
function calculateAdvancedHours(checkIn, checkOut, scheduleData, workDate) {
    if (!checkIn || !checkOut) {
        return {
            actual_hours: 0,
            planned_hours: 0,
            overtime_hours: 0,
            is_scheduled_workday: false,
            has_lunch_break: false,
            final_hours: 0
        };
    }
    
    const inTime = new Date(checkIn);
    let outTime = new Date(checkOut);
    
    // Get schedule information
    const startTime = scheduleData.work_start_time;
    const endTime = scheduleData.work_end_time;
    const plannedHours = parseFloat(scheduleData.work_hours) || 8;
    const scheduleName = scheduleData.schedule_name || '';
    
    // Check if this is a scheduled workday
    const isScheduledWorkday = !!scheduleData.schedule_name;
    
    // Determine if night shift
    const isNightShift = startTime && endTime && (
        startTime > endTime ||
        plannedHours > 12 ||
        (startTime >= "22:00" || startTime >= "23:00") ||
        (endTime <= "08:00" || endTime <= "06:00") ||
        scheduleName.toLowerCase().includes('ночная') ||
        scheduleName.includes('00:00')
    );
    
    // Handle night shift time calculation
    if (isNightShift && outTime <= inTime) {
        outTime.setDate(outTime.getDate() + 1);
        console.log(`🌙 Night shift: adjusted checkout to next day`);
    }
    
    // Calculate raw actual hours
    let actualHours = (outTime - inTime) / (1000 * 60 * 60);
    
    // Handle edge cases
    if (actualHours < 0) {
        actualHours = actualHours + 24;
    }
    if (actualHours > 16) {
        console.warn(`⚠️ Unusually long shift: ${actualHours.toFixed(2)}h`);
        actualHours = Math.min(actualHours, 16); // Cap at 16 hours
    }
    
    // Determine if lunch break should be deducted
    const hasLunchBreak = actualHours > 4 && !isNightShift;
    
    // Calculate final hours based on schedule logic
    let finalHours, overtimeHours = 0;
    
    if (isScheduledWorkday) {
        console.log(`📅 Scheduled workday: ${scheduleName} (${plannedHours}h planned)`);
        
        // Deduct lunch break if applicable
        let workingHours = actualHours;
        if (hasLunchBreak) {
            workingHours = Math.max(0, actualHours - 1); // Deduct 1 hour lunch
            console.log(`🍽️ Lunch break deducted: ${actualHours.toFixed(2)}h → ${workingHours.toFixed(2)}h`);
        }
        
        if (workingHours > plannedHours) {
            // Overtime: cap at planned hours, calculate overtime separately
            finalHours = plannedHours;
            overtimeHours = workingHours - plannedHours;
            console.log(`⏰ Overtime detected: ${plannedHours}h + ${overtimeHours.toFixed(2)}h overtime → capped at ${finalHours}h`);
        } else {
            // Within scheduled hours or early departure
            finalHours = workingHours;
            console.log(`✅ Within schedule: ${finalHours.toFixed(2)}h of ${plannedHours}h planned`);
        }
    } else {
        // No schedule: count actual hours
        console.log(`🚫 No schedule: counting actual hours`);
        finalHours = hasLunchBreak ? Math.max(0, actualHours - 1) : actualHours;
    }
    
    return {
        actual_hours: Math.max(0, actualHours),
        planned_hours: isScheduledWorkday ? plannedHours : 0,
        overtime_hours: Math.max(0, overtimeHours),
        is_scheduled_workday: isScheduledWorkday,
        has_lunch_break: hasLunchBreak,
        final_hours: Math.max(0, finalHours)
    };
}

/**
 * Проверка, является ли дата рабочим днём по графику
 * @param {string} employeeNumber - Табельный номер сотрудника
 * @param {string} workDate - Дата для проверки
 * @returns {Promise<Object|null>} Данные графика или null
 */
async function isScheduledWorkday(employeeNumber, workDate) {
    try {
        // Check if the specific date exists in employee's work schedule
        const scheduleEntry = await db.queryRow(`
            SELECT 
                ws1c.work_date,
                ws1c.work_hours,
                ws1c.time_type,
                ws1c.schedule_name,
                ws1c.work_start_time,
                ws1c.work_end_time
            FROM employee_schedule_assignments esa
            JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
            WHERE esa.employee_number = $1 
            AND esa.end_date IS NULL
            AND ws1c.work_date = $2
            LIMIT 1
        `, [employeeNumber, workDate]);
        
        return scheduleEntry || null;
    } catch (error) {
        console.error('Error checking scheduled workday:', error);
        return null;
    }
}

/**
 * Расчёт часов смены (устаревшая функция, оставлена для совместимости)
 * @param {string|Date} checkIn - Время входа
 * @param {string|Date} checkOut - Время выхода
 * @param {Object} scheduleData - Данные графика
 * @returns {number} Количество часов
 */
function calculateShiftHours(checkIn, checkOut, scheduleData) {
    const result = calculateAdvancedHours(checkIn, checkOut, scheduleData, null);
    return result.final_hours;
}

/**
 * Определение статуса смены с учётом ночных смен
 * @param {string|Date} checkIn - Время входа
 * @param {string|Date} checkOut - Время выхода
 * @param {Object} scheduleData - Данные графика
 * @returns {string} Статус смены
 */
function determineShiftStatus(checkIn, checkOut, scheduleData) {
    const actualHours = calculateShiftHours(checkIn, checkOut, scheduleData);
    const expectedHours = parseInt(scheduleData.work_hours) || 8;
    const startTime = scheduleData.work_start_time;
    const endTime = scheduleData.work_end_time;
    
    // Check if employee worked without assigned schedule
    const offSchedule = !scheduleData.schedule_name;
    
    if (!checkIn) return 'absent';
    
    const inTime = new Date(checkIn);
    
    // Parse expected start time for comparison
    let expectedStart = new Date(inTime);
    if (startTime) {
        const [hours, minutes] = startTime.split(':').map(Number);
        expectedStart.setHours(hours, minutes, 0, 0);
        
        // For night shifts starting late (22:00+), adjust date if needed
        if (hours >= 22 && inTime.getHours() < 12) {
            expectedStart.setDate(expectedStart.getDate() - 1);
        }
    }
    
    // Calculate lateness in minutes
    const lateness = (inTime - expectedStart) / (1000 * 60);
    
    // Determine status
    if (lateness <= 5) return 'on_time';           // Within 5 minutes
    if (lateness <= 30) return 'late';             // Up to 30 minutes late
    if (actualHours < expectedHours * 0.8) return 'early_leave'; // Left significantly early
    
    return 'late';
}

/**
 * Извлечение времени работы из названия графика
 * @param {string} scheduleName - Название графика
 * @returns {Object} Объект с work_start_time и work_end_time
 */
function extractWorkTimesFromScheduleName(scheduleName) {
    if (!scheduleName) return { work_start_time: null, work_end_time: null };
    
    // Regex pattern for time format: HH:MM-HH:MM at the beginning of the name
    const timePattern = /^(\d{2}:\d{2})-(\d{2}:\d{2})/;
    const match = scheduleName.match(timePattern);
    
    if (match) {
        console.log(`Extracted times from "${scheduleName}": ${match[1]} - ${match[2]}`);
        return {
            work_start_time: match[1],
            work_end_time: match[2]
        };
    }
    
    console.log(`Could not extract times from "${scheduleName}"`);
    return { work_start_time: null, work_end_time: null };
}

/**
 * Получение фактического ФОТ за период по подразделению
 * @param {string} departmentCode - Код подразделения
 * @param {string} dateFrom - Дата начала (YYYY-MM-DD)
 * @param {string} dateTo - Дата окончания (YYYY-MM-DD)
 * @returns {Promise<Object>} Объект { 'YYYY-MM-DD': { employees_count, total_payroll } }
 */
async function getActualPayrollForPeriod(departmentCode, dateFrom, dateTo) {
    const query = `
        WITH working_days_calc AS (
            -- Calculate working days in FULL MONTH for each schedule (not just report period)
            SELECT
                schedule_code,
                EXTRACT(YEAR FROM work_date) as year,
                EXTRACT(MONTH FROM work_date) as month,
                COUNT(*) as working_days_count
            FROM work_schedules_1c
            GROUP BY schedule_code, year, month
        )
        SELECT
            te.event_datetime::date as work_date,
            COUNT(DISTINCT e.table_number) as employees_count,
            SUM(
                COALESCE(e.payroll, 0) /
                NULLIF(wd.working_days_count, 0)
            ) as total_payroll
        FROM time_events te
        JOIN employees e ON te.employee_number = e.table_number
        LEFT JOIN departments d ON e.object_code = d.object_code
        LEFT JOIN employee_schedule_assignments esa
            ON e.table_number = esa.employee_number
            AND te.event_datetime::date BETWEEN esa.start_date
            AND COALESCE(esa.end_date, '9999-12-31'::date)
        LEFT JOIN working_days_calc wd
            ON esa.schedule_code = wd.schedule_code
            AND EXTRACT(YEAR FROM te.event_datetime) = wd.year
            AND EXTRACT(MONTH FROM te.event_datetime) = wd.month
        WHERE te.event_type = '1'
            AND te.event_datetime::date BETWEEN $2 AND $3
            AND d.object_code = $1
        GROUP BY te.event_datetime::date
        ORDER BY work_date
    `;

    const result = await db.query(query, [departmentCode, dateFrom, dateTo]);

    // Convert to object { date: { employees_count, total_payroll } }
    const payrollMap = {};
    result.rows.forEach(row => {
        // IMPORTANT: Convert Date object to YYYY-MM-DD string format
        const dateStr = row.work_date instanceof Date
            ? row.work_date.toISOString().split('T')[0]
            : row.work_date;

        payrollMap[dateStr] = {
            employees_count: parseInt(row.employees_count),
            total_payroll: Math.round(parseFloat(row.total_payroll || 0) * 100) / 100
        };
    });

    return payrollMap;
}

/**
 * Определение статуса эффективности по коэффициенту
 * @param {number} coefficient - Коэффициент выручка/ФОТ
 * @returns {string} Статус: excellent, good, acceptable, low, no_data
 */
function getEfficiencyStatus(coefficient) {
    if (coefficient === 0) return 'no_data';
    if (coefficient >= 4.0) return 'excellent';    // Excellent: >= 4.0
    if (coefficient >= 3.0) return 'good';         // Good: 3.0-4.0
    if (coefficient >= 2.0) return 'acceptable';   // Acceptable: 2.0-3.0
    return 'low';                                   // Low: < 2.0
}

/**
 * Генерация массива дат между началом и концом
 * @param {string} startDate - Дата начала (YYYY-MM-DD)
 * @param {string} endDate - Дата окончания (YYYY-MM-DD)
 * @returns {Array<string>} Массив дат
 */
function generateDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

/**
 * Расчёт среднего коэффициента для дней с данными
 * @param {Array} days - Массив объектов дней
 * @returns {number} Средний коэффициент
 */
function calculateAvgCoefficient(days) {
    const daysWithData = days.filter(d => d.coefficient > 0);

    if (daysWithData.length === 0) return 0;

    const sum = daysWithData.reduce((total, d) => total + d.coefficient, 0);
    return Math.round((sum / daysWithData.length) * 100) / 100;
}

module.exports = {
    debugLog,
    calculateAdvancedHours,
    isScheduledWorkday,
    calculateShiftHours,
    determineShiftStatus,
    extractWorkTimesFromScheduleName,
    getActualPayrollForPeriod,
    getEfficiencyStatus,
    generateDateRange,
    calculateAvgCoefficient
};



