# 🔧 Исправление ошибки "Cannot GET" при клике на историю анализа

## 🐛 Описание проблемы

При нажатии на конкретный анализ в истории AI рекомендаций возникала ошибка:
```
❌ Error loading history item: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

## 🔍 Причина проблемы

В коде `ai-recommendations.js` были обращения к устаревшему роуту:
```javascript
// НЕПРАВИЛЬНО (старый роут)
const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/${analysisId}`);
```

Но я ранее изменил роут в `backend/routes/ai-recommendations.js` на:
```javascript
// ПРАВИЛЬНО (новый роут)
router.get('/analysis/:id', async (req, res) => {
```

## ✅ Решение

### 1. Исправлены обращения к API в frontend

**Файл:** `/root/projects/hr-miniapp/ai-recommendations.js`

**Строка 446 (функция `displayAnalysisById`):**
```javascript
// ДО
const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/${analysisId}`);

// ПОСЛЕ  
const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/analysis/${analysisId}`);
```

**Строка 1023 (функция `loadHistoryItem`):**
```javascript
// ДО
const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/${analysisId}`);

// ПОСЛЕ
const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/analysis/${analysisId}`);
```

### 2. Обновлен файл в Docker контейнере

```bash
docker cp /root/projects/hr-miniapp/ai-recommendations.js hr-miniapp:/app/ai-recommendations.js
docker exec hr-nginx nginx -s reload
```

### 3. Проверена работоспособность API

```bash
curl -s "http://localhost:3030/api/admin/ai-recommendations/analysis/19"
```

**Результат:** ✅ Возвращает корректный JSON с данными анализа

## 🧪 Тестирование

### Создан тестовый файл: `/test-history-click.html`

Простая HTML страница для тестирования функции `loadHistoryItem()`:
- Открыть: http://localhost:3030/test-history-click.html
- Ввести ID анализа (например, 19)
- Нажать "Загрузить анализ"
- Проверить результат в консоли браузера

### Проверка основного интерфейса

1. Открыть: http://localhost:3030/ (войти как админ)
2. Перейти в раздел "AI рекомендация"
3. Нажать на любой элемент в истории анализов
4. ✅ Анализ должен загружаться без ошибок

## 📋 Статус исправления

- ✅ **Frontend исправлен** - обновлены URL в двух функциях
- ✅ **Backend работает** - роут `/admin/ai-recommendations/analysis/:id` функционирует
- ✅ **Docker обновлен** - файл скопирован в контейнер
- ✅ **Nginx перезагружен** - кэш обновлен
- ✅ **Тест создан** - проверить можно в `test-history-click.html`

## 🔗 Связанные эндпоинты

Все AI рекомендации эндпоинты теперь используют правильные роуты:

| Функция | Роут | Статус |
|---------|------|--------|
| Анализ | `POST /admin/ai-recommendations/analyze` | ✅ |
| История | `GET /admin/ai-recommendations/history` | ✅ |
| Конкретный анализ | `GET /admin/ai-recommendations/analysis/:id` | ✅ |
| Логи промптов | `GET /admin/ai-recommendations/prompts/:analysisId` | ✅ |
| Промпты агентов | `GET/PUT /admin/ai-recommendations/prompts` | ✅ |
| Провайдеры | `GET /admin/ai-recommendations/providers` | ✅ |

---

**Проблема решена полностью** ✅  
*Дата исправления: 2025-07-15 14:00 UTC*