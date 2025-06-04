# План реализации связи сотрудников с графиками работы

## Дата: 2025-06-04
## Автор: Claude (Anthropic)

## 1. Описание задачи
Создать механизм для связывания сотрудников с графиками работы из системы 1С. Связь должна поддерживать историчность (возможность отслеживать изменения графиков сотрудников во времени).

## 2. Архитектура решения

### 2.1 Новая таблица: employee_schedule_assignments
```sql
CREATE TABLE employee_schedule_assignments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    employee_number VARCHAR(255) NOT NULL,
    schedule_code VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    assigned_by VARCHAR(255) DEFAULT '1C',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_active_schedule 
        UNIQUE(employee_number, start_date),
    INDEX idx_employee_schedule (employee_number, schedule_code),
    INDEX idx_schedule_dates (start_date, end_date)
);
```

### 2.2 Связи между таблицами
```
employees (сотрудники)
    ↓ employee_id, employee_number
employee_schedule_assignments (назначения графиков)
    ↓ schedule_code
work_schedules_1c (детали графиков по дням)
```

## 3. API Endpoints

### 3.1 Назначение графика сотруднику
**POST /api/admin/schedules/assign-employee**
```json
{
    "employee_number": "АП00-00358",
    "schedule_code": "76c06530-1aad-11f0-90de-3cecef8cc60b",
    "start_date": "2025-06-01"
}
```

### 3.2 Массовое назначение графиков
**POST /api/admin/schedules/assign-employees-batch**
```json
{
    "assignments": [
        {
            "employee_number": "АП00-00358",
            "schedule_code": "76c06530-1aad-11f0-90de-3cecef8cc60b",
            "start_date": "2025-06-01"
        },
        {
            "employee_number": "АП00-00359",
            "schedule_code": "76c06530-1aad-11f0-90de-3cecef8cc60b",
            "start_date": "2025-06-01"
        }
    ]
}
```

### 3.3 Получение текущего графика сотрудника
**GET /api/admin/employees/:employee_number/current-schedule**

### 3.4 История графиков сотрудника
**GET /api/admin/employees/:employee_number/schedule-history**

## 4. Логика обработки

### 4.1 При назначении нового графика:
1. Проверить существование сотрудника по табельному номеру
2. Проверить существование графика по коду
3. Если у сотрудника есть активный график (end_date = NULL):
   - Установить end_date = start_date нового графика - 1 день
4. Создать новую запись с end_date = NULL
5. Вернуть статус операции

### 4.2 Валидация:
- Если сотрудник не найден - пропустить запись
- Если график не найден - пропустить запись
- Не блокировать операцию при ошибках отдельных записей
- Вернуть статистику: сколько назначено, сколько пропущено

## 5. План реализации

### Этап 1: База данных
- [ ] Создать SQL миграцию 006_employee_schedule_assignments.sql
- [ ] Обновить database_pg.js для создания новой таблицы
- [ ] Выполнить миграцию на production

### Этап 2: API
- [ ] Создать endpoint для одиночного назначения
- [ ] Создать endpoint для массового назначения
- [ ] Создать endpoints для получения информации
- [ ] Добавить логирование операций

### Этап 3: Тестирование
- [ ] Создать тестовые данные
- [ ] Протестировать одиночное назначение
- [ ] Протестировать массовое назначение
- [ ] Проверить корректность истории

### Этап 4: Интеграция
- [ ] Обновить существующие endpoints для учета графиков
- [ ] Добавить информацию о графике в ответы API сотрудников

## 6. Примеры использования

### 6.1 Назначение графика через 1С:
```bash
curl -X POST https://madlen.space/api/admin/schedules/assign-employee \
  -H "Content-Type: application/json" \
  -d '{
    "employee_number": "АП00-00358",
    "schedule_code": "76c06530-1aad-11f0-90de-3cecef8cc60b",
    "start_date": "2025-06-01"
  }'
```

### 6.2 Ответ API:
```json
{
    "success": true,
    "message": "График успешно назначен",
    "assignment": {
        "id": 1,
        "employee_number": "АП00-00358",
        "employee_name": "Суиндикова Сайраш Агабековна",
        "schedule_code": "76c06530-1aad-11f0-90de-3cecef8cc60b",
        "schedule_name": "05:00-17:00/MG 1 смена",
        "start_date": "2025-06-01",
        "previous_schedule_ended": true
    }
}
```

## 7. Будущие улучшения
- Добавить проверку пересечений дат при назначении
- Реализовать временные назначения (с указанием end_date)
- Добавить причину изменения графика
- Интеграция с расчетом рабочего времени