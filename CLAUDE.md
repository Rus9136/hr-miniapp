# HR Time Tracking Mini App - Claude Code Context

## 🎯 Быстрый старт
```bash
# Проверка состояния production
curl https://madlen.space/api/health
systemctl status nginx
docker ps --filter "name=hr-miniapp"
docker ps --filter "name=hr-postgres"

# Перезапуск сервисов
systemctl restart nginx
docker restart hr-miniapp
docker restart hr-postgres

# Проверка базы данных
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -c "SELECT COUNT(*) FROM employees;"

# Локальная разработка
npm install && npm start
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
- ✅ Отчеты по ФОТ и вне графика

## 🏗️ Production Architecture

### Инфраструктура
```
┌─────────────────────────────────────────────────────────┐
│ madlen.space (Ubuntu Server)                            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐      ┌──────────────────────────────┐ │
│  │ Nginx        │      │ Docker Container             │ │
│  │ (System)     │─────▶│ hr-miniapp                   │ │
│  │ :80, :443    │      │ --network host               │ │
│  └──────────────┘      │ Node.js + Express            │ │
│                        │ Port: 3030                   │ │
│                        └──────────────┬───────────────┘ │
│                                       │                 │
│                        ┌──────────────▼───────────────┐ │
│                        │ Docker Container             │ │
│                        │ hr-postgres                  │ │
│                        │ PostgreSQL 16                │ │
│                        │ Port: 5437 → 5432            │ │
│                        │ Database: hr_tracker         │ │
│                        │ Volume: hr-miniapp_postgres_data │
│                        └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Компоненты

#### 1. Nginx (Системный)
- **Расположение**: `/usr/sbin/nginx`
- **Конфигурация**: `/etc/nginx/sites-enabled/`
  - `madlen-miniapp.conf` - HR приложение
  - `aqniet.conf` - Другие проекты
- **SSL сертификаты**: `/etc/letsencrypt/live/madlen.space/`
- **Порты**: 80 (HTTP), 443 (HTTPS)
- **Управление**:
  ```bash
  systemctl status nginx
  systemctl restart nginx
  systemctl enable nginx  # Автозапуск
  ```

**Важно**: Используется системный nginx, НЕ Docker контейнер!

#### 2. Docker Container (hr-miniapp)
```bash
# Текущая конфигурация
docker run -d \
  --name hr-miniapp \
  --network host \
  -e DB_HOST=localhost \
  -e DB_PORT=5437 \
  -e DB_NAME=hr_tracker \
  -e DB_USER=hr_user \
  -e DB_PASSWORD=hr_secure_password \
  -e NODE_ENV=production \
  -e PORT=3030 \
  -e ANTHROPIC_API_KEY=<ваш_ключ_из_.env> \
  -e SALES_FORECAST_API_KEY=<ваш_ключ_из_.env> \
  -e MCP_API_BASE_URL=http://127.0.0.1:8003/api/v1 \
  -e CRON_TIMESHEET_ENABLED=true \
  -e CRON_TIMESHEET_DAYS_BACK=1 \
  -v /etc/letsencrypt/live/madlen.space:/app/ssl:ro \
  --restart unless-stopped \
  hr-miniapp:latest
```

**Ключевые параметры**:
- `--network host` - контейнер использует сеть хоста (доступ к localhost)
- `ANTHROPIC_API_KEY` - API ключ Claude для AI-рекомендаций (из .env файла)
- `SALES_FORECAST_API_KEY` - API ключ для aqniet.site (данные продаж для отчёта "Выручка к ФОТ")
- `MCP_API_BASE_URL` - URL MCP API для AI агентов (**важно**: использовать `127.0.0.1` вместо `localhost` из-за IPv6)
- `DB_HOST=localhost` - подключение к PostgreSQL Docker контейнеру
- `DB_PORT=5437` - порт проброшенный из hr-postgres контейнера
- `--restart unless-stopped` - автозапуск при перезагрузке сервера

**⚠️ ВАЖНО**: `--env-file` не работает с комментариями в .env файле. Передавайте переменные явно через `-e`.

