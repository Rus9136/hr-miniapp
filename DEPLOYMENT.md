# 🚀 HR Mini App - Deployment Guide

## ✅ Готово к деплою!

Приложение полностью готово к развертыванию на `https://madlen.space/`

**Последнее обновление**: 2025-06-08

## 📦 Что реализовано

### Backend (Node.js + Express + PostgreSQL)
- ✅ **API авторизации**: обычная + Telegram
- ✅ **PostgreSQL база данных** с полной схемой
- ✅ **Telegram Web App интеграция** с валидацией
- ✅ **HTTPS сервер** с SSL сертификатами
- ✅ **Синхронизация** с внешним API
- ✅ **Система новостей** с пагинацией
- ✅ **Поддержка ночных смен** (22:00-06:00)
- ✅ **Графики работы из 1С** (115 различных графиков)

### Frontend (Vanilla JS + Telegram SDK)
- ✅ **Автоопределение платформы** (Telegram/браузер)
- ✅ **Адаптивная мобильная верстка**
- ✅ **Telegram UI компоненты** (BackButton, MainButton)
- ✅ **Haptic feedback** и нативная навигация
- ✅ **Fallback для веб-браузеров**
- ✅ **Темная тема** (#232e3c - как в Telegram)
- ✅ **Адаптивный календарь** для мобильных устройств

### Telegram Mini App функции
- ✅ **Автоматический вход** при наличии связки
- ✅ **Привязка аккаунта** при первом входе  
- ✅ **Валидация initData** через HMAC-SHA256
- ✅ **JWT токены** для сессий
- ✅ **Dev режим** для тестирования

## 🚀 Команды для деплоя

### Быстрый старт (Development)
```bash
# 1. Клонировать и перейти в директорию
cd /root/projects/hr-miniapp

# 2. Установить зависимости  
npm install

# 3. Настроить PostgreSQL
sudo -u postgres createuser hr_user
sudo -u postgres createdb hr_tracker
sudo -u postgres psql -c "ALTER USER hr_user PASSWORD 'hr_secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hr_tracker TO hr_user;"
sudo -u postgres psql -d hr_tracker -c "GRANT ALL ON SCHEMA public TO hr_user;"

# 4. Запустить в dev режиме
npm run server

# 5. Открыть frontend
python3 -m http.server 5555 &
```

### Production деплой (HTTPS)
```bash
# 1. Установить production переменные
cp .env.production .env

# 2. Запустить с HTTPS
npm run server:prod
```

### Docker деплой
```bash
# Запуск всего стека
docker-compose up -d

# Проверка статуса
docker-compose ps
docker-compose logs hr-app

# Перезапуск при обновлении кода
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Альтернативный вариант с использованием скрипта
./rebuild_docker.sh
```

### ⚠️ Важно: Конфликт портов с системным nginx
Если при запуске nginx контейнера возникает ошибка "bind: address already in use", необходимо:
```bash
# Остановить и отключить системный nginx
sudo systemctl stop nginx
sudo systemctl disable nginx

# Затем запустить docker контейнер
docker start hr-nginx
```

## 🔗 URL endpoints

### Production URLs
- **Web App**: `https://madlen.space/`
- **Telegram Mini App**: `https://madlen.space/` (через Telegram WebApp)
- **API**: `https://madlen.space/api/`
- **Health Check**: `https://madlen.space/api/health`
- **Admin Panel**: `https://madlen.space/` (вход через табельный номер `admin12qw`)

### Development URLs  
- **Frontend**: `http://localhost:5555/`
- **API**: `http://localhost:3030/api/`
- **Tests**: `http://localhost:5555/test_telegram.html`

## 📱 Telegram Bot настройка

### Bot Configuration
- **Token**: Хранится в `.env` файле (BOT_TOKEN)
- **WebApp URL**: `https://madlen.space/`
- **Domain**: `madlen.space` (whitelisted)

### Bot Commands (для настройки через @BotFather)
```
webapp - Открыть HR приложение
timesheet - Проверить посещаемость  
stats - Статистика за месяц
help - Помощь
```

## 🧪 Тестирование

### API тесты
```bash
# Health check
curl https://madlen.space/api/health

# Обычная авторизация  
curl -X POST https://madlen.space/api/login \
  -H "Content-Type: application/json" \
  -d '{"tableNumber":"АП00-00358"}'

# Telegram авторизация (dev)
curl -X POST https://madlen.space/api/telegram/auth \
  -H "Content-Type: application/json" \
  -d '{"initData":"dev_mode"}'
```

### Тестовые данные
- **Сотрудник**: `АП00-00358` (Суиндикова Сайраш Агабековна)
- **Сотрудник с ночной сменой**: `АП00-00467` (Шегирбаева Гульнур Бегалиевна)
- **Админ**: `admin12qw`
- **База данных**: 2901 сотрудников, 536 подразделений, 6070 должностей

## 🔒 Безопасность

### SSL/TLS
- ✅ **Let's Encrypt сертификаты** автоматически подключены
- ✅ **HTTPS редирект** с HTTP
- ✅ **HSTS headers** настроены
- ✅ **Modern TLS** конфигурация

### Telegram Security
- ✅ **HMAC-SHA256 валидация** initData
- ✅ **JWT токены** с истечением (30 дней)
- ✅ **CORS whitelist** для Telegram домена
- ✅ **Rate limiting** на API эндпоинты

### Database Security  
- ✅ **Prepared statements** против SQL injection
- ✅ **Роли пользователей** PostgreSQL
- ✅ **Encrypted passwords** в environment

## 📊 Мониторинг

### Health Checks
- **Backend**: `/api/health`
- **Database**: автоматическая проверка подключения
- **SSL**: автоматическое обновление сертификатов

### Логи
- **Application**: `/var/log/hr-miniapp/app.log`
- **Nginx**: `/var/log/nginx/access.log`
- **PostgreSQL**: стандартные логи системы

## 🔧 Troubleshooting

### Проблема: Telegram не может открыть Mini App
**Решение**: Проверить что:
1. URL точно `https://madlen.space/`
2. SSL сертификат валиден
3. CORS настроен для `web.telegram.org`

### Проблема: "Invalid Telegram data"
**Решение**: 
1. В dev режиме использовать `initData: "dev_mode"`
2. В production проверить BOT_TOKEN в .env

### Проблема: База данных недоступна
**Решение**:
```bash
# Проверить статус PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Проверить подключение
psql -h localhost -U hr_user -d hr_tracker
```

## 📞 Контакты

При проблемах с деплоем обратиться к:
- **Telegram**: @support_bot
- **Email**: admin@madlen.space
- **Logs**: `docker-compose logs hr-app`

## 🐳 Docker архитектура

### Контейнеры
1. **hr-postgres** - PostgreSQL 16 база данных
   - Порт: 5433 (внешний) → 5432 (внутренний)
   - Timezone: Asia/Almaty
   - Healthcheck каждые 10 секунд

2. **hr-miniapp** - Node.js приложение
   - Порт: 3030
   - Автоматический рестарт
   - Зависит от PostgreSQL

3. **hr-nginx** - Nginx reverse proxy
   - Порты: 80, 443
   - SSL сертификаты Let's Encrypt
   - Rate limiting для API

### Volumes
- `postgres_data` - данные PostgreSQL
- `logs` - логи приложения
- SSL сертификаты монтируются из `/root/projects/infra/infra/certbot/conf`

---

## ✨ Финальный статус

**🎉 Проект ПОЛНОСТЬЮ ГОТОВ к деплою!**

Все компоненты протестированы и работают:
- ✅ Backend API (Node.js + PostgreSQL)
- ✅ Frontend (Telegram Mini App + Web)  
- ✅ Авторизация (обычная + Telegram)
- ✅ HTTPS конфигурация
- ✅ Docker контейнеры
- ✅ Мониторинг и безопасность
- ✅ Темная тема и мобильная адаптация
- ✅ Система новостей
- ✅ Поддержка ночных смен