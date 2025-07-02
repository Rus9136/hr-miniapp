const db = require('./backend/database_pg');

async function checkScheduleStructure() {
    try {
        console.log('=== Проверка структуры таблиц графиков ===\n');
        
        // 1. Проверяем структуру work_schedules_1c
        console.log('1. Структура work_schedules_1c:');
        const scheduleInfo = await db.queryRows(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'work_schedules_1c'
            ORDER BY ordinal_position
        `);
        
        scheduleInfo.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
        // 2. Проверяем структуру employee_schedule_assignments
        console.log('\n2. Структура employee_schedule_assignments:');
        const assignmentInfo = await db.queryRows(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'employee_schedule_assignments'
            ORDER BY ordinal_position
        `);
        
        assignmentInfo.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
        // 3. Примеры данных work_schedules_1c
        console.log('\n3. Примеры графиков:');
        const schedules = await db.queryRows(`
            SELECT schedule_code, schedule_name, work_date, work_hours, work_start_time, work_end_time
            FROM work_schedules_1c 
            ORDER BY schedule_code, work_date 
            LIMIT 5
        `);
        
        schedules.forEach(sch => {
            console.log(`  ${sch.schedule_code}: ${sch.schedule_name} [${sch.work_date}] (${sch.work_start_time}-${sch.work_end_time}, ${sch.work_hours}ч)`);
        });
        
        // 4. Примеры назначений
        console.log('\n4. Примеры назначений графиков:');
        const assignments = await db.queryRows(`
            SELECT employee_number, schedule_code, start_date, end_date
            FROM employee_schedule_assignments 
            ORDER BY employee_number, start_date 
            LIMIT 5
        `);
        
        assignments.forEach(ass => {
            console.log(`  ${ass.employee_number}: ${ass.schedule_code} (${ass.start_date} - ${ass.end_date || 'текущий'})`);
        });
        
        // 5. Проверяем есть ли детализация по датам в графиках
        console.log('\n5. Проверка наличия детализации по датам:');
        const tablesWithDates = await db.queryRows(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE '%schedule%' AND table_name LIKE '%date%'
            ORDER BY table_name
        `);
        
        if (tablesWithDates.length > 0) {
            console.log('Найдены таблицы с датами:');
            tablesWithDates.forEach(t => console.log(`  ${t.table_name}`));
        } else {
            console.log('Таблицы с детализацией по датам не найдены');
        }
        
        // 6. Проверяем есть ли рабочие дни в графиках
        console.log('\n6. Проверка полей для рабочих дней:');
        const workDaysFields = await db.queryRows(`
            SELECT column_name, table_name
            FROM information_schema.columns 
            WHERE (column_name LIKE '%work%day%' OR column_name LIKE '%shift%' OR column_name LIKE '%day%')
            AND table_name IN ('work_schedules_1c', 'employee_schedule_assignments')
            ORDER BY table_name, column_name
        `);
        
        if (workDaysFields.length > 0) {
            workDaysFields.forEach(field => {
                console.log(`  ${field.table_name}.${field.column_name}`);
            });
        } else {
            console.log('Поля для рабочих дней не найдены');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Ошибка:', error);
        process.exit(1);
    }
}

checkScheduleStructure();