**Проверка статуса**:
```bash
docker ps --filter "name=hr-miniapp"
docker logs hr-miniapp --tail 50
docker restart hr-miniapp
```

#### 3. PostgreSQL (Docker Container)

**🎯 ВАЖНО: Боевая база данных находится в Docker контейнере `hr-postgres`!**

```bash
# Конфигурация контейнера
docker run -d \
  --name hr-postgres \
  -v hr-miniapp_postgres_data:/var/lib/postgresql/data \
  -e POSTGRES_DB=hr_tracker \
  -e POSTGRES_USER=hr_user \
  -e POSTGRES_PASSWORD=hr_secure_password \
  -p 5437:5432 \
  --restart unless-stopped \
  postgres:16
```

**Параметры**:
- **Версия**: PostgreSQL 16
- **Порт**: `5437` (хост) → `5432` (контейнер)
- **База данных**: `hr_tracker`
- **Пользователь**: `hr_user`
- **Volume**: `hr-miniapp_postgres_data` - **БОЕВЫЕ ДАННЫЕ ЗДЕСЬ!**
- **Данные**:
  - Сотрудники: 5,366 записей
  - Подразделения: 842 записей (с дополнительными колонками hall_area, kitchen_area, seats_count, trade_point)
- **Таймзона**: `Asia/Almaty` (UTC+5)

**Проверка подключения**:
```bash
# Подключение к базе
docker exec -it hr-postgres psql -U hr_user -d hr_tracker

# Проверка с хоста
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -c "\dt"

# Проверка количества сотрудников
docker exec hr-postgres psql -U hr_user -d hr_tracker -c "SELECT COUNT(*) FROM employees;"
```

**Проверка статуса**:
```bash
docker ps --filter "name=hr-postgres"
docker logs hr-postgres --tail 20
docker exec hr-postgres psql -U hr_user -d hr_tracker -c "SELECT version();"
```

### Почему используется host network для hr-miniapp?

Контейнер `hr-miniapp` использует `--network host`, чтобы иметь прямой доступ к `localhost:5437`, где слушает контейнер `hr-postgres`. Это упрощает конфигурацию и позволяет использовать стандартные переменные окружения.

**Альтернативы НЕ используются**:
- ❌ Docker bridge network - требует создания отдельной сети и изменения DB_HOST
- ❌ PostgreSQL на хосте - старая база с неполными данными (4,831 сотрудников вместо 5,366)
- ❌ docker-compose - не используется в production

## 📁 Структура проекта
```
/root/projects/hr-miniapp/
├── backend/
│   ├── database_pg.js          # PostgreSQL клиент
│   ├── server_https.js         # Express сервер
│   ├── routes/
│   │   ├── admin/              # Модульная структура админ API (8 модулей)
│   │   ├── employee.js         # Employee API
│   │   ├── ai-recommendations.js  # AI система
│   │   └── cron.js             # CRON управление
│   ├── services/               # Сервисы (AI, MCP)
│   └── engines/                # AI провайдеры
├── admin/                      # Frontend модули админ-панели (11 модулей)
│   ├── core.js                 # Утилиты, константы, форматтеры
│   ├── state.js                # Централизованное состояние
│   ├── components.js           # SearchableDropdown, OrganizationDropdownManager
│   ├── employees.js            # Секция "Сотрудники"
│   ├── departments.js          # Секция "Подразделения"
│   ├── positions.js            # Секция "Должности"
│   ├── schedules.js            # Секция "Графики работы"
│   ├── reports.js              # Секция "Отчёты" (5 вкладок: Входы/выходы, Опоздания, Вне графика, Перелимит ФОТ, Выручка к ФОТ)
│   ├── news.js                 # Секция "Новости"
│   ├── upload.js               # Секция "Синхронизация"
│   └── index.js                # Главный роутер, switchSection()
├── index.html                  # Главная страница
├── app.js                      # Основная логика приложения
├── ai-recommendations.js       # AI интерфейс
├── admin.js.bak                # Backup старого монолита (5266 строк)
├── migrations/                 # SQL миграции
├── Dockerfile                  # Docker образ
└── CLAUDE.md                   # Этот файл
```

