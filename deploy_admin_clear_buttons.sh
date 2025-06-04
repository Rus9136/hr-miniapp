#!/bin/bash

echo "=== Деплой функционала очистки таблиц в продакшн ==="
echo ""

# 1. Копируем обновленные файлы в Docker контейнер
echo "1. Обновляем файлы в Docker контейнере..."
docker cp backend/routes/admin.js hr-miniapp:/app/backend/routes/admin.js
docker cp index.html hr-miniapp:/app/index.html
docker cp admin.js hr-miniapp:/app/admin.js
docker cp style.css hr-miniapp:/app/style.css

# 2. Перезапускаем контейнер
echo ""
echo "2. Перезапускаем контейнер..."
docker restart hr-miniapp

# 3. Ждем запуска
echo ""
echo "3. Ждем запуска сервера..."
sleep 10

# 4. Проверяем статус
echo ""
echo "4. Проверяем статус..."
curl -s https://madlen.space/api/health | jq .

echo ""
echo "Деплой завершен!"
echo ""
echo "Новые возможности:"
echo "- Кнопка '🗑️ Очистить таблицу' в разделе 'Входы/выходы'"
echo "- Кнопка '🗑️ Очистить таблицу' в разделе 'Табель рабочего времени'"
echo "- Двойное подтверждение перед удалением"
echo "- Автоматическое обновление таблицы после очистки"