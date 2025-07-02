# 🚀 HR Mini App + Sales Forecast - Multi-Domain Deployment Guide

## ✅ Готово к деплою!

Система полностью готова к развертыванию на двух доменах:
- **HR Time Tracking**: `https://madlen.space/`
- **Sales Forecast + 1C Exchange**: `https://aqniet.site/`

**Последнее обновление**: 2025-06-24

## 🔧 NGINX MULTI-DOMAIN НАСТРОЙКА (Полная инструкция)

### 📋 Обзор архитектуры
```
NGINX (host network mode) - порты 80/443
├── madlen.space → 127.0.0.1:3030 (HR Time Tracking)
└── aqniet.site → 
    ├── /api/exchange/ → 127.0.0.1:8000 (1C Exchange Service)
    ├── /docs → 127.0.0.1:8000 (1C Exchange Docs)
    ├── /openapi.json → 127.0.0.1:8000 (OpenAPI Schema)
    ├── /api/ → 127.0.0.1:8002 (Sales Forecast API)
    └── / → 127.0.0.1:8002 (Sales Forecast Admin)
```

### 🚀 ПОШАГОВАЯ НАСТРОЙКА NGINX

#### 1. Подготовка SSL сертификатов
```bash
# Остановить существующий nginx
sudo systemctl stop nginx
docker stop hr-nginx 2>/dev/null || true
docker rm hr-nginx 2>/dev/null || true

# Получить SSL сертификаты для обоих доменов
docker run --rm --name certbot \
  -v "/root/projects/infra/infra/certbot/conf:/etc/letsencrypt" \
  -v "/root/projects/infra/infra/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  --email admin@madlen.space --agree-tos --no-eff-email \
  -d madlen.space -d www.madlen.space

docker run --rm --name certbot \
  -v "/root/projects/infra/infra/certbot/conf:/etc/letsencrypt" \
  -v "/root/projects/infra/infra/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  --email admin@aqniet.site --agree-tos --no-eff-email \
  -d aqniet.site -d www.aqniet.site
```

#### 2. Настройка брандмауэра
```bash
# Открыть необходимые порты
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 22/tcp    # SSH
ufw allow 8000/tcp  # 1C Exchange (опционально)
ufw status
```

#### 3. Запуск сервисов backend
```bash
# 1C Exchange Service (порт 8000)
cd /root/projects/1c-exchange-service
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > 1c-exchange.log 2>&1 &

# Sales Forecast (порт 8002)
cd /root/projects/SalesForecast/sales_forecast
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8002 > sales_forecast.log 2>&1 &

# PostgreSQL для Sales Forecast
docker run -d --name sales-forecast-db \
  -e POSTGRES_DB=sales_forecast \
  -e POSTGRES_USER=sales_user \
  -e POSTGRES_PASSWORD=sales_password \
  -p 5435:5432 \
  postgres:15

# Проверить что все сервисы запущены
ps aux | grep -E "(8000|8002)" | grep -v grep
netstat -tlnp | grep -E ":(8000|8002)"
```

#### 4. Запуск HR системы
```bash
cd /root/projects/hr-miniapp
docker-compose up -d hr-postgres hr-miniapp
# НЕ запускаем nginx через compose - он будет в host mode отдельно
```

#### 5. Запуск NGINX в host mode
```bash
# Убедиться что конфигурация правильная
cat /root/projects/hr-miniapp/nginx.conf | grep -A5 -B5 "aqniet.site"

# Запустить nginx в host network mode
docker run -d --name hr-nginx --network host \
  -v /root/projects/hr-miniapp/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /root/projects/infra/infra/certbot/conf:/etc/letsencrypt:ro \
  -v /root/projects/infra/infra/certbot/www:/var/www/certbot:ro \
  nginx:alpine

# Проверить статус
docker ps | grep hr-nginx
docker logs hr-nginx
```

#### 6. Тестирование
```bash
# Проверить оба сайта
curl -I https://madlen.space
curl -I https://aqniet.site

# Проверить API endpoints
curl https://madlen.space/api/health
curl https://aqniet.site/api/branches/
curl https://aqniet.site/docs

# Проверить перенаправления HTTP → HTTPS
curl -I http://madlen.space
curl -I http://aqniet.site
```

### ⚠️ УСТРАНЕНИЕ ПРОБЛЕМ

