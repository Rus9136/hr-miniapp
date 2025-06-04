#!/bin/bash

echo "=== Деплой изменений в продакшн ==="
echo ""

# 1. Копируем обновленный файл в Docker контейнер
echo "1. Обновляем код в Docker контейнере..."
docker cp backend/utils/apiSync_pg.js hr-miniapp:/app/backend/utils/apiSync_pg.js

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