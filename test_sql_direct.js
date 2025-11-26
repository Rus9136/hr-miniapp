/**
 * Direct SQL test - checking plannedQuery
 */

const db = require('./backend/database_pg');

async function testSQL() {
    try {
        await db.initializeDatabase();

        const reportDate = '2025-06-09';
        const organization = 'ТОО Madlen Group';

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
                AND d.object_company = $2
            ORDER BY d.object_name, p.staff_position_name, e.full_name
        `;

        console.log('Testing plannedQuery...');
        console.log(`Params: date=${reportDate}, org=${organization}`);
        console.log('');

        const result = await db.query(plannedQuery, [reportDate, organization]);

        console.log(`✅ Result: ${result.rows.length} rows`);
        console.log('');

        if (result.rows.length > 0) {
            console.log('First 3 rows:');
            result.rows.slice(0, 3).forEach((row, index) => {
                console.log(`\n  Row ${index + 1}:`);
                console.log(`  - table_number: ${row.table_number}`);
                console.log(`  - full_name: ${row.full_name}`);
                console.log(`  - position: ${row.position}`);
                console.log(`  - department: ${row.department}`);
                console.log(`  - schedule_code: ${row.schedule_code}`);
            });
        } else {
            console.log('❌ No rows returned!');
            console.log('');
            console.log('Testing without organization filter...');

            const queryWithoutOrg = `
                SELECT COUNT(*) as total
                FROM work_schedules_1c ws
                JOIN employee_schedule_assignments esa ON ws.schedule_code = esa.schedule_code
                JOIN employees e ON esa.employee_number = e.table_number
                WHERE ws.work_date = $1::date
                    AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
            `;

            const result2 = await db.query(queryWithoutOrg, [reportDate]);
            console.log(`  Total without org filter: ${result2.rows[0].total}`);

            const queryWithOrg = `
                SELECT COUNT(*) as total
                FROM work_schedules_1c ws
                JOIN employee_schedule_assignments esa ON ws.schedule_code = esa.schedule_code
                JOIN employees e ON esa.employee_number = e.table_number
                LEFT JOIN departments d ON e.object_code = d.object_code
                WHERE ws.work_date = $1::date
                    AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
                    AND d.object_company = $2
            `;

            const result3 = await db.query(queryWithOrg, [reportDate, organization]);
            console.log(`  Total with org filter: ${result3.rows[0].total}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

testSQL();
