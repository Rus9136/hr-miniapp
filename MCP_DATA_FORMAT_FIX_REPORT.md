# 🔧 Исправление проблемы с форматом данных MCP API

## 🐛 Описание проблемы

OptimizationAgent в отчете писал **"Отсутствуют данные о выручке, пиковых часах продаж и отклонениях от плана"**, хотя MCP API возвращает данные.

## 🔍 Диагностика

### Шаг 1: Анализ промпта SalesAnalysisAgent
```sql
SELECT substring(full_prompt, 1, 1000) FROM ai_prompt_logs 
WHERE analysis_id = 22 AND agent_name = 'SalesAnalysisAgent';
```

**Результат:** В промпте были значения `"plan": "NaNk", "fact": "NaNk"`

### Шаг 2: Проверка MCP API данных
```sql
SELECT jsonb_pretty(mcp_response->'forecast') FROM ai_recommendations WHERE id = 22;
```

**Результат MCP API:**
```json
{
  "data": [
    {
      "date": "2025-07-15",
      "predicted_sales": 1285567.04  // ← Реальные данные есть!
    }
  ]
}
```

### Шаг 3: Анализ функции обработки данных
**Проблема в `compressDataForTokens()` в `multi-agent-system.js`:**

```javascript
// ПРОБЛЕМНЫЙ КОД
compressed.forecast = forecastData.slice(0, 10).map(item => ({
    date: item.date,
    plan: Math.round(item.plan / 1000) + 'k',      // ← item.plan не существует!
    fact: Math.round(item.fact / 1000) + 'k'       // ← item.fact не существует!
}));
```

## 🔧 Причина проблемы

**Несоответствие форматов данных между MCP API и ожиданиями системы:**

1. **MCP API возвращает:** `predicted_sales`
2. **Система ожидает:** `plan` и `fact`
3. **Результат:** `item.plan` и `item.fact` = `undefined` → конвертируется в `"NaNk"`

## ✅ Решение

### 1. Исправлена обработка данных forecast
```javascript
// ДО (неправильно)
plan: Math.round(item.plan / 1000) + 'k',
fact: Math.round(item.fact / 1000) + 'k'

// ПОСЛЕ (правильно)
plan: item.predicted_sales ? Math.round(item.predicted_sales / 1000) + 'k' : 'N/A',
fact: item.actual_sales ? Math.round(item.actual_sales / 1000) + 'k' : 'N/A'
```

### 2. Добавлена обработка plan_vs_fact данных
```javascript
// Новая секция обработки
const planVsFactData = extractData('plan_vs_fact');
if (planVsFactData && Array.isArray(planVsFactData)) {
    compressed.plan_vs_fact = planVsFactData.slice(0, 10).map(item => ({
        date: item.date,
        plan: item.plan ? Math.round(item.plan / 1000) + 'k' : 'N/A',
        fact: item.fact ? Math.round(item.fact / 1000) + 'k' : 'N/A',
        deviation: item.deviation || 0
    }));
}
```

### 3. Улучшена обработка hourly_sales данных
```javascript
// Поддержка нового формата MCP API с weekdays/weekends
if (hourlySalesData.weekdays && Array.isArray(hourlySalesData.weekdays)) {
    compressed.hourly_sales.push(...hourlySalesData.weekdays.slice(0, 12).map(item => ({
        h: item.hour,
        type: 'weekday',
        sales: item.sales ? Math.round(item.sales / 1000) + 'k' : '0k'
    })));
}
```

## 📊 Ожидаемый результат после исправления

### ДО исправления:
```
SalesAnalysisAgent: "Данные отсутствуют. Нет информации о трендах..."
OptimizationAgent: "Отсутствуют данные о выручке, пиковых часах продаж..."
```

### ПОСЛЕ исправления:
```
SalesAnalysisAgent: "Прогноз продаж на 15.07.2025: 1,286k тенге..."
OptimizationAgent: "На основе прогноза продаж 1,286k тенге рекомендуется..."
```

## 🧪 Тестирование

### Команда для проверки:
```bash
# 1. Запустить новый анализ
curl -X POST "http://localhost:3030/api/admin/ai-recommendations/analyze" \
  -H "Content-Type: application/json" \
  -d '{"department_id": "923819ab-f759-419e-af6a-019f0a822a3d", "date_start": "2025-07-15", "date_end": "2025-07-15", "provider": "openai"}'

# 2. Дождаться завершения (3-4 минуты)

# 3. Проверить промпт SalesAnalysisAgent
docker exec hr-postgres psql -U hr_user -d hr_tracker -c "
SELECT substring(full_prompt, 1, 500) FROM ai_prompt_logs 
WHERE analysis_id = (SELECT MAX(id) FROM ai_recommendations) 
AND agent_name = 'SalesAnalysisAgent';"

# 4. Должны увидеть реальные данные вместо 'NaNk'
```

## 🔗 Связанные файлы

### Исправленные файлы:
- `/backend/services/multi-agent-system.js` - функция `compressDataForTokens()`

### Затронутые агенты:
- **SalesAnalysisAgent** - анализ продаж (основной)
- **PayrollAnalysisAgent** - анализ ФОТ (использует forecast для сравнения)
- **OptimizationAgent** - итоговые рекомендации (зависит от всех агентов)

### MCP API эндпоинты:
- `forecast` - возвращает `predicted_sales`
- `plan_vs_fact` - возвращает `null` (данные отсутствуют)
- `hourly_sales` - возвращает `{weekdays: [], weekends: []}`

## 📋 Дополнительные рекомендации

### 1. Проверка доступности данных
Не все данные доступны в MCP API:
- ✅ `forecast` - есть (`predicted_sales`)
- ❌ `plan_vs_fact` - отсутствует (`data: null`)
- ❌ `hourly_sales` - пустые массивы

### 2. Улучшение промптов агентов
Обновить промпты, чтобы они лучше работали с частично отсутствующими данными:
```
"Если данные отсутствуют, сосредоточься на доступной информации и дай рекомендации по сбору недостающих данных."
```

### 3. Валидация данных
Добавить проверки в `extractData()` функцию для лучшего логирования проблем с форматом данных.

---

**Проблема диагностирована и исправлена** ✅  
*Ожидается улучшение качества анализа во всех агентах*  
*Дата исправления: 2025-07-15 17:00 UTC*