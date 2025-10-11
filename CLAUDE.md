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
- ✅ AI-рекомендации с мультиагентным анализом 🤖
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
├── MULTIPROVIDER_AI_SYSTEM_DOCS.md  # 🆕 Документация мультипровайдерной AI системы
├── add-provider-column.sql  # 🆕 SQL миграция для поддержки провайдеров
├── test-final-validation.js  # 🆕 Тест валидации AI системы
├── .claude/           # 🆕 Claude Code конфигурация
│   └── agents/        # 🆕 Специализированные субагенты
│       ├── README.md  # Документация системы агентов
│       ├── code-reviewer.md
│       ├── security-auditor.md
│       ├── database-migration-manager.md
│       ├── ai-system-optimizer.md
│       ├── docker-deployment-manager.md
│       ├── api-testing-specialist.md
│       ├── documentation-maintainer.md
│       └── performance-monitor.md
└── docs/
    ├── API.md         # Документация API
    ├── DEPLOYMENT.md  # Инструкции по деплою
    ├── TROUBLESHOOTING.md # Решение проблем
    └── 🆕 Интеграция с 1С (полный пакет документации):
        ├── API_1C_INTEGRATION.md        # Полная документация (910 строк)
        ├── API_1C_QUICK_REFERENCE.md    # Быстрая справка
        ├── 1C_INTEGRATION_EXAMPLES.bsl  # Примеры кода на BSL (485 строк)
        ├── 1C_INTEGRATION_DIAGRAM.md    # Визуальные диаграммы
        ├── 1C_INTEGRATION_SUMMARY.md    # Краткая сводка
        └── README.md                    # Центральная документация
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

# AI система тестирование
node test_ai_direct.js      # Прямое тестирование AI анализа
node test_ai_full.js        # Полное тестирование AI системы
node test-final-validation.js  # 🆕 Полная валидация мультипровайдерной системы
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
- `GET /api/admin/organizations` - ✅ **НОВОЕ**: список организаций для фильтрации
- `GET /api/admin/schedules/1c/list` - ✅ **ОБНОВЛЕНО**: список графиков 1С с информацией об организациях
- `POST /api/admin/schedules/import-1c` - ✅ **ОБНОВЛЕНО**: импорт графиков из 1С (лимит увеличен до 500MB)
- `POST /api/admin/sync/employees` - синхронизация сотрудников
- `POST /api/admin/sync/departments` - синхронизация подразделений
- `POST /api/admin/sync/positions` - синхронизация должностей
- `POST /api/admin/load/timesheet` - загрузка табельных данных с прогрессом
- `GET /api/admin/load/progress/:id` - статус загрузки
- `GET /api/admin/time-events` - события входа/выхода с фильтрацией
- `GET /api/admin/time-records` - обработанные записи времени
- `POST /api/admin/recalculate-time-records` - пересчет рабочего времени

### 🤖 AI-рекомендации (обновлено 2025-07-15)
- `POST /api/admin/ai-recommendations/analyze` - запуск мультиагентного анализа подразделения
- `GET /api/admin/ai-recommendations/history` - история выполненных анализов
- `GET /api/admin/ai-recommendations/:id` - получение детального анализа по ID
- `GET /api/admin/ai-recommendations/prompts` - получение промптов агентов
- `PUT /api/admin/ai-recommendations/prompts` - обновление промптов агентов
- `POST /api/admin/ai-recommendations/rerun-agent` - перезапуск отдельного агента
- `POST /api/admin/ai-webhook-proxy` - отправка результатов на webhook
- `GET /api/admin/ai-recommendations/providers` - ✅ **НОВОЕ**: информация о доступных AI провайдерах
- `GET /api/admin/ai-recommendations/prompts/:analysisId` - ✅ **НОВОЕ**: отображение отправленных промптов для каждого агента

