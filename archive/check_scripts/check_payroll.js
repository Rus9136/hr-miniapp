const db = require('./backend/database_pg');

async function checkPayroll() {
  try {
    // Проверяем общее количество сотрудников
    const totalResult = await db.queryRows(
      'SELECT COUNT(*) as count FROM employees'
    );
    const totalEmployees = totalResult[0].count;
    
    // Проверяем количество сотрудников с заполненным payroll
    const withPayrollResult = await db.queryRows(
      "SELECT COUNT(*) as count FROM employees WHERE payroll IS NOT NULL"
    );
    const withPayroll = withPayrollResult[0].count;
    
    // Проверяем количество сотрудников без payroll
    const withoutPayrollResult = await db.queryRows(
      "SELECT COUNT(*) as count FROM employees WHERE payroll IS NULL"
    );
    const withoutPayroll = withoutPayrollResult[0].count;
    
    console.log('=== СТАТИСТИКА ПО КОЛОНКЕ PAYROLL (ФОТ) ===');
    console.log('Всего сотрудников:', parseInt(totalEmployees));
    console.log('С заполненным ФОТ:', parseInt(withPayroll));
    console.log('Без ФОТ:', parseInt(withoutPayroll));
    console.log('Процент заполнения:', ((parseInt(withPayroll) / parseInt(totalEmployees)) * 100).toFixed(2) + '%');
    
    // Показываем примеры сотрудников с payroll
    const examples = await db.queryRows(
      "SELECT table_number, full_name, payroll FROM employees WHERE payroll IS NOT NULL LIMIT 10"
    );
    
    if (examples.length > 0) {
      console.log('\nПримеры сотрудников с заполненным ФОТ:');
      examples.forEach(emp => {
        console.log(`${emp.table_number} | ${emp.full_name} | ФОТ: ${emp.payroll}`);
      });
    }
    
    // Показываем примеры сотрудников БЕЗ payroll
    const withoutExamples = await db.queryRows(
      "SELECT table_number, full_name FROM employees WHERE payroll IS NULL LIMIT 5"
    );
    
    if (withoutExamples.length > 0) {
      console.log('\nПримеры сотрудников БЕЗ ФОТ:');
      withoutExamples.forEach(emp => {
        console.log(`${emp.table_number} | ${emp.full_name}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
}

checkPayroll();