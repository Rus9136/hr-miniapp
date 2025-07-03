# Payroll Attendance API

## Описание
API для получения детализированного отчета ФОТ (Фонд Оплаты Труда) по сменам сотрудников подразделения за указанный период.

## Endpoint
```
GET /api/admin/payroll/attendance
```

## Параметры запроса

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `department_id` | UUID | Да | Идентификатор подразделения (поле `id_iiko` из таблицы `departments`) |
| `from_date` | String | Да | Дата начала периода в формате YYYY-MM-DD |
| `to_date` | String | Да | Дата окончания периода в формате YYYY-MM-DD |

## Примеры запросов

### Production (madlen.space)
```
GET https://madlen.space/api/admin/payroll/attendance?department_id=4cb558ca-a8bc-4b81-871e-043f65218c50&from_date=2025-07-01&to_date=2025-07-31
```

### Development (localhost)
```
GET http://localhost:3030/api/admin/payroll/attendance?department_id=01712d5e-5123-45a2-9297-3df72eb084c7&from_date=2025-07-01&to_date=2025-07-31
```

### cURL
```bash
curl -X GET "https://madlen.space/api/admin/payroll/attendance?department_id=4cb558ca-a8bc-4b81-871e-043f65218c50&from_date=2025-07-01&to_date=2025-07-31"
```

## Ответы API

### Успешный ответ (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "employee_id": "79925",
      "employee_name": "Иванов Иван Иванович",
      "table_number": "АП00-00123",
      "payroll_total": 300000,
      "shifts": [
        {
          "date": "2025-07-03",
          "payroll_for_shift": 100000.00,
          "schedule_name": "График 5/2 с 09:00 до 18:00",
          "work_hours": 8
        },
        {
          "date": "2025-07-04", 
          "payroll_for_shift": 100000.00,
          "schedule_name": "График 5/2 с 09:00 до 18:00",
          "work_hours": 8
        },
        {
          "date": "2025-07-05",
          "payroll_for_shift": 100000.00,
          "schedule_name": "График 5/2 с 09:00 до 18:00", 
          "work_hours": 8
        }
      ]
    }
  ],
  "summary": {
    "department_id": "4cb558ca-a8bc-4b81-871e-043f65218c50",
    "from_date": "2025-07-01", 
    "to_date": "2025-07-31",
    "total_employees": 1,
    "total_shifts": 3,
    "total_payroll": 300000.00
  }
}
```

### Пустой результат (200 OK)
```json
{
  "success": true,
  "data": [],
  "summary": {
    "department_id": "4cb558ca-a8bc-4b81-871e-043f65218c50",
    "from_date": "2025-07-01",
    "to_date": "2025-07-31", 
    "total_employees": 0,
    "total_shifts": 0,
    "total_payroll": 0
  }
}
```

### Ошибки валидации (400 Bad Request)

#### Отсутствуют обязательные параметры
```json
{
  "success": false,
  "error": "Необходимо указать department_id, from_date и to_date"
}
```

#### Неверный формат UUID
```json
{
  "success": false,
  "error": "department_id должен быть в формате UUID"
}
```

#### Неверный формат даты
```json
{
  "success": false,
  "error": "Даты должны быть в формате YYYY-MM-DD"
}
```

#### Неверный диапазон дат
```json
{
  "success": false,
  "error": "from_date не может быть позже to_date"
}
```

### Внутренняя ошибка сервера (500)
```json
{
  "success": false,
  "error": "Ошибка при формировании отчета: [детали ошибки]"
}
```

## Логика работы

### Алгоритм расчета ФОТ по сменам:

1. **Поиск сотрудников подразделения:**
   - Связь через `employees.object_code = departments.object_code`
   - Где `departments.id_iiko = department_id`
   - Только активные сотрудники (`status = 1`)
   - Только сотрудники с ФОТ > 0

2. **Определение смен в периоде:**
   - Через таблицу `employee_schedule_assignments` (назначения графиков)
   - Связь с `work_schedules_1c` по `schedule_code`
   - Учет периода действия назначения (`start_date`, `end_date`)
   - Исключение выходных дней (`time_type != 'В'`)

3. **Расчет ФОТ за смену:**
   ```
   ФОТ за смену = ФОТ сотрудника за месяц / Количество смен в выбранном периоде
   ```

4. **Группировка результатов:**
   - По сотрудникам
   - Массив смен для каждого сотрудника
   - Итоговая статистика

## Структура базы данных

### Основные таблицы:
- `departments` - подразделения (поле `id_iiko` для связи)
- `employees` - сотрудники (поле `payroll` - ФОТ за месяц)
- `employee_schedule_assignments` - назначения графиков сотрудникам
- `work_schedules_1c` - графики работы из 1С (даты смен)

### Связи:
```
departments.object_code ←→ employees.object_code
employees.table_number ←→ employee_schedule_assignments.employee_number  
employee_schedule_assignments.schedule_code ←→ work_schedules_1c.schedule_code
```

## Примеры использования

### Postman Collection
```json
{
  "name": "Payroll Attendance",
  "request": {
    "method": "GET",
    "header": [],
    "url": {
      "raw": "https://madlen.space/api/admin/payroll/attendance?department_id={{department_id}}&from_date={{from_date}}&to_date={{to_date}}",
      "host": ["madlen.space"],
      "path": ["api", "admin", "payroll", "attendance"],
      "query": [
        {"key": "department_id", "value": "{{department_id}}"},
        {"key": "from_date", "value": "{{from_date}}"},
        {"key": "to_date", "value": "{{to_date}}"}
      ]
    }
  }
}
```

### JavaScript (Fetch)
```javascript
const params = new URLSearchParams({
  department_id: '4cb558ca-a8bc-4b81-871e-043f65218c50',
  from_date: '2025-07-01',
  to_date: '2025-07-31'
});

const response = await fetch(`https://madlen.space/api/admin/payroll/attendance?${params}`);
const data = await response.json();

if (data.success) {
  console.log(`Найдено ${data.summary.total_employees} сотрудников`);
  console.log(`Общий ФОТ: ${data.summary.total_payroll} тг`);
} else {
  console.error(data.error);
}
```

### Python (requests)
```python
import requests

params = {
    'department_id': '4cb558ca-a8bc-4b81-871e-043f65218c50',
    'from_date': '2025-07-01',
    'to_date': '2025-07-31'
}

response = requests.get('https://madlen.space/api/admin/payroll/attendance', params=params)
data = response.json()

if data['success']:
    print(f"Найдено {data['summary']['total_employees']} сотрудников")
    print(f"Общий ФОТ: {data['summary']['total_payroll']} тг")
else:
    print(f"Ошибка: {data['error']}")
```

## Тестирование

### Валидные UUID подразделений для тестирования:
- `01712d5e-5123-45a2-9297-3df72eb084c7` (локальная среда)
- `4cb558ca-a8bc-4b81-871e-043f65218c50` (production)

### Типичные тест-кейсы:
1. **Успешный запрос** - валидные параметры, существующий UUID
2. **Отсутствие данных** - период без смен сотрудников
3. **Валидация UUID** - невалидный формат department_id
4. **Валидация дат** - неверный формат или порядок дат
5. **Несуществующий UUID** - валидный UUID, но отсутствующий в БД

## Версия API
- **Создан:** 2025-07-03
- **Версия:** 1.0
- **Статус:** Активен ✅