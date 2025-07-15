# 🏷️ Обновление отображения провайдера в истории AI анализов

## 📋 Описание изменения

В истории AI анализов теперь отображается название использованного провайдера рядом с названием подразделения.

## 🎯 Что было изменено

### 1. Обновлен SQL запрос в `/backend/routes/ai-recommendations.js`

**Было:**
```sql
SELECT id, department_id, date_start, date_end, created_at,
       jsonb_extract_path_text(mcp_response, 'department_info', 'data', 'object_name') as department_name
FROM ai_recommendations 
ORDER BY created_at DESC
```

**Стало:**
```sql
SELECT id, department_id, date_start, date_end, created_at, provider,
       CONCAT(
           jsonb_extract_path_text(mcp_response, 'department_info', 'data', 'object_name'),
           ' (',
           CASE provider
               WHEN 'claude' THEN 'CLAUDE'
               WHEN 'openai' THEN 'CHAT GPT'
               WHEN 'gemini' THEN 'GEMINI'
               ELSE UPPER(provider)
           END,
           ')'
       ) as department_name
FROM ai_recommendations 
ORDER BY created_at DESC
```

## 📊 Примеры отображения

- **Кофейня/Бакыт-Н2/АУП (CLAUDE)** - для анализов от Claude
- **Кофейня/Бакыт-Н2/АУП (CHAT GPT)** - для анализов от OpenAI
- **Кофейня/Бакыт-Н2/АУП (GEMINI)** - для анализов от Gemini (будущее)

## 🗄️ Структура хранения результатов

### Таблица `ai_recommendations`:
- **id** - идентификатор анализа
- **department_id** - UUID подразделения
- **date_start** - дата начала анализа
- **date_end** - дата конца анализа
- **mcp_response** - JSONB с исходными данными от MCP API
- **agent_results** - JSONB с результатами всех агентов
- **created_at** - время создания анализа
- **provider** - AI провайдер (claude/openai/gemini)

### Структура `agent_results`:
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

## ✅ Преимущества изменения

1. **Прозрачность**: Пользователь сразу видит, какой AI провайдер использовался
2. **Сравнение**: Легко сравнить результаты разных провайдеров для одного подразделения
3. **Диагностика**: Помогает при решении проблем с конкретным провайдером

## 🚀 Развертывание

1. Изменения автоматически применяются после перезапуска контейнера
2. Не требуется миграция базы данных
3. Обратная совместимость сохранена

---

**Дата обновления**: 2025-07-15
**Статус**: ✅ Внедрено в production