### ⚠️ Важно: Где искать код админ-панели

| Секция UI | Frontend (JS) | Backend (API) |
|-----------|---------------|---------------|
| Сотрудники | `admin/employees.js` | `backend/routes/admin/employees.js` |
| Подразделения | `admin/departments.js` | `backend/routes/admin/departments.js` |
| Графики работы | `admin/schedules.js` | `backend/routes/admin/schedules.js` |
| Отчёты (с вкладками) | `admin/reports.js` | `backend/routes/admin/reports.js`, `time-tracking.js` |

**НЕ редактируйте** `admin.js` в корне - он устарел! Используйте модули из папки `admin/`.

## 🔑 Доступы и учетные данные

### Приложение
- **Админ-панель**: пароль `admin12qw` (вводится в поле ИИН)
- **Тест ИИН**: `123456789012` (Суиндикова С.А.)
- **URL**: https://madlen.space/

### База данных (Docker контейнер hr-postgres)
```bash
DB_HOST=localhost
DB_PORT=5437
DB_NAME=hr_tracker
DB_USER=hr_user
DB_PASSWORD=hr_secure_password
```

**⚠️ ВАЖНО**: Приложение ДОЛЖНО подключаться к порту **5437** (Docker контейнер hr-postgres), а НЕ к порту 5432 (старая база на хосте)!

### SSL сертификаты
```bash
SSL_CERT_PATH=/etc/letsencrypt/live/madlen.space/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/madlen.space/privkey.pem
```

## 📊 Структура БД (PostgreSQL)

### Основные таблицы
```sql
-- Справочники
departments              -- Подразделения (842 записи)
  ├── object_code        -- Код подразделения
  ├── object_name        -- Название
  ├── object_company     -- Организация
  ├── object_bin         -- БИН организации
  ├── id_iiko            -- UUID для интеграции с MCP
  ├── hall_area          -- Площадь зала (м²) [добавлено 2025-11-24]
  ├── kitchen_area       -- Площадь кухни (м²) [добавлено 2025-11-24]
  ├── seats_count        -- Количество посадочных мест [добавлено 2025-11-24]
  └── trade_point        -- Торговая точка/адрес [добавлено 2025-11-24]

positions                -- Должности (14,325 записей)
  ├── staff_position_code
  └── staff_position_name

employees                -- Сотрудники (3,997 записей)
  ├── id                 -- Internal ID
  ├── table_number       -- Табельный номер (UNIQUE)
  ├── full_name          -- ФИО
  ├── iin                -- ИИН (12 цифр)
  ├── object_code        -- FK → departments
  ├── staff_position_code -- FK → positions
  └── payroll            -- ФОТ

-- Учет времени
time_events              -- События входа/выхода (сырые данные)
  ├── employee_number    -- FK → employees.table_number
  ├── event_datetime     -- Время события (UTC)
  ├── event_type         -- '1' вход, '2' выход
  └── object_bin         -- БИН организации

time_records             -- Обработанные записи времени
  ├── employee_number
  ├── date
  ├── check_in           -- Время прихода
  ├── check_out          -- Время ухода
  ├── hours_worked       -- Отработанные часы
  └── status             -- on_time, late, absent, etc.

-- Графики работы
work_schedules_1c        -- Графики из 1С (115 графиков)
  ├── schedule_code      -- Уникальный код графика
  ├── schedule_name      -- Название
  ├── work_date          -- Рабочая дата
  ├── time_type          -- 'Р' работа, 'В' выходной
  ├── start_time         -- Начало смены
  ├── end_time           -- Конец смены
  └── expected_hours     -- Ожидаемые часы

employee_schedule_assignments  -- Назначения графиков (422 назначения)
  ├── employee_number    -- FK → employees.table_number
  ├── schedule_code      -- FK → work_schedules_1c.schedule_code
  ├── start_date         -- Дата начала назначения
  └── end_date           -- Дата окончания (NULL = бессрочно)

-- AI система
ai_recommendations       -- История AI анализов
  ├── id
  ├── department_id      -- UUID подразделения
  ├── date_start / date_end
  ├── provider           -- 'claude', 'openai', 'gemini'
  ├── mcp_response       -- JSONB данные из MCP API
  ├── agent_results      -- JSONB результаты 6 агентов
  └── created_at

ai_prompts               -- Шаблоны промптов для агентов
ai_prompt_logs           -- Логи запросов к AI провайдерам
```

