# План реализации AI рекомендаций для HR Mini App

## 🎯 Цель проекта
Создать раздел "AI рекомендации" в админ-панели с мультиагентным анализом подразделений ресторана на основе единого API-ответа от MCP.

## 📋 Этапы реализации

### Этап 1: Подготовка инфраструктуры ⚡ (КРИТИЧНО)
- [x] Создать план работы
- [ ] Настроить .env файл с Anthropic API ключом
- [ ] Проверить доступность MCP API
- [ ] Настроить зависимости для работы с Anthropic API

### Этап 2: Backend разработка 🔧
- [ ] Создать API endpoints для AI рекомендаций
- [ ] Реализовать мультиагентную систему анализа (6 агентов)
- [ ] Интегрировать с MCP API для получения данных
- [ ] Добавить обработку ошибок и валидацию

### Этап 3: Мультиагентная система 🤖
- [ ] SalesAnalysisAgent - анализ продаж
- [ ] PayrollAnalysisAgent - анализ затрат
- [ ] StaffingAgent - оптимизация смен
- [ ] ReputationAgent - анализ отзывов
- [ ] OptimizationAgent - рекомендации по оптимизации
- [ ] NarrativeAgent - итоговый отчет

### Этап 4: Frontend разработка 🎨
- [ ] Создать UI раздела AI рекомендации
- [ ] Добавить формы для выбора подразделения и периода
- [ ] Реализовать отображение результатов каждого агента
- [ ] Добавить возможность редактирования промптов

### Этап 5: Функционал сохранения 💾
- [ ] Сохранение промптов (localStorage/БД)
- [ ] Сохранение результатов анализа
- [ ] История запросов и результатов

### Этап 6: Тестирование и оптимизация 🧪
- [ ] Тестирование всех компонентов
- [ ] Обработка ошибок API
- [ ] Оптимизация производительности
- [ ] Документация для пользователей

## 🔑 Архитектура системы

### API Endpoints
```
POST /api/admin/ai-recommendations/analyze
GET /api/admin/ai-recommendations/history
PUT /api/admin/ai-recommendations/prompts
```

### Структура файлов
```
backend/
├── routes/ai-recommendations.js    # Основные API endpoints
├── services/
│   ├── mcp-client.js              # Клиент для MCP API
│   ├── anthropic-client.js        # Клиент Anthropic API
│   └── multi-agent-system.js      # Мультиагентная система
└── models/ai-prompts.js           # Модель промптов

frontend/
├── ai-recommendations.html        # UI страница
├── ai-recommendations.js          # Логика фронтенда
└── ai-recommendations.css         # Стили
```

### База данных
```sql
CREATE TABLE ai_recommendations (
    id SERIAL PRIMARY KEY,
    department_id UUID,
    date_start DATE,
    date_end DATE,
    mcp_response JSONB,
    agent_results JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_prompts (
    agent_name VARCHAR(50) PRIMARY KEY,
    prompt_text TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 MCP API Integration

### Endpoint
```
POST https://mcp.madlen.space/api/v1/mcp/dashboard
```

### Request Format
```json
{
  "department_id": "4cb558ca-a8bc-4b81-871e-043f65218c50",
  "date_start": "2025-07-06", 
  "date_end": "2025-07-13",
  "reviews_count": 50
}
```

### Expected Response Structure
```json
{
  "forecast": { "data": [...] },
  "plan_vs_fact": { "data": [...] },
  "hourly_sales": { "data": [...] },
  "payroll": { "data": [...] },
  "reviews": { "data": [...] },
  "department_info": { "data": {...} }
}
```

## 🤖 Агенты и их данные

| Агент | Входные данные | Назначение |
|-------|---------------|------------|
| SalesAnalysisAgent | forecast, plan_vs_fact, hourly_sales | Анализ динамики продаж |
| PayrollAnalysisAgent | payroll, forecast | Анализ затрат на персонал |
| StaffingAgent | payroll, hourly_sales | Оптимизация расписания |
| ReputationAgent | reviews | Анализ отзывов клиентов |
| OptimizationAgent | результаты всех агентов | Общие рекомендации |
| NarrativeAgent | все данные + результаты | Итоговый отчет |

## 🔒 Безопасность
- API ключ Anthropic в .env файле
- Валидация входных данных
- Rate limiting для API запросов
- Логирование операций

## 📊 Ожидаемый результат
Полнофункциональный раздел админ-панели, позволяющий:
1. Выбрать подразделение и период анализа
2. Получить комплексный AI-анализ от 6 специализированных агентов
3. Редактировать промпты для настройки анализа
4. Сохранять и просматривать историю рекомендаций
5. Экспортировать отчеты

---

**Следующий шаг:** Настройка .env файла и проверка доступности API