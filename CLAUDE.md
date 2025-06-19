# HR Time Tracking Mini App - Claude Code Context

## 🎯 Быстрый старт
```bash
# Запуск проекта
npm install && npm start

# Docker deployment
docker-compose up -d

# Проверка состояния
curl https://madlen.space/api/health
```

## 📋 О проекте
**HR Time Tracking** - система учета рабочего времени с поддержкой Telegram Mini App и iOS WebView.

### Ключевые особенности:
- ✅ Авторизация по ИИН (12 цифр)
- ✅ Telegram Mini App интеграция
- ✅ iOS WebView поддержка
- ✅ Расчет ночных смен
- ✅ Админ-панель с синхронизацией 1С
- ✅ Docker deployment на madlen.space

## 🏗️ Архитектура
```
Backend:  Node.js + Express + PostgreSQL
Frontend: Vanilla JS + Telegram SDK + iOS Adapters
Deploy:   Docker + Nginx + HTTPS
Порты:    Backend: 3030, Frontend: 5555
URL:      https://madlen.space/
```

## 📁 Структура документации
```
/root/projects/hr-miniapp/
├── CLAUDE.md          # Этот файл - контекст для Claude
├── README.md          # Для разработчиков
├── PROJECT_STATE.md   # История развития проекта
├── CHANGELOG.md       # История версий
└── docs/
    ├── API.md         # Документация API
    ├── DEPLOYMENT.md  # Инструкции по деплою
    └── TROUBLESHOOTING.md # Решение проблем
```

## 🛠️ Основные команды
```bash
# Быстрый запуск
npm install && npm start

# Docker операции
docker-compose up -d        # Запуск
docker-compose down         # Остановка (БЕЗ флага -v!)
docker-compose logs -f      # Логи
docker-compose restart      # Перезапуск контейнеров

# Отладка
node add_test_data.js       # Добавить тестовые данные
node check_db.js            # Проверить БД
node test_night_shift_fix.js # Тест ночных смен
```

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Работа с Docker volumes
**НИКОГДА НЕ ИСПОЛЬЗУЙТЕ:**
- `docker-compose down -v` - удаляет ВСЕ данные БД!
- `docker-compose up --force-recreate -v` - тоже удаляет volumes!

**ПРАВИЛЬНЫЕ команды:**
- `docker-compose down` - просто остановка
- `docker-compose restart` - перезапуск без потери данных
- `docker-compose up -d --build` - пересборка с сохранением БД

## 🔑 Доступы и тестовые данные
```
Админ-панель:    admin12qw
Тест ИИН:        123456789012 (Суиндикова С.А.)
Ночные смены:    830909401891 (Шегирбаева Г.Б.)
Табельный номер: АП00-00467 (для ночных смен)
```

## API эндпоинты

### Основное приложение
- `POST /api/login` - вход по ИИН (12-значный номер) или админ-пароль
- `GET /api/employee/:id/timesheet/:year/:month` - календарь посещений (legacy)
- `GET /api/employee/by-number/:tableNumber/timesheet/:year/:month` - календарь посещений ✅
- `GET /api/employee/:id/statistics/:year/:month` - статистика за месяц
- `GET /api/employee/:id/time-events` - события входа/выхода (legacy)
- `GET /api/employee/by-number/:tableNumber/time-events` - события входа/выхода ✅
- `GET /api/employee/by-number/:tableNumber/department-stats/:year/:month` - статистика подразделения ✅

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
🆕 **Авторизация по ИИН**:
- ИИН для тестирования: **123456789012** (Суиндикова Сайраш Агабековна)
- ИИН для ночных смен: **830909401891** (Шегирбаева Гульнур Бегалиевна)
- Админ доступ: **admin12qw**
- Валидация ИИН убрана - любой формат принимается, ошибка показывается как "Сотрудник не найден"

### 🆕 Детальные тестовые данные (добавлены 2025-06-02)
- **10 событий входа/выхода** за май 2025
- **5 обработанных записей времени** с различными статусами:
  - 2025-05-01: on_time (8:45-18:15, 9.5ч)
  - 2025-05-02: late (9:15-18:00, 8.75ч) 
  - 2025-05-03: early_leave (8:30-17:30, 9.0ч)
  - 2025-05-06: on_time (9:00-18:00, 9.0ч)
  - 2025-05-07: on_time (8:55-18:10, 9.25ч)