### Важные индексы
```sql
CREATE INDEX idx_time_events_employee_date ON time_events(employee_number, event_datetime);
CREATE INDEX idx_employees_number ON employees(table_number);
CREATE INDEX idx_time_records_employee_date ON time_records(employee_number, date);
```

### Timezone
Все даты/время в базе хранятся в UTC (`timestamp without time zone`), конвертация в `Asia/Almaty` (UTC+5) происходит при запросах.

### Миграции
Файлы миграций расположены в папке `/root/projects/hr-miniapp/migrations/`. Применение миграций:

```bash
# Применить миграцию вручную
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -f migrations/013_add_areas_to_departments.sql

# Проверить структуру таблицы после миграции
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -c "\d departments"
```

**Последние применённые миграции**:
- ✅ `013_add_areas_to_departments.sql` - добавляет hall_area, kitchen_area, seats_count (2025-11-24)
- ✅ `014_add_trade_point_to_departments.sql` - добавляет trade_point (2025-11-24)

## 🌐 API Endpoints

### Основное приложение
```
POST   /api/login                                    # Авторизация по ИИН
GET    /api/health                                   # Проверка состояния
GET    /api/employee/by-number/:tableNumber/timesheet/:year/:month
GET    /api/employee/by-number/:tableNumber/time-events
```

### Админ-панель
```
GET    /api/admin/employees                          # Список сотрудников (пагинация)
GET    /api/admin/departments                        # Список подразделений
GET    /api/admin/positions                          # Список должностей
GET    /api/admin/organizations                      # Список организаций
GET    /api/admin/schedules/1c/list                  # Графики из 1С
POST   /api/admin/schedules/import-1c                # Импорт графиков (500MB лимит)
POST   /api/admin/sync/employees                     # Синхронизация с внешним API
POST   /api/admin/load/timesheet                     # Загрузка табельных данных
GET    /api/admin/time-events                        # События входа/выхода
POST   /api/admin/recalculate-time-records           # Пересчет рабочего времени
```

### Отчеты
```
GET    /api/admin/reports/off-schedule-attendance    # Сотрудники вне графика
GET    /api/admin/reports/payroll                    # Отчет ФОТ
GET    /api/admin/payroll/attendance                 # Детализация ФОТ по сменам
```

### AI-рекомендации
```
POST   /api/admin/ai-recommendations/analyze         # Запуск анализа
GET    /api/admin/ai-recommendations/history         # История анализов
GET    /api/admin/ai-recommendations/:id             # Детальный анализ
GET    /api/admin/ai-recommendations/prompts         # Промпты агентов
PUT    /api/admin/ai-recommendations/prompts         # Обновление промптов
POST   /api/admin/ai-recommendations/rerun-agent     # Перезапуск агента
GET    /api/admin/ai-recommendations/providers       # Доступные AI провайдеры
```

## 🤖 AI Система

### Мультипровайдерная архитектура
- **Claude (Anthropic)** - основной провайдер, 5 изолированных API ключей
- **OpenAI GPT-4o** - альтернативный провайдер
- **Google Gemini** - запланирован

### 6 специализированных агентов
1. **SalesAnalysisAgent** 📈 - анализ продаж и прогнозов
2. **PayrollAnalysisAgent** 💰 - анализ ФОТ и эффективности
3. **StaffingAgent** 👥 - оптимизация распределения персонала
4. **ReputationAgent** ⭐ - анализ отзывов клиентов
5. **OptimizationAgent** 🎯 - конкретные рекомендации
6. **NarrativeAgent** 📊 - итоговый бизнес-отчет