#### Проблема: 502 Bad Gateway ⭐ САМАЯ ЧАСТАЯ (aqniet.site)
**Симптомы**: aqniet.site показывает "502 Bad Gateway", madlen.space работает нормально

**Причина**: Nginx контейнер не подключен к сети sales_forecast_default

**Быстрое решение**:
```bash
# 1. Проверить что Sales Forecast контейнеры запущены
docker ps | grep sales-forecast

# 2. Подключить nginx к сети Sales Forecast (ГЛАВНОЕ!)
docker network connect sales_forecast_default hr-nginx

# 3. Проверить подключение
docker exec hr-nginx wget -q --spider http://sales-forecast-app:8000/ && echo "✅ СВЯЗЬ OK"

# 4. Перезапустить nginx
docker-compose restart nginx
```

**Постоянное решение** - обновить docker-compose.yml:
```yaml
  nginx:
    image: nginx:alpine
    container_name: hr-nginx
    networks:
      - hr-network
      - sales_forecast_default  # Добавить эту строку!
    # ... остальная конфигурация ...

networks:
  hr-network:
    driver: bridge
  sales_forecast_default:  # Добавить эту секцию!
    external: true
```

#### Проблема: Sales Forecast сервисы не запущены
```bash
# Диагностика
curl -k -I https://aqniet.site
docker ps | grep sales-forecast

# Решение - запуск через Docker Compose
cd /root/projects/SalesForecast/sales_forecast
docker-compose -f docker-compose.prod.yml up -d

# Альтернативно - прямой запуск
pkill -f "uvicorn.*8000"
pkill -f "uvicorn.*8002"
cd /root/projects/1c-exchange-service && nohup ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 > 1c-exchange.log 2>&1 &
cd /root/projects/SalesForecast/sales_forecast && nohup ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8002 > sales_forecast.log 2>&1 &
```

#### Проблема: Конфликт портов
```bash
# Найти процессы занимающие порты
lsof -i :80 -i :443
docker ps | grep nginx

# Остановить конфликтующие процессы
sudo systemctl stop nginx
docker stop hr-nginx
docker-compose stop nginx

# Очистить docker контейнеры
docker ps -a | grep nginx
docker rm $(docker ps -a | grep nginx | awk '{print $1}')
```

#### Проблема: SSL сертификат недоступен
```bash
# Проверить сертификаты
ls -la /root/projects/infra/infra/certbot/conf/live/
openssl x509 -in /root/projects/infra/infra/certbot/conf/live/madlen.space/fullchain.pem -text -noout
openssl x509 -in /root/projects/infra/infra/certbot/conf/live/aqniet.site/fullchain.pem -text -noout

# Обновить сертификаты
docker run --rm -v "/root/projects/infra/infra/certbot/conf:/etc/letsencrypt" -v "/root/projects/infra/infra/certbot/www:/var/www/certbot" certbot/certbot renew
docker exec hr-nginx nginx -s reload
```

### 🔄 ОБСЛУЖИВАНИЕ

#### Перезапуск nginx
```bash
docker exec hr-nginx nginx -s reload
# или полный перезапуск
docker restart hr-nginx
```

#### Обновление конфигурации
```bash
# После изменения /root/projects/hr-miniapp/nginx.conf
docker exec hr-nginx nginx -t
docker exec hr-nginx nginx -s reload
```

#### Логи
```bash
# Nginx
docker logs hr-nginx

# Backend сервисы
tail -f /root/projects/1c-exchange-service/1c-exchange.log
tail -f /root/projects/SalesForecast/sales_forecast/sales_forecast.log

# HR приложение
docker logs hr-miniapp
```

#### Мониторинг
```bash
# Проверка всех сервисов
docker ps | grep -E "(hr-|sales-)"
ps aux | grep -E "(8000|8002)" | grep -v grep
curl -s https://madlen.space/api/health
curl -s https://aqniet.site/api/branches/
```

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

### 🌐 MADLEN.SPACE (HR Time Tracking System)
- **Web App**: `https://madlen.space/`
- **Telegram Mini App**: `https://madlen.space/` (через Telegram WebApp)
- **API**: `https://madlen.space/api/`
- **Health Check**: `https://madlen.space/api/health`
- **Admin Panel**: `https://madlen.space/` (вход через ИИН `admin12qw`)

