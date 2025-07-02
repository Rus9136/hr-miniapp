# HR Time Tracking Mini App

Система учета рабочего времени сотрудников с поддержкой Telegram Mini App и iOS WebView.

## 🚀 Возможности

- 📱 **Мультиплатформенность**: Web, Telegram Mini App, iOS WebView
- 🔐 **Авторизация по ИИН**: Безопасный вход для сотрудников
- 📅 **Календарь посещений**: Визуализация рабочего времени
- 📊 **Статистика**: Подсчет часов, опозданий, переработок
- 🌙 **Ночные смены**: Корректный расчет смен через полночь
- 📰 **Новости компании**: Информирование сотрудников
- 👔 **Админ-панель**: Управление данными и синхронизация с 1С

## 📋 Требования

- Node.js 18+
- PostgreSQL 16+
- Docker и Docker Compose (для production)

## 🛠️ Установка

### Локальная разработка

```bash
# Клонируйте репозиторий
git clone <repository-url>
cd hr-miniapp

# Установите зависимости
npm install

# Настройте базу данных
createdb hr_tracker
psql hr_tracker < init.sql

# Запустите приложение
npm start
```

### Production с Docker

```bash
# Скопируйте конфигурацию
cp .env.example .env.production

# Запустите через Docker
docker-compose up -d
```

## 🔧 Конфигурация

Создайте файл `.env`:

```env
NODE_ENV=development
PORT=3030
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hr_tracker
DB_USER=hr_user
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
TELEGRAM_BOT_TOKEN=your_bot_token
```

## 📱 Использование

### Для сотрудников

1. **Web**: Откройте https://madlen.space/
2. **Telegram**: Найдите бота и нажмите "Открыть приложение"
3. **Вход**: Используйте ваш ИИН (12 цифр)
4. **Функции**:
   - Просмотр календаря посещений
   - Статистика за месяц
   - Новости компании
   - Статистика отдела

### Для администраторов

1. **Вход**: Используйте пароль `admin12qw` в поле ИИН
2. **Возможности**:
   - Управление сотрудниками
   - Синхронизация с внешними системами
   - Загрузка табельных данных из Excel
   - Управление графиками работы
   - Публикация новостей

## 📁 Структура проекта

```
hr-miniapp/
├── backend/              # Серверная часть
│   ├── server.js        # Express сервер
│   ├── database.js      # PostgreSQL подключение
│   └── routes/          # API endpoints
├── adapters/            # Платформенные адаптеры
│   ├── BaseAdapter.js   # Базовый класс
│   ├── TelegramAdapter.js # Telegram интеграция
│   └── IOSAdapter.js    # iOS WebView поддержка
├── docs/                # Документация
│   ├── API.md          # API референс
│   ├── DEPLOYMENT.md   # Инструкции по развертыванию
│   └── TROUBLESHOOTING.md # Решение проблем
├── index.html          # Главная страница
├── app.js             # Frontend логика
├── admin.js           # Админ-панель
└── docker-compose.yml # Docker конфигурация
```

## 🧪 Тестирование

```bash
# Добавить тестовые данные
node add_test_data.js

# Проверить базу данных
node check_db.js

# Тестовые аккаунты
ИИН: 123456789012 (обычный сотрудник)
ИИН: 830909401891 (ночные смены)
Админ: admin12qw
```

## 📚 Документация

- [API Reference](docs/API.md) - Описание всех endpoints
- [Deployment Guide](docs/DEPLOYMENT.md) - Инструкции по развертыванию
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Решение распространенных проблем
- [Changelog](CHANGELOG.md) - История изменений

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект является собственностью компании и не предназначен для публичного использования.

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
2. Посмотрите логи: `docker logs hr-miniapp`
3. Создайте issue в репозитории

---

**Версия**: 1.5.0 | **Последнее обновление**: 2025-06-18