#### 🆕 Мультипровайдерная AI архитектура (версия 2.0)
**Endpoint:** `POST /api/admin/ai-recommendations/analyze`
**Параметры:**
- `department_id` (UUID) - идентификатор подразделения (поле id_iiko)
- `date_start` (YYYY-MM-DD) - начало периода анализа
- `date_end` (YYYY-MM-DD) - конец периода анализа 
- `reviews_count` (число) - количество отзывов для анализа (по умолчанию 50)
- `provider` (строка) - ✅ **НОВОЕ**: AI провайдер ("claude", "openai", "gemini")

**Поддерживаемые AI провайдеры:**
1. **Claude (Anthropic)** ✅ - основной провайдер, 5 изолированных API ключей
2. **OpenAI GPT-4o** ✅ - альтернативный провайдер, готов к использованию
3. **Google Gemini** ⏳ - запланирован к реализации

**Мультиагентная система (6 AI агентов):**
1. **SalesAnalysisAgent** 📈 - анализ прогнозов и динамики продаж
2. **PayrollAnalysisAgent** 💰 - анализ ФОТ и эффективности персонала
3. **StaffingAgent** 👥 - оптимизация распределения персонала по сменам
4. **ReputationAgent** ⭐ - анализ отзывов клиентов и проблем сервиса
5. **OptimizationAgent** 🎯 - конкретные шаги для улучшения операций
6. **NarrativeAgent** 📊 - итоговый бизнес-отчет для управляющего

