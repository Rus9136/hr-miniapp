const db = require('./backend/database_pg');

async function checkTableStructure() {
  try {
    console.log('Checking table structures in HR miniapp database...\n');
    
    // Check employees table structure
    const employeeColumns = await db.queryRows(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'employees'
      ORDER BY ordinal_position
    `);
    
    console.log('=== EMPLOYEES TABLE ===');
    console.log('Columns:');
    employeeColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Check if iin column exists
    const hasIin = employeeColumns.some(col => col.column_name === 'iin');
    if (!hasIin) {
      console.log('\n⚠️  NOTE: Column "iin" not found in employees table');
    }
    
    // Check departments table structure
    const deptColumns = await db.queryRows(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'departments'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== DEPARTMENTS TABLE ===');
    console.log('Columns:');
    deptColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Check employee_schedule_assignments table structure
    const scheduleColumns = await db.queryRows(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'employee_schedule_assignments'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== EMPLOYEE_SCHEDULE_ASSIGNMENTS TABLE ===');
    console.log('Columns:');
    scheduleColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Check work_schedules_1c table structure
    const workScheduleColumns = await db.queryRows(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'work_schedules_1c'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== WORK_SCHEDULES_1C TABLE ===');
    console.log('Columns:');
    workScheduleColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Check foreign key relationships
    const foreignKeys = await db.queryRows(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('employees', 'departments', 'employee_schedule_assignments', 'work_schedules_1c')
      ORDER BY tc.table_name, kcu.column_name
    `);
    
    console.log('\n=== FOREIGN KEY RELATIONSHIPS ===');
    if (foreignKeys.length > 0) {
      foreignKeys.forEach(fk => {
        console.log(`  - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('  No foreign keys found for these tables');
    }
    
    // Check sample data to understand relationships
    console.log('\n=== SAMPLE DATA RELATIONSHIPS ===');
    
    // Sample employee with department
    const sampleEmployee = await db.queryRow(`
      SELECT e.*, d.object_name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.object_code = d.object_code
      LIMIT 1
    `);
    
    if (sampleEmployee) {
      console.log('\nSample Employee:');
      console.log(`  - ID: ${sampleEmployee.id}`);
      console.log(`  - Table Number: ${sampleEmployee.table_number}`);
      console.log(`  - Name: ${sampleEmployee.full_name}`);
      console.log(`  - Object Code: ${sampleEmployee.object_code}`);
      console.log(`  - Department: ${sampleEmployee.department_name || 'Not linked'}`);
      console.log(`  - Payroll: ${sampleEmployee.payroll || 'Not set'}`);
    }
    
    // Sample schedule assignment
    const sampleAssignment = await db.queryRow(`
      SELECT esa.*, e.full_name, ws.schedule_name
      FROM employee_schedule_assignments esa
      LEFT JOIN employees e ON esa.employee_number = e.table_number
      LEFT JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code
      WHERE ws.schedule_code IS NOT NULL
      LIMIT 1
    `);
    
    if (sampleAssignment) {
      console.log('\nSample Schedule Assignment:');
      console.log(`  - Employee: ${sampleAssignment.full_name} (${sampleAssignment.employee_number})`);
      console.log(`  - Schedule Code: ${sampleAssignment.schedule_code}`);
      console.log(`  - Schedule Name: ${sampleAssignment.schedule_name || 'Not found'}`);
      console.log(`  - Period: ${sampleAssignment.start_date} to ${sampleAssignment.end_date || 'current'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking table structure:', error);
    process.exit(1);
  }
}

checkTableStructure();