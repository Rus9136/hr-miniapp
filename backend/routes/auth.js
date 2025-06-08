const express = require('express');
const router = express.Router();
const db = require('../database_pg');

router.post('/login', (req, res) => {
  const { tableNumber, iin } = req.body;

  // Support both old (tableNumber) and new (iin) parameters
  if (!tableNumber && !iin) {
    return res.status(400).json({ error: 'IIN or table number is required' });
  }

  // Check if admin (using tableNumber for backward compatibility)
  if (tableNumber === 'admin12qw') {
    return res.json({
      id: 0,
      tableNumber: 'admin12qw',
      fullName: 'Администратор',
      department: 'IT',
      position: 'System Administrator',
      objectBin: '000000000000',
      isAdmin: true
    });
  }

  // If IIN is provided, use it; otherwise fall back to tableNumber
  const searchParam = iin || tableNumber;
  const searchField = iin ? 'iin' : 'table_number';
  
  // No strict validation - let database handle it

  db.queryRow(
    `SELECT e.*, d.object_name as department_name, p.staff_position_name as position_name
     FROM employees e
     LEFT JOIN departments d ON e.object_code = d.object_code
     LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
     WHERE e.${searchField} = $1`,
    [searchParam]
  ).then(employee => {
    if (!employee) {
      return res.status(404).json({ error: iin ? 'Сотрудник с таким ИИН не найден' : 'Employee not found' });
    }

    res.json({
      id: employee.id,
      tableNumber: employee.table_number,
      fullName: employee.full_name,
      department: employee.department_name,
      position: employee.position_name,
      objectBin: employee.object_bin,
      iin: employee.iin
    });
  }).catch(err => {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
});

module.exports = router;