#!/bin/bash

echo "Останавливаем контейнеры..."
docker-compose down

echo "Очищаем кэш Docker..."
docker system prune -f

echo "Пересобираем образы без кэша..."
docker-compose build --no-cache

echo "Запускаем контейнеры..."
docker-compose up -d

echo "Готово! Изменения должны быть видны."
echo ""
echo "Также рекомендуется очистить кэш браузера:"
echo "- Chrome/Edge: Ctrl+Shift+R или Cmd+Shift+R (Mac)"
echo "- Firefox: Ctrl+F5"
echo "- Safari: Cmd+Option+R"