### 🌙 Данные для ночных смен (добавлены 2025-06-04)
Табельный номер для тестирования ночных смен: **АП00-00467**
(Шегирбаева Гульнур Бегалиевна - ночная смена 22:00-06:00)

- **График работы**: "Ночная смена 22:00-06:00" (8 часов)
- **Тестовые записи**:
  - 2025-06-01: night_shift_on_time (22:00-06:00, 8.0ч)
  - 2025-06-02: night_shift_on_time (22:00-06:00, 8.0ч)
  - 2025-06-03: night_shift_on_time (22:00-06:00, 8.0ч)
  - 2025-06-04: night_shift_auto (22:00-06:00, 8.0ч)

## Архитектура приложения

### Экраны приложения:
1. **Экран входа** - авторизация по ИИН (12 цифр) с валидацией
2. **Главное меню** - 5 карточек:
   - 📰 Новости компании
   - 📅 Проверить посещаемость
   - 💰 Расчет зарплаты
   - 🏖️ График отпусков
   - 👥 HR отдел
3. **Календарь посещаемости** - полностью функционален
4. **Остальные разделы** - заглушки "Страница в разработке"

## Админ-панель
Доступ: пароль **admin12qw** (вводится в поле ИИН)

### Функционал:
1. **Справочники** - просмотр списков сотрудников, подразделений, должностей
2. **Загрузка данных**:
   - Синхронизация с внешним API (подразделения, должности, сотрудники)
   - Загрузка табельных данных из Excel файлов
   - Отображение статуса последней синхронизации
   - Прогресс-бар для длительных операций

## Известные особенности
1. 🆕 Авторизация теперь происходит по ИИН (12 цифр) вместо табельного номера
2. ИИН валидируется на клиенте и сервере (должен состоять из 12 цифр)
3. Админ-доступ остается через пароль admin12qw
4. Telegram привязка также работает через ИИН
5. При проблемах с отображением экранов добавлен fallback через style.display
6. Python HTTP сервер используется вместо http-server для стабильности
7. Внешний API часто не возвращает данные - созданы тестовые записи

## 🆕 Исправленные проблемы (2025-06-11)

### 2025-06-11 17:40 - iOS WebView Integration + Critical Navigation Fixes
1. **iOS WebView Architecture**: Создана полная архитектура поддержки iOS WebView с паттерном адаптеров
2. **Platform Detection**: Универсальная система определения платформы (Web/Telegram/iOS)
3. **Navigation Conflicts**: Исправлен критический конфликт между глобальными и локальными обработчиками навигации
4. **Admin Panel Fix**: Решена проблема с кнопками админ-панели, которые перенаправляли на логин
5. **User Menu Fix**: Исправлены неотвечающие кнопки в пользовательском меню

### 2025-06-05 - Previous Issues Fixed

### 2025-06-05 13:50 - Department Statistics Schedule Display
1. **Department stats schedule display**: Графики не отображались для дней с фактическими данными работы
2. **Fallback schedule logic**: Добавлена логика извлечения времени из названий графиков (regex pattern)
3. **Missing work_schedules_1c records**: Обработка случаев отсутствия точных записей дат в базе
4. **Schedule assignment edge cases**: Поддержка случаев, когда назначение начинается после фактических данных

### 2025-06-05 10:45 - Calendar Weekend Display  
1. **Calendar weekend display**: Выходные дни не показывают время графика в календаре и модальном окне
2. **Modal window logic**: Скрытие секции плановых данных для выходных дней
3. **Schedule time rendering**: Добавлена проверка статуса дня при отображении времени

## Исправленные проблемы (2025-06-02)
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
- **employees** - сотрудники (уникальный table_number, ИИН в колонке iin)
- **time_events** - события входа/выхода (сырые данные)
- **time_records** - обработанные записи времени (агрегированные)
- **work_schedules** - графики работы (заглушка, планируется развитие)
- **work_schedules_1c** - графики работы из 1С (115 графиков, реальные данные)
- **employee_schedule_assignments** - назначения графиков сотрудникам (422 назначения)
- **users** - пользователи системы (для админ-панели + Telegram linking, добавлена колонка employee_iin)

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
- **🌙 test_night_shift_fix.js** - тестирование расчета ночных смен
- **NIGHT_SHIFT_SOLUTIONS_REPORT.md** - полный отчет по решению ночных смен

