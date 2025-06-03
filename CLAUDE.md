# HR Time Tracking Mini App - Claude Code Context

## Обзор проекта
Веб-приложение для учета рабочего времени сотрудников с интеграцией внешнего API системы учета по отпечаткам пальцев.

## Архитектура
- **Backend**: Node.js + Express + PostgreSQL (migrated from SQLite)
- **Frontend**: Vanilla JS + HTML/CSS + Telegram Mini App SDK
- **Порты**: Backend - 3030, Frontend - 5555
- **Deployment**: Docker + Nginx + HTTPS (madlen.space)

## Ключевые команды
```bash
# Установка и запуск
npm install && npm start

# Запуск только backend
node backend/server.js

# Запуск только frontend
python3 -m http.server 5555

# Перезапуск серверов
pkill -f "node backend/server.js" && pkill -f "python3 -m http.server"
node backend/server.js > server.log 2>&1 & python3 -m http.server 5555 > frontend.log 2>&1 &

# 🆕 Отладка с улучшенным логированием
lsof -ti:3030 | xargs kill -9; sleep 2; node backend/server.js > server_debug.log 2>&1 &

# 🆕 Добавление тестовых данных
node add_test_data.js

# 🆕 Проверка содержимого БД
node check_db.js
```

## API эндпоинты

### Основное приложение
- `POST /api/login` - вход по табельному номеру
- `GET /api/employee/:id/timesheet/:year/:month` - календарь посещений (legacy)
- `GET /api/employee/by-number/:tableNumber/timesheet/:year/:month` - календарь посещений ✅
- `GET /api/employee/:id/statistics/:year/:month` - статистика за месяц
- `GET /api/employee/:id/time-events` - события входа/выхода (legacy)
- `GET /api/employee/by-number/:tableNumber/time-events` - события входа/выхода ✅

### 🆕 Отладочные эндпоинты
- `GET /api/employee/debug/:tableNumber` - поиск сотрудника по табельному номеру
- `GET /api/health` - проверка состояния сервера

### Админ-панель
- `GET /api/admin/employees` - список сотрудников с пагинацией
- `GET /api/admin/departments` - список подразделений
- `GET /api/admin/positions` - список должностей
- `POST /api/admin/sync/employees` - синхронизация сотрудников
- `POST /api/admin/sync/departments` - синхронизация подразделений
- `POST /api/admin/sync/positions` - синхронизация должностей
- `POST /api/admin/load/timesheet` - загрузка табельных данных с прогрессом
- `GET /api/admin/load/progress/:id` - статус загрузки
- `GET /api/admin/time-events` - события входа/выхода с фильтрацией
- `GET /api/admin/time-records` - обработанные записи времени
- `POST /api/admin/recalculate-time-records` - пересчет рабочего времени

## Внешний API
База: http://tco.aqnietgroup.com:5555/v1
- `/objects` - подразделения
- `/staff_position` - должности  
- `/staff` - сотрудники
- `/event/filter` - события входа/выхода

### Требования к внешнему API
- **Проблема**: Все эндпоинты возвращают пустые массивы (статус 200 OK)
- **Возможные причины**: 
  - Требуется аутентификация (токены, ключи API)
  - Нет данных в системе
  - Неправильные параметры запроса
- **Решение**: Создан fallback с тестовыми данными в локальной БД

## Тестовые данные
Табельный номер для тестирования: **АП00-00358**
(Суиндикова Сайраш Агабековна - есть данные за май 2025)

### 🆕 Детальные тестовые данные (добавлены 2025-06-02)
- **10 событий входа/выхода** за май 2025
- **5 обработанных записей времени** с различными статусами:
  - 2025-05-01: on_time (8:45-18:15, 9.5ч)
  - 2025-05-02: late (9:15-18:00, 8.75ч) 
  - 2025-05-03: early_leave (8:30-17:30, 9.0ч)
  - 2025-05-06: on_time (9:00-18:00, 9.0ч)
  - 2025-05-07: on_time (8:55-18:10, 9.25ч)

## Архитектура приложения

### Экраны приложения:
1. **Экран входа** - авторизация по табельному номеру
2. **Главное меню** - 5 карточек:
   - 📰 Новости компании
   - 📅 Проверить посещаемость
   - 💰 Расчет зарплаты
   - 🏖️ График отпусков
   - 👥 HR отдел
3. **Календарь посещаемости** - полностью функционален
4. **Остальные разделы** - заглушки "Страница в разработке"

## Админ-панель
Доступ: табельный номер **admin12qw**

### Функционал:
1. **Справочники** - просмотр списков сотрудников, подразделений, должностей
2. **Загрузка данных**:
   - Синхронизация с внешним API (подразделения, должности, сотрудники)
   - Загрузка табельных данных из Excel файлов
   - Отображение статуса последней синхронизации
   - Прогресс-бар для длительных операций

## Известные особенности
1. Табельные номера содержат буквы - используется input type="text"
2. При проблемах с отображением экранов добавлен fallback через style.display
3. Python HTTP сервер используется вместо http-server для стабильности
4. Внешний API часто не возвращает данные - созданы тестовые записи

## 🆕 Исправленные проблемы (2025-06-02)
1. **Database compatibility**: Все API эндпоинты переведены на PostgreSQL
2. **Employee ID mapping**: Фронтенд теперь использует табельные номера вместо ID
3. **Date formatting**: PostgreSQL даты конвертируются в строки формата YYYY-MM-DD
4. **Error handling**: Добавлена детальная отладка и улучшенные сообщения об ошибках

## Синхронизация ID сотрудников
- **✅ Решено**: Несоответствие между внутренними ID и табельными номерами
- **Решение**: Созданы альтернативные API эндпоинты по табельному номеру
- **Legacy endpoints**: Старые эндпоинты по ID оставлены для совместимости
- **Рекомендация**: Использовать новые эндпоинты `/api/employee/by-number/:tableNumber/*`

## Структура БД (PostgreSQL)
- **departments** - подразделения (с иерархией parent_id)
- **positions** - должности (связаны с department_id)
- **employees** - сотрудники (уникальный table_number)
- **time_events** - события входа/выхода (сырые данные)
- **time_records** - обработанные записи времени (агрегированные)
- **work_schedules** - графики работы (заглушка, планируется развитие)
- **users** - пользователи системы (для админ-панели + Telegram linking)

### Индексы для производительности
```sql
CREATE INDEX idx_time_events_employee_date ON time_events(employee_number, event_datetime);
CREATE INDEX idx_employees_number ON employees(table_number);
CREATE INDEX idx_time_records_employee_date ON time_records(employee_number, date);
```

### 🆕 Отладочные утилиты
- **test_debug.html** - веб-консоль для тестирования API
- **add_test_data.js** - скрипт добавления тестовых данных
- **check_db.js** - проверка содержимого базы данных

## Логика определения статусов
- **Вовремя**: приход до 9:00 (зеленый цвет #28a745)
- **Опоздание**: приход после 9:00 (желтый цвет)
- **Ранний уход**: уход до 18:00 (оранжевый цвет)
- **Отсутствие**: нет данных о приходе (красный цвет)
- **Нет выхода**: есть вход, но нет выхода