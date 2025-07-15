# Документация по логированию промптов AI системы

## 📋 Обзор

Система AI-рекомендаций теперь логирует все промпты и ответы в базу данных для отладки и анализа.

## 🗄️ Структура базы данных

### Таблица `ai_prompt_logs`
```sql
CREATE TABLE ai_prompt_logs (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES ai_recommendations(id),
    agent_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    full_prompt TEXT NOT NULL,
    prompt_length INTEGER NOT NULL,
    system_prompt TEXT,
    response_text TEXT,
    response_length INTEGER,
    request_timestamp TIMESTAMP DEFAULT NOW(),
    response_timestamp TIMESTAMP,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    tokens_used INTEGER
);
```

## 📊 Примеры данных из анализа ID 16

### Данные, которые отправляются в AI модели:

1. **Payroll данные** (ФОТ и смены сотрудников):
   - Имена сотрудников: "Абдирахман Жанеся Нұрдаулетқызы", "Агаева Минара Рахымовна", и т.д.
   - Смены: "10:00-00:00/Бакыт-Н2 2 смена", "10:00-18:00/Бакыт-Н2 вх-ср"
   - Оплата за смену: от 9,285.71 до 28,127.78 тенге
   - Общий ФОТ: от 85,000 до 253,150 тенге

2. **Forecast данные** (прогнозы продаж):
   - Планы и факты продаж по дням
   - Данные за период с 2025-07-15 по 2025-07-31

3. **Reviews данные** (отзывы клиентов):
   - Рейтинги и комментарии клиентов
   - Анализ настроений и проблем

## 🔍 Проверка данных в базе

### 1. Проверка количества залогированных промптов
```sql
SELECT COUNT(*) FROM ai_prompt_logs;
```

### 2. Просмотр последних промптов
```sql
SELECT 
    id, agent_name, provider, prompt_length, response_length, 
    success, tokens_used, request_timestamp
FROM ai_prompt_logs 
ORDER BY request_timestamp DESC 
LIMIT 10;
```

### 3. Анализ по провайдерам
```sql
SELECT 
    provider, 
    COUNT(*) as total_prompts,
    AVG(prompt_length) as avg_prompt_length,
    AVG(response_length) as avg_response_length,
    AVG(tokens_used) as avg_tokens
FROM ai_prompt_logs 
GROUP BY provider;
```

### 4. Просмотр конкретного промпта
```sql
SELECT 
    agent_name, provider, full_prompt, response_text, 
    prompt_length, response_length, tokens_used
FROM ai_prompt_logs 
WHERE id = 1; -- замените на нужный ID
```

### 5. Анализ успешности по агентам
```sql
SELECT 
    agent_name, 
    COUNT(*) as total_requests,
    COUNT(CASE WHEN success THEN 1 END) as successful_requests,
    ROUND(COUNT(CASE WHEN success THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM ai_prompt_logs 
GROUP BY agent_name;
```

## 🔧 Запуск команд в базе данных

```bash
# Подключение к базе данных
docker exec -it hr-postgres psql -U hr_user -d hr_tracker

# Или выполнение команды напрямую
docker exec hr-postgres psql -U hr_user -d hr_tracker -c "SELECT COUNT(*) FROM ai_prompt_logs;"
```

## 📋 Проверка проблем с плейсхолдерами

### Поиск незамененных плейсхолдеров в промптах
```sql
SELECT 
    id, agent_name, provider, prompt_length,
    (full_prompt ~ '\{[a-zA-Z_][a-zA-Z0-9_]*\}') as has_placeholders
FROM ai_prompt_logs 
WHERE full_prompt ~ '\{[a-zA-Z_][a-zA-Z0-9_]*\}';
```

### Анализ содержимого промптов
```sql
SELECT 
    agent_name, provider,
    (full_prompt LIKE '%forecast%') as has_forecast_data,
    (full_prompt LIKE '%payroll%') as has_payroll_data,
    (full_prompt LIKE '%reviews%') as has_reviews_data,
    (full_prompt LIKE '%{%}%') as has_placeholders
FROM ai_prompt_logs;
```

## 🚨 Поиск проблем в промптах

### Промпты с сообщениями об отсутствующих данных
```sql
SELECT 
    id, agent_name, provider, 
    full_prompt
FROM ai_prompt_logs 
WHERE full_prompt LIKE '%отсутствуют в MCP API%';
```

### Анализ ответов AI на отсутствие данных
```sql
SELECT 
    agent_name, provider,
    response_text
FROM ai_prompt_logs 
WHERE response_text LIKE '%предоставьте данные%' 
   OR response_text LIKE '%недостаточно данных%';
```

## 📊 Анализ производительности

### Средняя длина промптов по агентам
```sql
SELECT 
    agent_name,
    AVG(prompt_length) as avg_prompt_length,
    MIN(prompt_length) as min_prompt_length,
    MAX(prompt_length) as max_prompt_length
FROM ai_prompt_logs 
GROUP BY agent_name 
ORDER BY avg_prompt_length DESC;
```

### Время ответа по провайдерам
```sql
SELECT 
    provider,
    AVG(EXTRACT(EPOCH FROM (response_timestamp - request_timestamp))) as avg_response_time_seconds
FROM ai_prompt_logs 
WHERE response_timestamp IS NOT NULL
GROUP BY provider;
```

## 🎯 Примеры реальных данных

### Что должно быть в промптах:
- ✅ **Реальные имена сотрудников**: "Абдирахман Жанеся Нұрдаулетқызы"
- ✅ **Конкретные суммы**: "payroll_for_shift": 28127.78
- ✅ **Расписания смен**: "10:00-00:00/Бакыт-Н2 2 смена"
- ✅ **Даты**: "2025-07-15", "2025-07-30"

### Что НЕ должно быть в промптах:
- ❌ **Плейсхолдеры**: `{forecast}`, `{payroll}`, `{reviews}`
- ❌ **Пустые значения**: `null`, `undefined`, `[]`
- ❌ **Сообщения об ошибках**: "Данные отсутствуют"

## 🔄 Процесс отладки

1. **Запустить анализ** через веб-интерфейс или API
2. **Проверить логи** в базе данных
3. **Найти проблемные промпты** с плейсхолдерами
4. **Исправить логику** замены плейсхолдеров
5. **Повторить тест** для проверки

## 📝 Заключение

Система логирования позволяет:
- ✅ Видеть точное содержимое промптов
- ✅ Отслеживать успешность замены плейсхолдеров
- ✅ Анализировать производительность провайдеров
- ✅ Находить проблемы в данных MCP API

Используйте SQL запросы выше для диагностики проблем с AI системой.