### 🌐 AQNIET.SITE (Sales Forecast + 1C Exchange)
- **Sales Forecast Admin**: `https://aqniet.site/` (Branch Management)
- **Sales Forecast API**: `https://aqniet.site/api/branches/`
- **1C Exchange Service**: `https://aqniet.site/api/exchange/`
- **1C Exchange Docs**: `https://aqniet.site/docs` (Swagger UI)
- **OpenAPI Schema**: `https://aqniet.site/openapi.json`

### Development URLs  
- **Frontend**: `http://localhost:5555/`
- **HR API**: `http://localhost:3030/api/`
- **1C Exchange**: `http://localhost:8000/`
- **Sales Forecast**: `http://localhost:8002/`
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

## 🏗️ MULTI-DOMAIN АРХИТЕКТУРА (обновлено 2025-06-23)

### 📊 Общая схема развертывания

```
NGINX (hr-nginx контейнер) - host network mode на портах 80/443
├── madlen.space → 127.0.0.1:3030 (HR Time Tracking System)
└── aqniet.site → 
    ├── /api/exchange/ → 127.0.0.1:8000 (1C Exchange Service)
    ├── /docs → 127.0.0.1:8000 (1C Exchange Documentation)  
    ├── /openapi.json → 127.0.0.1:8000 (OpenAPI Schema)
    ├── /api/ → 127.0.0.1:8002 (Sales Forecast API)
    └── / → 127.0.0.1:8002 (Sales Forecast Admin Panel)
```

### 🐳 Запущенные сервисы

#### Контейнеры Docker
- **hr-nginx** - Nginx reverse proxy (порты 80/443)
- **hr-miniapp** - HR приложение (порт 3030)
- **hr-postgres** - PostgreSQL для HR системы (порт 5433)
- **sales-forecast-db** - PostgreSQL для Sales Forecast (порт 5435)

#### Сервисы на хосте
- **1C Exchange Service** - FastAPI на порту 8000
- **Sales Forecast** - FastAPI на порту 8002

### 🔧 Конфигурация NGINX

**Файл**: `/root/projects/hr-miniapp/nginx.conf`

#### Полная конфигурация nginx.conf
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Increase max body size for large JSON uploads from 1C
    client_max_body_size 100M;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;

    # Upstream for HR app
    upstream hr_backend {
        server 127.0.0.1:3030;
    }

    # =================== MADLEN.SPACE ===================
    
    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name madlen.space www.madlen.space;
        
        # Let's Encrypt challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        # Redirect to HTTPS
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server for madlen.space
    server {
        listen 443 ssl http2;
        server_name madlen.space www.madlen.space;

        # SSL configuration
        ssl_certificate /etc/letsencrypt/live/madlen.space/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/madlen.space/privkey.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;

        # Modern SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # HSTS
        add_header Strict-Transport-Security "max-age=63072000" always;

        # Main location for HR app (root path)
        location / {
            limit_req zone=general burst=50 nodelay;
            
            proxy_pass http://hr_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # CORS headers for Telegram and self
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        }

        # API endpoints with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://hr_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # CORS for API
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
            
            # Handle preflight requests
            if ($request_method = 'OPTIONS') {
                add_header Access-Control-Allow-Origin $http_origin always;
                add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
                add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
                add_header Access-Control-Max-Age 86400;
                add_header Content-Length 0;
                add_header Content-Type text/plain;
                return 204;
            }
        }

        # Static files caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, no-transform";
            proxy_pass http://hr_backend;
        }

        # Error pages
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;
    }

    # =================== AQNIET.SITE ===================

    # HTTP to HTTPS redirect for aqniet.site
    server {
        listen 80;
        server_name aqniet.site www.aqniet.site;
        
        # Let's Encrypt challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        # Redirect to HTTPS
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server for aqniet.site
    server {
        listen 443 ssl http2;
        server_name aqniet.site www.aqniet.site;

        # SSL configuration
        ssl_certificate /etc/letsencrypt/live/aqniet.site/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/aqniet.site/privkey.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;

        # Modern SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # HSTS
        add_header Strict-Transport-Security "max-age=63072000" always;

        # 1C Exchange Service API (приоритет выше)
        location /api/exchange/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # CORS for 1C API
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        }

        # 1C Exchange Service docs
        location /docs {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # 1C Exchange Service openapi.json
        location /openapi.json {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Sales Forecast API
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://sales-forecast-app:8000;  # ✅ ИСПРАВЛЕНО: имя контейнера
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # CORS for Sales Forecast API
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        }

        # Sales Forecast Admin Panel (основная страница)
        location / {
            limit_req zone=general burst=50 nodelay;
            
            proxy_pass http://sales-forecast-app:8000;  # ✅ ИСПРАВЛЕНО: имя контейнера
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # CORS headers
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        }

        # Error pages
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;
    }
}
```

#### Основные блоки:
1. **madlen.space** - HR система
   - HTTP → HTTPS redirect
   - SSL сертификат: `/etc/letsencrypt/live/madlen.space/`
   - Upstream: `127.0.0.1:3030`

2. **aqniet.site** - Sales Forecast + 1C Exchange
   - HTTP → HTTPS redirect  
   - SSL сертификат: `/etc/letsencrypt/live/aqniet.site/`
   - Маршрутизация по location:
     - `/api/exchange/` → порт 8000
     - `/docs` → порт 8000
     - `/openapi.json` → порт 8000
     - `/api/` → порт 8002
     - `/` → порт 8002

### 🔐 SSL сертификаты

#### Автоматически получены через Let's Encrypt:
- **madlen.space**: действует до 26 июня 2025
- **aqniet.site**: действует до 26 июня 2025

#### Хранение:
- Сертификаты: `/root/projects/infra/infra/certbot/conf/live/`
- Webroot: `/root/projects/infra/infra/certbot/www/`

### 🔥 Брандмауэр (UFW)

```bash
# Открытые порты
80/tcp     ALLOW Anywhere    # HTTP
443/tcp    ALLOW Anywhere    # HTTPS  
22/tcp     ALLOW Anywhere    # SSH
8000/tcp   ALLOW Anywhere    # 1C Exchange (опционально)
```

### 🚀 Команды для управления

#### Перезапуск NGINX
```bash
docker exec hr-nginx nginx -s reload
```

#### Проверка статуса всех сервисов
```bash
# Контейнеры
docker ps | grep -E "(hr-|sales-)"

