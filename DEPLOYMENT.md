# 🚀 HR Mini App - Deployment Guide

## ✅ Готово к деплою!

Приложение полностью готово к развертыванию на `https://madlen.space/HR/`

## 📦 Что реализовано

### Backend (Node.js + Express + PostgreSQL)
- ✅ **API авторизации**: обычная + Telegram
- ✅ **PostgreSQL база данных** с полной схемой
- ✅ **Telegram Web App интеграция** с валидацией
- ✅ **HTTPS сервер** с SSL сертификатами
- ✅ **Синхронизация** с внешним API

### Frontend (Vanilla JS + Telegram SDK)
- ✅ **Автоопределение платформы** (Telegram/браузер)
- ✅ **Адаптивная мобильная верстка**
- ✅ **Telegram UI компоненты** (BackButton, MainButton)
- ✅ **Haptic feedback** и нативная навигация
- ✅ **Fallback для веб-браузеров**

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
```

## 🔗 URL endpoints

### Production URLs
- **Telegram Mini App**: `https://madlen.space/`
- **API**: `https://madlen.space/api/`
- **Health Check**: `https://madlen.space/api/health`

### Development URLs  
- **Frontend**: `http://localhost:5555/`
- **API**: `http://localhost:3030/api/`
- **Tests**: `http://localhost:5555/test_telegram.html`

## 📱 Telegram Bot настройка

### Bot Configuration
- **Token**: `-7765333400:AAG0rFD5IvUwlc83WiXZ5sjqo-YJF-xgmAs`
- **WebApp URL**: `https://madlen.space/HR/`
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
curl https://madlen.space/HR/api/health

# Обычная авторизация  
curl -X POST https://madlen.space/HR/api/login \
  -H "Content-Type: application/json" \
  -d '{"tableNumber":"АП00-00358"}'

# Telegram авторизация (dev)
curl -X POST https://madlen.space/HR/api/telegram/auth \
  -H "Content-Type: application/json" \
  -d '{"initData":"dev_mode"}'
```

### Тестовые данные
- **Сотрудник**: `АП00-00358` (Суиндикова Сайраш Агабековна)
- **Админ**: `admin12qw`
- **База данных**: 2916 сотрудников, 535 подразделений, 6606 должностей

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
1. URL точно `https://madlen.space/HR/`
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