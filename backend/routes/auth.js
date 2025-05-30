const express = require('express');
const router = express.Router();
const db = require('../database');

router.post('/login', (req, res) => {
  const { tableNumber } = req.body;

  if (!tableNumber) {
    return res.status(400).json({ error: 'Table number is required' });
  }

  db.get(
    `SELECT e.*, d.object_name as department_name, p.staff_position_name as position_name
     FROM employees e
     LEFT JOIN departments d ON e.object_code = d.object_code
     LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
     WHERE e.table_number = ?`,
    [tableNumber],
    (err, employee) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      res.json({
        id: employee.id,
        tableNumber: employee.table_number,
        fullName: employee.full_name,
        department: employee.department_name,
        position: employee.position_name,
        objectBin: employee.object_bin
      });
    }
  );
});

module.exports = router;