# Сервисы на хосте
ps aux | grep -E "(8000|8002)" | grep -v grep

# Проверка портов
netstat -tlnp | grep -E ":(80|443|3030|8000|8002|5433|5435)"
```

#### Логи
```bash
# Nginx
docker logs hr-nginx

# HR приложение
docker logs hr-miniapp

# 1C Exchange Service
tail -f /root/projects/1c-exchange-service/1c-exchange.log

# Sales Forecast
tail -f /root/projects/SalesForecast/sales_forecast/sales_forecast.log
```

### 🧪 Тестирование обоих сайтов

#### MADLEN.SPACE
```bash
curl -I https://madlen.space/
curl https://madlen.space/api/health
```

#### AQNIET.SITE
```bash
curl -I https://aqniet.site/
curl https://aqniet.site/docs
curl https://aqniet.site/api/branches/
```

### ⚠️ Важные замечания

1. **Порт 443**: Убедитесь, что UFW разрешает HTTPS трафик
2. **Host network**: Nginx запущен в host network mode для доступа к localhost сервисам
3. **SSL Certificates**: Автоматическое обновление через certbot
4. **Rate Limiting**: Настроено в nginx для защиты API

### 🔄 Резервные копии

#### Конфигурации
- **Nginx**: `/root/projects/hr-miniapp/nginx.conf.backup`
- **Infra nginx**: `/root/projects/infra/infra/nginx/conf.d/default.conf.backup`

#### Проекты
- **Sales Forecast**: `/root/projects/SalesForecast/sales_forecast/`
- **1C Exchange**: `/root/projects/1c-exchange-service/`
- **HR Miniapp**: `/root/projects/hr-miniapp/`

---

## ✨ Финальный статус

**🎉 MULTI-DOMAIN СИСТЕМА ПОЛНОСТЬЮ РАЗВЕРНУТА!**

Все компоненты протестированы и работают:
- ✅ **MADLEN.SPACE** - HR Time Tracking System
- ✅ **AQNIET.SITE** - Sales Forecast + 1C Exchange
- ✅ Multi-domain NGINX конфигурация
- ✅ SSL сертификаты для обоих доменов
- ✅ Раздельная маршрутизация сервисов
- ✅ Брандмауэр и безопасность
- ✅ Автоматическое обновление сертификатов
- ✅ Мониторинг и логирование

---

## 🚀 БЫСТРЫЙ ЗАПУСК (One-liner commands)

### Полный деплой с нуля
```bash
#!/bin/bash
# Скрипт полного развертывания multi-domain системы