**Интеграция с внешними API:**
- **MCP API** (https://mcp.madlen.space/api/v1) - получение данных подразделений
- **Anthropic Claude API** - основной AI провайдер (5 ключей)
- **OpenAI API** - альтернативный AI провайдер (GPT-4o)
- **Reviews API** - получение отзывов клиентов

### 🆕 Отчеты по ФОТ (добавлено 2025-07-03)
- `GET /api/admin/reports/payroll` - общий отчет ФОТ с группировкой по датам
- `GET /api/admin/payroll/attendance` - детализированный отчет ФОТ по сменам ✅

#### Новый API: Детализированный отчет ФОТ по сменам
**Endpoint:** `GET /api/admin/payroll/attendance`
**Параметры:**
- `department_id` (UUID) - идентификатор подразделения (поле id_iiko)
- `from_date` (YYYY-MM-DD) - начало периода
- `to_date` (YYYY-MM-DD) - конец периода

**Логика расчета:**
1. Находит всех сотрудников подразделения с ФОТ > 0
2. Для каждого сотрудника определяет смены в периоде по связке employee_schedule_assignments + work_schedules_1c
3. Рассчитывает ФОТ за смену = ФОТ сотрудника / количество смен в периоде
4. Исключает выходные дни (time_type = 'В')

**Пример ответа:**
```json
{
  "data": [
    {
      "employee_id": "123",
      "employee_name": "Иванов И.И.",
      "table_number": "АП00-00123", 
      "payroll_total": 300000,
      "shifts": [
        {
          "date": "2025-07-03",
          "payroll_for_shift": 100000.00,
          "schedule_name": "График 5/2",
          "work_hours": 8
        }
      ]
    }
  ],
  "summary": {
    "total_employees": 1,
    "total_shifts": 3,
    "total_payroll": 300000.00
  }
}
```

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
2. **🆕 Шаблоны графиков** - управление графиками работы из 1С с расширенным функционалом:
   - ✅ Фильтрация графиков по организациям с поиском
   - ✅ Отображение принадлежности графика к организации (БИН)
   - ✅ Увеличенный лимит импорта (до 500MB для больших файлов 1С)
   - ✅ SearchableDropdown компонент для работы с большими списками
3. **Загрузка данных**:
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

## 🆕 Исправленные проблемы (2025-08-14)

### 2025-08-14 15:00 - Organization Management UI Enhancement
1. **Organization Dropdown in Schedules List**: ✅ Исправлен выпадающий список организаций в форме списка графиков
2. **Organization Display in Schedule Cards**: ✅ Добавлено отображение организации на форме просмотра графика с БИН
3. **SearchableDropdown Component**: ✅ Создан универсальный компонент поиска для больших списков (>50 элементов)
4. **Upload Limits Enhancement**: ✅ Увеличены лимиты загрузки для 1С импорта (Express: 50MB, специальный endpoint: 500MB)
5. **API Enhancement**: ✅ Обновлен `/api/admin/schedules/1c/list` для возврата данных об организациях через сложные JOIN запросы
6. **Performance Optimization**: ✅ Добавлено кэширование организаций и виртуализация больших списков
7. **Auto-Enhancement**: ✅ Автоматическое превращение обычных select-списков в SearchableDropdown при количестве >50 элементов

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
- **test_organization_ui.html** - ✅ **НОВОЕ**: тестирование UI компонентов организаций
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

## 🤖 AI-рекомендации: Мультипровайдерная система (версия 2.0)

### 🆕 Переменные окружения
```bash
# .env.production (обязательно для Docker)
# Claude Configuration (основной провайдер)
ANTHROPIC_API_KEY=sk-ant-api03-...  # Основной API ключ для Claude
ANTHROPIC_API_KEY_PAYROLL=sk-ant-api03-...  # Ключ для PayrollAnalysisAgent
ANTHROPIC_API_KEY_STAFFING=sk-ant-api03-...  # Ключ для StaffingAgent  
ANTHROPIC_API_KEY_NARRATIVE=sk-ant-api03-...  # Ключ для NarrativeAgent
ANTHROPIC_API_KEY_REPUTATION=sk-ant-api03-...  # Ключ для ReputationAgent

# OpenAI Configuration (альтернативный провайдер)
OPENAI_API_KEY=sk-proj-...  # API ключ для OpenAI GPT-4o
OPENAI_MODEL=gpt-4o  # Модель по умолчанию
AI_DEFAULT_PROVIDER=claude  # Провайдер по умолчанию

# MCP API
MCP_API_BASE_URL=https://mcp.madlen.space/api/v1  # Базовый URL MCP API
```

### 🏗️ Структура файлов мультипровайдерной AI системы
```
backend/
├── engines/                     # 🆕 Мультипровайдерная архитектура
│   ├── base-engine.js           # Базовый интерфейс для всех провайдеров
│   ├── claude-engine.js         # Claude (Anthropic) движок
│   ├── openai-engine.js         # OpenAI GPT-4 движок  
│   ├── gemini-engine.js         # Google Gemini (заглушка)
│   ├── engine-dispatcher.js     # Диспетчер выбора провайдеров
│   └── index.js                 # Централизованный экспорт
├── routes/
│   └── ai-recommendations.js    # REST API для AI системы
├── services/
│   ├── anthropic-client.js      # Клиент для Claude API
│   ├── mcp-client.js            # Клиент для MCP API
│   └── multi-agent-system.js    # Обновленная мультиагентная система
frontend/
├── ai-recommendations.js        # Обновленная Frontend логика AI секции
├── ai-recommendations.css       # Стили для AI интерфейса
└── index.html                   # UI компоненты с выбором провайдера
```

### 🗄️ База данных (обновлена)
```sql
-- Таблицы для AI системы
CREATE TABLE ai_recommendations (
    id SERIAL PRIMARY KEY,
    department_id UUID NOT NULL,
    date_start DATE NOT NULL,
    date_end DATE NOT NULL,
    provider VARCHAR(50) DEFAULT 'claude',  -- 🆕 Новая колонка
    mcp_response JSONB,
    agent_results JSONB,  -- 📋 Хранит отчеты в разрезе агентов
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_prompts (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL UNIQUE,
    prompt_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_prompt_logs (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES ai_recommendations(id),
    agent_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50),
    full_prompt TEXT,
    system_prompt TEXT,
    response_text TEXT,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    tokens_used INTEGER,
    request_timestamp TIMESTAMP DEFAULT NOW(),
    response_timestamp TIMESTAMP
);
```

### 📊 Структура хранения результатов анализа
Результаты агентов хранятся в поле `agent_results` типа JSONB в виде объекта:
```json
{
  "SalesAnalysisAgent": "Текстовый отчет по анализу продаж...",
  "PayrollAnalysisAgent": "Текстовый отчет по анализу ФОТ...",
  "StaffingAgent": "Текстовый отчет по оптимизации персонала...",
  "ReputationAgent": "Текстовый отчет по анализу отзывов...",
  "OptimizationAgent": "Текстовый отчет с рекомендациями...",
  "NarrativeAgent": "Итоговый бизнес-отчет для управляющего..."
}
```

### 🎯 Использование мультипровайдерной AI системы
1. **Вход в админ-панель**: пароль `admin12qw`
2. **Выбор раздела**: "AI рекомендация"
3. **🆕 Выбор AI провайдера**: Claude, OpenAI или Gemini (dropdown)
4. **Выбор подразделения и дат**: максимум 30 дней
5. **Запуск анализа**: занимает 3-4 минуты для полного завершения
6. **Просмотр результатов**: каждого агента отдельно
7. **История анализов**: отображает название подразделения с провайдером (например: "Кофейня/Бакыт-Н2/АУП (CLAUDE)")
8. **Дополнительные функции**:
   - Отправка на webhook (опционально)
   - Редактирование промптов агентов
   - Экспорт в PDF
   - Повторный анализ отдельного агента
   - Просмотр логов промптов для диагностики

### 📊 Производительность провайдеров
- **Claude (Anthropic)**: ~6.7 секунд среднее время, стабильный
- **OpenAI GPT-4o**: ~9.4 секунды среднее время, современная модель
- **Google Gemini**: Планируется к реализации

### 🆕 Новые возможности версии 2.0
- **Выбор провайдера**: Динамический выбор через UI
- **Fallback система**: Автоматическое переключение при недоступности
- **Производительность**: Сравнение времени ответа провайдеров
- **Совместимость**: Единые промпты для всех провайдеров
- **Мониторинг**: Отслеживание использования провайдеров

### ⚠️ Известные ограничения
- **Таймаут**: анализ занимает 3-4 минуты, nginx может выдать 504
- **Reviews API**: некоторые подразделения могут не иметь отзывов
- **MCP API**: требует актуальные данные подразделений с id_iiko
- **Claude API**: 5 ключей для изоляции лимитов агентов
- **OpenAI API**: один ключ, ограничения по RPM/TPM
- **Сохранение результатов**: результаты сохраняются только после завершения всех 6 агентов

### ✅ Исправленные проблемы (2025-07-15)
- **Ограничение отзывов**: Убрано принудительное ограничение до 10 отзывов - теперь обрабатываются все запрошенные отзывы
- **Пустые тексты отзывов**: Исправлена обработка поля `text` в отзывах (было `comment`)
- **Отображение промптов**: Добавлена система вкладок для просмотра отправленных промптов каждого агента
- **Длина текста отзывов**: Увеличен лимит с 50 до 300 символов для сохранения контекста

## ⚠️ Важные замечания
1. **Не создавайте SESSION_LOG файлы** - обновляйте этот файл
2. **API по табельному номеру** - используйте `/api/employee/by-number/`
3. **Python сервер** - используем вместо http-server для стабильности
4. **Внешний API** - часто возвращает пустые массивы, есть fallback
5. **НИКОГДА не используйте docker-compose down -v** - удаляет всю БД!
6. **AI система требует .env.production** - для Docker deployment ✅
7. **🆕 Мультипровайдерная AI система готова** - поддержка Claude + OpenAI ✅
8. **Выполнена SQL миграция** - добавлена колонка provider в ai_recommendations ✅
9. **🆕 История анализов** - показывает провайдера в названии подразделения ✅
10. **🆕 Организации в админ-панели** - исправлена работа с выпадающими списками и отображением принадлежности графиков ✅

## 🤖 Claude Code Agents - Система специализированных субагентов

### 📋 Доступные агенты
В папке `.claude/agents/` созданы **8 специализированных субагентов** для автоматизации разработки:

1. **🔍 Code Reviewer** (`code-reviewer.md`) - Ревью кода Node.js/Express/PostgreSQL
2. **🛡️ Security Auditor** (`security-auditor.md`) - Аудит безопасности API и защита ПДн
3. **🗄️ Database Migration Manager** (`database-migration-manager.md`) - Управление миграциями PostgreSQL
4. **🤖 AI System Optimizer** (`ai-system-optimizer.md`) - Оптимизация мультиагентной AI системы
5. **🐳 Docker Deployment Manager** (`docker-deployment-manager.md`) - Управление Docker развертыванием
6. **🧪 API Testing Specialist** (`api-testing-specialist.md`) - Автоматизация тестирования REST API
7. **📚 Documentation Maintainer** (`documentation-maintainer.md`) - Поддержание актуальной документации
8. **📊 Performance Monitor** (`performance-monitor.md`) - Мониторинг производительности системы

### 🚀 Примеры использования агентов

#### Code Review
```bash
# Ревью конкретного файла
/code-review backend/routes/ai-recommendations.js

# Ревью с фокусом на безопасность
/code-review --security frontend/admin.js

# Ревью производительности
/code-review --performance backend/database.js
```

#### Security Audit
```bash
# Полный аудит безопасности
/security-audit --full-scan

# Аудит API endpoints
/security-audit --api-endpoints /api/admin/*

# Проверка защиты персональных данных
/security-audit --data-protection employees
```

#### Database Migrations
```bash
# Планирование миграции
/db-migrate --plan add_ai_provider_column

# Анализ производительности БД
/db-migrate --analyze performance_issues

# Откат миграции
/db-migrate --rollback 015_last_migration
```

#### AI System Optimization
```bash
# Анализ промптов
/ai-optimize --prompt-analysis SalesAnalysisAgent

# Снижение затрат
/ai-optimize --cost-reduction claude

# Настройка производительности
/ai-optimize --performance-tuning all-agents
```

#### Docker Deployment
```bash
# Развертывание в продакшн
/docker-deploy --production madlen.space

# Оптимизация размера контейнеров
/docker-deploy --optimize container-size

# Откат к предыдущей версии
/docker-deploy --rollback previous-version
```

#### API Testing
```bash
# Функциональное тестирование
/api-test --functional /api/login

# Нагрузочное тестирование
/api-test --performance --load=50rps

# Тестирование безопасности
/api-test --security --scan-endpoints
```

#### Documentation Maintenance
```bash
# Обновление API документации
/docs-update --api-changes backend/routes/

# Проверка сломанных ссылок
/docs-update --validate broken-links

# Генерация справочника API
/docs-update --generate api-reference
```

#### Performance Monitoring
```bash
# Анализ узких мест
/perf-monitor --analyze-bottlenecks

# Оптимизация базы данных
/perf-monitor --database-optimization

# Анализ затрат AI системы
/perf-monitor --ai-cost-analysis
```

### 🎯 Особенности агентов

Каждый агент содержит:
- **Глубокие знания о HR проекте** (архитектура, API, специфика)
- **Контекст системы** (Telegram интеграция, AI мультипровайдеры, ПДн)
- **Готовые процедуры** для типовых задач
- **Шаблоны отчетов** для стандартизированных результатов
- **Примеры кода** специфичные для проекта

### 📚 Документация агентов
Полная документация системы агентов доступна в `.claude/agents/README.md`

### ✅ Готовность к использованию
Все агенты полностью настроены и готовы к использованию. Они знают специфику HR Time Tracking системы и могут сразу приступить к работе без дополнительной настройки.