-- Миграция для добавления колонки employee_iin в таблицу users
-- Автор: система
-- Дата: 2025-06-19

-- Добавляем колонку employee_iin
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS employee_iin VARCHAR(12);

-- Создаем индекс для производительности
CREATE INDEX IF NOT EXISTS idx_users_employee_iin ON users(employee_iin);

-- Обновляем существующие записи, заполняя employee_iin на основе employee_number
UPDATE users 
SET employee_iin = e.iin
FROM employees e 
WHERE users.employee_number = e.table_number 
AND users.employee_iin IS NULL;