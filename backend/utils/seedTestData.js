const db = require('../database');

function seedTestData() {
  // Найдем ID сотрудника АП00-00358
  db.get('SELECT id, table_number, full_name FROM employees WHERE table_number = ?', ['АП00-00358'], (err, employee) => {
    if (err || !employee) {
      console.log('Employee АП00-00358 not found');
      return;
    }
    
    console.log('Creating test data for:', employee.full_name);
    
    // Создадим записи за май 2025
    const year = 2025;
    const month = 5;
    const workDays = [1, 2, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30];
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO time_records 
      (employee_id, date, check_in, check_out, hours_worked, status, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    workDays.forEach(day => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Генерируем случайное время прихода (8:30 - 9:30)
      const checkInHour = 8 + Math.floor(Math.random() * 2);
      const checkInMinute = Math.floor(Math.random() * 60);
      const checkIn = `${date} ${String(checkInHour).padStart(2, '0')}:${String(checkInMinute).padStart(2, '0')}:00`;
      
      // Генерируем время ухода (17:30 - 19:00)
      const checkOutHour = 17 + Math.floor(Math.random() * 2);
      const checkOutMinute = 30 + Math.floor(Math.random() * 30);
      const checkOut = `${date} ${String(checkOutHour).padStart(2, '0')}:${String(checkOutMinute).padStart(2, '0')}:00`;
      
      // Рассчитываем отработанные часы
      const hoursWorked = checkOutHour - checkInHour + (checkOutMinute - checkInMinute) / 60;
      
      // Определяем статус
      let status = 'on_time';
      if (checkInHour >= 9 && checkInMinute > 0) {
        status = 'late';
      }
      if (checkOutHour < 18) {
        status = 'early_leave';
      }
      
      stmt.run(employee.id, date, checkIn, checkOut, hoursWorked.toFixed(2), status);
    });
    
    stmt.finalize(() => {
      console.log('Test data created successfully');
    });
  });
}

// Запускаем создание тестовых данных
seedTestData();