# 1. Остановить существующие сервисы
sudo systemctl stop nginx
docker stop hr-nginx 2>/dev/null || true
docker rm hr-nginx 2>/dev/null || true
pkill -f "uvicorn.*8000" 2>/dev/null || true
pkill -f "uvicorn.*8002" 2>/dev/null || true

# 2. Настроить брандмауэр
ufw allow 80/tcp
ufw allow 443/tcp

# 3. Запустить backend сервисы
cd /root/projects/1c-exchange-service && nohup ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 > 1c-exchange.log 2>&1 &
cd /root/projects/SalesForecast/sales_forecast && nohup ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8002 > sales_forecast.log 2>&1 &

# 4. Запустить HR систему
cd /root/projects/hr-miniapp && docker-compose up -d hr-postgres hr-miniapp

# 5. Запустить nginx в host mode
docker run -d --name hr-nginx --network host \
  -v /root/projects/hr-miniapp/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /root/projects/infra/infra/certbot/conf:/etc/letsencrypt:ro \
  -v /root/projects/infra/infra/certbot/www:/var/www/certbot:ro \
  nginx:alpine

# 6. Проверить статус
echo "Проверка сервисов..."
sleep 5
curl -I https://madlen.space || echo "❌ madlen.space недоступен"
curl -I https://aqniet.site || echo "❌ aqniet.site недоступен"
```

### Перезапуск только aqniet.site сервисов
```bash
# Остановить сервисы aqniet.site
pkill -f "uvicorn.*8000"
pkill -f "uvicorn.*8002"

# Запустить заново
cd /root/projects/1c-exchange-service && nohup ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 > 1c-exchange.log 2>&1 &
cd /root/projects/SalesForecast/sales_forecast && nohup ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8002 > sales_forecast.log 2>&1 &

# Проверить
curl -I https://aqniet.site
```

### Быстрая диагностика
```bash
echo "=== NGINX STATUS ==="
docker ps | grep nginx
docker logs hr-nginx --tail 5

echo "=== BACKEND SERVICES ==="
ps aux | grep -E "(8000|8002)" | grep -v grep
netstat -tlnp | grep -E ":(8000|8002)"

echo "=== SSL CERTIFICATES ==="
openssl x509 -in /root/projects/infra/infra/certbot/conf/live/madlen.space/fullchain.pem -dates -noout 2>/dev/null || echo "madlen.space cert missing"
openssl x509 -in /root/projects/infra/infra/certbot/conf/live/aqniet.site/fullchain.pem -dates -noout 2>/dev/null || echo "aqniet.site cert missing"

echo "=== SITE AVAILABILITY ==="
curl -s -I https://madlen.space | head -1
curl -s -I https://aqniet.site | head -1
```

## 📁 ВАЖНЫЕ ФАЙЛЫ И ПУТИ

### Конфигурации
- **Nginx главный**: `/root/projects/hr-miniapp/nginx.conf`
- **Nginx резерв**: `/root/projects/hr-miniapp/nginx.conf.backup`
- **Aqniet документация**: `/root/projects/SalesForecast/sales_forecast/AQNIET_SITE_DEPLOYMENT.md`

### SSL сертификаты
- **madlen.space**: `/root/projects/infra/infra/certbot/conf/live/madlen.space/`
- **aqniet.site**: `/root/projects/infra/infra/certbot/conf/live/aqniet.site/`

### Логи
- **Nginx**: `docker logs hr-nginx`
- **1C Exchange**: `/root/projects/1c-exchange-service/1c-exchange.log`
- **Sales Forecast**: `/root/projects/SalesForecast/sales_forecast/sales_forecast.log`
- **HR App**: `docker logs hr-miniapp`

### Проекты
- **HR Miniapp**: `/root/projects/hr-miniapp/`
- **Sales Forecast**: `/root/projects/SalesForecast/sales_forecast/`
- **1C Exchange**: `/root/projects/1c-exchange-service/`
- **Infrastruture**: `/root/projects/infra/infra/`