### Внешние интеграции
- **MCP API** (https://mcp.madlen.space/api/v1) - данные подразделений
- **Reviews API** - отзывы клиентов
- **Anthropic/OpenAI API** - AI модели

### Переменные окружения (опционально)
```bash
# Claude
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_API_KEY_PAYROLL=sk-ant-api03-...
ANTHROPIC_API_KEY_STAFFING=sk-ant-api03-...
ANTHROPIC_API_KEY_NARRATIVE=sk-ant-api03-...
ANTHROPIC_API_KEY_REPUTATION=sk-ant-api03-...

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o

# MCP
MCP_API_BASE_URL=https://mcp.madlen.space/api/v1
```

## 🔧 Управление сервисами

### Проверка состояния
```bash
# Nginx
systemctl status nginx
nginx -t  # Проверка конфигурации

# Docker контейнер hr-miniapp
docker ps --filter "name=hr-miniapp"
docker logs hr-miniapp --tail 50 --follow

# Docker контейнер PostgreSQL
docker ps --filter "name=hr-postgres"
docker logs hr-postgres --tail 50
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -c "SELECT COUNT(*) FROM employees;"
```

### Перезапуск сервисов
```bash
# Nginx
systemctl restart nginx

# HR приложение
docker restart hr-miniapp

# PostgreSQL Docker контейнер
docker restart hr-postgres
```

### Обновление приложения
```bash
# 1. Пересборка Docker образа
cd /root/projects/hr-miniapp
docker build -t hr-miniapp:latest .

# 2. Остановка старого контейнера
docker stop hr-miniapp
docker rm hr-miniapp

# 3. Запуск нового контейнера (получите ключи из .env файла)
docker run -d \
  --name hr-miniapp \
  --network host \
  -e DB_HOST=localhost \
  -e DB_PORT=5437 \
  -e DB_NAME=hr_tracker \
  -e DB_USER=hr_user \
  -e DB_PASSWORD=hr_secure_password \
  -e NODE_ENV=production \
  -e PORT=3030 \
  -e ANTHROPIC_API_KEY=<ваш_ключ_из_.env> \
  -e SALES_FORECAST_API_KEY=<ваш_ключ_из_.env> \
  -e MCP_API_BASE_URL=http://127.0.0.1:8003/api/v1 \
  -e CRON_TIMESHEET_ENABLED=true \
  -e CRON_TIMESHEET_DAYS_BACK=1 \
  -v /etc/letsencrypt/live/madlen.space:/app/ssl:ro \
  --restart unless-stopped \
  hr-miniapp:latest

# 4. Проверка
docker logs hr-miniapp --tail 20
curl http://localhost:3030/api/health
```

## 🚨 Troubleshooting

### Сайт недоступен
```bash
# 1. Проверить nginx
systemctl status nginx
netstat -tlnp | grep -E ':80|:443'

# 2. Проверить контейнер
docker ps --filter "name=hr-miniapp"
docker logs hr-miniapp --tail 50

# 3. Проверить API
curl http://localhost:3030/api/health
```

### Ошибка "Internal Server Error" в API
```bash
# Проверить логи контейнера
docker logs hr-miniapp --tail 100 | grep -i error

# Проверить подключение к БД
docker exec hr-miniapp node -e "const db = require('./backend/database_pg'); db.queryRows('SELECT 1').then(console.log).catch(console.error)"
```

### Ошибка 500 при сохранении подразделения
Если при сохранении подразделения в админ-панели возникает ошибка 500 с текстом "column 'hall_area' does not exist":

```bash
# 1. Проверить, что миграции применены
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -c "\d departments" | grep hall_area

# 2. Если колонок нет - применить миграции
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -f /root/projects/hr-miniapp/migrations/013_add_areas_to_departments.sql
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -f /root/projects/hr-miniapp/migrations/014_add_trade_point_to_departments.sql

# 3. Проверить, что приложение подключено к правильному порту
docker inspect hr-miniapp --format='{{range .Config.Env}}{{println .}}{{end}}' | grep DB_PORT
# Должно быть: DB_PORT=5437
```

### База данных недоступна
```bash
# Проверить PostgreSQL контейнер
docker ps --filter "name=hr-postgres"
docker logs hr-postgres --tail 50

# Проверить подключение к ПРАВИЛЬНОМУ порту (5437)
PGPASSWORD=hr_secure_password psql -U hr_user -h localhost -p 5437 -d hr_tracker -c "SELECT version();"

# Если контейнер не запущен - запустить
docker start hr-postgres

# Проверить данные в volume
docker volume inspect hr-miniapp_postgres_data
```

**⚠️ ЧАСТАЯ ОШИБКА**: Убедитесь, что приложение подключается к порту **5437**, а не 5432!
```bash
# Проверить DB_PORT в контейнере
docker inspect hr-miniapp --format='{{range .Config.Env}}{{println .}}{{end}}' | grep DB_PORT

# Должно быть: DB_PORT=5437
# Если DB_PORT=5432 - пересоздать контейнер с правильными параметрами (см. раздел "Обновление приложения")
```

### Контейнер постоянно перезапускается
```bash
# Смотреть логи в реальном времени
docker logs hr-miniapp --follow

# Проверить переменные окружения
docker inspect hr-miniapp --format='{{range .Config.Env}}{{println .}}{{end}}'

# Проверить сеть
docker exec hr-miniapp ping -c 3 localhost
```

## ⚠️ Важные замечания

### Безопасность
1. **Никогда не коммитить** учетные данные БД в Git
2. **SSL сертификаты** обновляются автоматически через certbot
3. **ИИН сотрудников** - персональные данные, защищены в БД

### Производительность
1. **Индексы БД** критичны для производительности - не удалять
2. **AI анализ** занимает 3-4 минуты - нормально
3. **Синхронизация с 1С** может занять до 2 минут для больших файлов

### Backup
```bash
# Backup базы данных из Docker контейнера
docker exec hr-postgres pg_dump -U hr_user hr_tracker > backup_$(date +%Y%m%d).sql

# Альтернативный способ (с хоста)
PGPASSWORD=hr_secure_password pg_dump -U hr_user -h localhost -p 5437 hr_tracker > backup_$(date +%Y%m%d).sql

# Восстановление в Docker контейнер
cat backup_20251124.sql | docker exec -i hr-postgres psql -U hr_user hr_tracker

# Backup Docker volume (рекомендуется!)
docker run --rm -v hr-miniapp_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_data_backup_$(date +%Y%m%d).tar.gz /data
```

### Мониторинг
- **Nginx access logs**: `/var/log/nginx/access.log`
- **Nginx error logs**: `/var/log/nginx/error.log`
- **HR приложение logs**: `docker logs hr-miniapp`
- **PostgreSQL logs**: `docker logs hr-postgres`

## 📚 Дополнительная документация

- **API документация**: `docs/API.md`
- **1С интеграция**: `docs/1C_INTEGRATION_README.md`
- **AI система**: `MULTIPROVIDER_AI_SYSTEM_DOCS.md`
- **Агенты Claude Code**: `.claude/agents/README.md`

---

## 📋 История изменений

### 2025-11-26
- ✅ **Объединение отчётов**: 6 разделов → 1 раздел "Отчёты" с 5 вкладками
- ✅ Удалён `admin/time-tracking.js` (код перенесён в `reports.js`)
- ✅ Удалён неиспользуемый "Отчет по ФОТ"

### 2025-11-25
- ✅ **Рефакторинг frontend admin.js**: Монолит (5266 строк) → 11 модулей в `admin/`
- ✅ **Рефакторинг backend admin.js**: Монолит (~4000 строк) → 8 модулей в `backend/routes/admin/`
- 📦 Backup: `admin.js.bak` (frontend), `backend/routes/admin.js.backup` (backend)

### 2025-11-24
- ✅ **Исправлена критическая ошибка**: Приложение теперь подключается к правильной БД (порт 5437)
- ✅ **Применены миграции**: Добавлены колонки hall_area, kitchen_area, seats_count, trade_point в таблицу departments
- ✅ **Решена проблема 500**: Сохранение подразделений в админ-панели теперь работает корректно

---

**Последнее обновление**: 2025-11-26
**Версия production**: madlen.space
**Статус**: ✅ Работает стабильно
