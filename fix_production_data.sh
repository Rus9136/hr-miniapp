#!/bin/bash

# Скрипт для исправления данных в продакшн БД (Docker)

echo "=== Исправление данных времени для сотрудника АП00-00231 ==="
echo ""
echo "1. Подключаемся к Docker контейнеру с БД..."

# Выполняем SQL команды в контейнере PostgreSQL
docker exec -i hr-miniapp-postgres-1 psql -U hr_user -d hr_tracker << 'EOF'

-- Показываем текущее количество записей
SELECT COUNT(*) as current_count FROM time_events 
WHERE employee_number = 'АП00-00231' 
AND event_datetime >= '2025-05-01' 
AND event_datetime <= '2025-05-31';

-- Удаляем старые тестовые данные
DELETE FROM time_events 
WHERE employee_number = 'АП00-00231' 
AND event_datetime >= '2025-05-01' 
AND event_datetime <= '2025-05-31';

-- Удаляем старые записи из time_records
DELETE FROM time_records 
WHERE employee_number = 'АП00-00231' 
AND date >= '2025-05-01' 
AND date <= '2025-05-31';

EOF

echo ""
echo "2. Старые данные удалены. Теперь нужно загрузить новые через админ-панель."
echo ""
echo "ВАЖНО: Перейдите в админ-панель и выполните загрузку:"
echo "  1. Откройте https://madlen.space/HR/admin.html"
echo "  2. Войдите с табельным номером: admin12qw"
echo "  3. Нажмите 'Загрузить табель'"
echo "  4. Укажите:"
echo "     - Табельный номер: АП00-00231"
echo "     - Дата начала: 2025-05-01"
echo "     - Дата конца: 2025-05-31"
echo "     - БИН организации: 241240023631"
echo "  5. Нажмите 'Загрузить'"
echo ""
echo "После загрузки можно пересчитать записи времени через кнопку 'Пересчитать рабочее время'"