## Логика определения статусов

### Дневные смены
- **Вовремя**: приход до 9:00 (зеленый цвет #28a745)
- **Опоздание**: приход после 9:00 (желтый цвет)
- **Ранний уход**: уход до 18:00 (оранжевый цвет)
- **Отсутствие**: нет данных о приходе (красный цвет)
- **Нет выхода**: есть вход, но нет выхода

### 🌙 Ночные смены (добавлено 2025-06-04)
- **night_shift_on_time**: приход в пределах 5 минут от графика
- **night_shift_late**: опоздание более 5 минут
- **night_shift_early_leave**: ранний уход (менее 80% ожидаемых часов)
- **night_shift_auto**: автоматически рассчитанные часы

### Универсальная логика расчета ночных смен
```javascript
// Критерии определения ночной смены:
const isNightShift = startTime && endTime && (
    startTime > endTime ||                          // 22:00-06:00
    expectedHours > 12 ||                          // Длинные смены  
    (startTime >= "22:00" || startTime >= "23:00") || // Поздний старт
    (endTime <= "08:00" || endTime <= "06:00") ||     // Ранний конец
    scheduleName.includes('ночная') ||               // Ключевые слова
    scheduleName.includes('00:00')                   // Полночь
);

// Стратегии расчета:
// 1. Если выход < входа → добавляем 24 часа
// 2. Валидация против ожидаемых часов
// 3. Обработка краевых случаев
```

### Поддерживаемые типы смен
- **8ч дневные**: 08:00-17:00, 09:00-18:00
- **8ч ночные**: 22:00-06:00, 23:00-07:00  
- **12ч расширенные**: 06:00-18:00, 18:00-06:00
- **14ч торговые**: 10:00-00:00 (City mall)
- **24ч непрерывные**: 00:00-12:00

## 🆕 Последние изменения (2025-06-18)
- **Очистка проекта**: Удалено 92 временных файла
- **Оптимизация**: Размер проекта уменьшен до 128MB
- **Документация**: Создана новая структура docs/
- **Стабильность**: Все системы работают корректно

## 🎨 Обновление стилей Telegram (2025-06-19)

### Проблема с кэшированием в мобильном Telegram
Мобильное приложение Telegram агрессивно кэширует CSS и JS файлы, из-за чего стили не обновляются.

### ✅ Правильный способ обновления стилей:

1. **Обновить CSS файлы**:
   ```bash
   # Редактируем стили в telegram.css или style.css
   nano telegram.css
   
   # Копируем в контейнер
   docker cp telegram.css hr-miniapp:/app/telegram.css
   docker cp style.css hr-miniapp:/app/style.css
   
   # Перезагружаем nginx
   docker exec hr-nginx nginx -s reload
   ```

2. **Изменить версии файлов в index.html**:
   ```html
   <!-- Старая версия -->
   <link rel="stylesheet" href="telegram.css?v=8.6">
   
   <!-- Новая версия с новой временной меткой -->
   <link rel="stylesheet" href="telegram.css?v=9.0&ts=20250619">
   ```

3. **Для пользователей Telegram**:
   - Полностью закрыть мини-приложение
   - Настройки Telegram → Данные и память → Очистить кэш
   - Перезапустить Telegram
   - Открыть мини-приложение заново

### 🔧 Критические стили для мобильного Telegram:
```css
/* Принудительные цвета для календаря */
.calendar-day--present { background-color: #28a745 !important; }
.calendar-day--planned { background-color: #ffc107 !important; }
.calendar-day--absent { background-color: #dc3545 !important; }

/* Скрытие текста статусов на мобильных */
@media screen and (max-width: 600px) {
  .calendar-day .day-status { display: none !important; }
}
```

### 📱 Структура файлов стилей:
- `style.css` - основные стили (работает везде)
- `telegram.css` - переопределения для Telegram
- `telegram-mobile-fix.css` - критические исправления для мобильного

## 📅 Календарь посещаемости - Инструкция для разработчиков

### 🎯 Ключевые файлы для работы с календарём:
- **`app.js`** - основная логика календаря (функции `renderCalendar`, `getStatusText`)
- **`backend/routes/employee.js`** - API эндпоинт `/timesheet/:year/:month`
- **`style.css`** - базовые стили календаря
- **`telegram-mobile-fix.css`** - исправления для мобильного Telegram

### 🔧 Как изменить отображение статусов:

#### 1. **Изменить текст статусов**:
```javascript
// Файл: app.js, функция getStatusText()
const statusMap = {
    'present': 'Присутствие',    // ← Изменить здесь
    'absent': 'Отсутствие', 
    'planned': 'График',         // ← Было "Запланировано"
    'weekend': 'Выходной'
};
```

#### 2. **Изменить логику отображения времени**:
```javascript
// Файл: app.js, функция renderCalendar()

// Для статуса "Присутствие" - показывать фактическое время
if (day.status === 'present' && (day.checkIn || day.checkOut)) {
    // Используем поля: day.checkIn, day.checkOut
}

// Для остальных статусов - показывать время графика
else if (day.scheduleStartTime && day.scheduleEndTime) {
    // Используем поля: day.scheduleStartTime, day.scheduleEndTime
}
```

#### 3. **Изменить размеры шрифтов в Telegram**:
```css
/* Файл: telegram-mobile-fix.css */
@media screen and (max-width: 600px) {
  .calendar-day .day-status {
    font-size: 7px !important;  /* ← Размер статуса */
  }
  
  .calendar-day .day-schedule {
    font-size: 6px !important;  /* ← Размер времени */
  }
}
```

#### 4. **Изменить цвета дней**:
```css
/* Файл: style.css и telegram.css */
.calendar-day--present { background-color: #28a745; }  /* Зелёный */
.calendar-day--planned { background-color: #ffc107; }  /* Жёлтый */
.calendar-day--absent { background-color: #dc3545; }   /* Красный */
.calendar-day--weekend { background-color: #495057; } /* Серый */
```

### 🗄️ Структура данных API:

#### Поля для каждого дня календаря:
```javascript
{
  date: "2025-06-19",
  day: 19,
  status: "present",              // present, absent, planned, weekend
  
  // Фактическое время (для статуса present)
  checkIn: "2025-06-19T01:15:00.000Z",   // Время входа
  checkOut: "2025-06-19T10:30:00.000Z",  // Время выхода
  
  // Плановое время (для статуса planned)
  scheduleStartTime: "08:00:00",          // Начало графика
  scheduleEndTime: "22:00:00",            // Конец графика
  
  hoursWorked: 9.25                       // Отработанные часы
}
```

### 🚀 Процедура обновления после изменений:

#### 1. **Изменить версии файлов** (для сброса кэша Telegram):
```html
<!-- Файл: index.html -->
<script src="app.js?v=final-v10.3&ts=новая-метка"></script>
<link rel="stylesheet" href="telegram-mobile-fix.css?v=6.0&ts=новая-метка">
```

#### 2. **Пересобрать Docker**:
```bash
docker-compose up -d --build
```

#### 3. **Очистить кэш Telegram**:
- Закрыть мини-приложение
- Настройки → Данные и память → Очистить кэш
- Перезапустить Telegram

### 🔍 Отладка проблем с календарём:

#### Если статусы не отображаются:
1. Проверить CSS правила в `telegram-mobile-fix.css`
2. Убедиться что `display: block !important` для статусов
3. Проверить размер шрифта (не меньше 6px)

#### Если время не отображается:
1. Проверить поля API: `checkIn`, `checkOut`, `scheduleStartTime`, `scheduleEndTime`
2. Проверить форматирование времени в функции `formatTimestamp`
3. Убедиться что CSS не скрывает элементы `.day-schedule`

#### Если цвета неправильные:
1. Проверить CSS классы: `calendar-day--present`, `calendar-day--planned`, etc.
2. Убедиться что `!important` применяется для мобильного Telegram
3. Проверить правильность статусов от API

### 📱 Особенности мобильного Telegram:
- **Агрессивное кэширование** - обязательно менять версии файлов
- **Маленький экран** - использовать мелкие шрифты (6-7px)
- **Тёмная тема** - учитывать контрастность цветов
- **Специальные CSS правила** - использовать `telegram-mobile-fix.css`

## ⚠️ Важные замечания
1. **Не создавайте SESSION_LOG файлы** - обновляйте этот файл
2. **API по табельному номеру** - используйте `/api/employee/by-number/`
3. **Python сервер** - используем вместо http-server для стабильности
4. **Внешний API** - часто возвращает пустые массивы, есть fallback
5. **НИКОГДА не используйте docker-compose down -v** - удаляет всю БД!