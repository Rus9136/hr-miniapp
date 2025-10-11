# 🚀 Быстрая справка API для 1С интеграции

> **Базовый URL:** `https://madlen.space/api`

## 📊 Основные endpoints

| Метод | Endpoint | Описание | Лимиты |
|-------|----------|----------|--------|
| `POST` | `/admin/schedules/import-1c` | Импорт графиков работы | 500MB, 10 мин |
| `POST` | `/admin/employees/update-iin` | Обновление ИИН и ФОТ | - |
| `POST` | `/admin/schedules/assign-employee` | Назначить график сотруднику | - |
| `POST` | `/admin/schedules/assign-employees-batch` | Массовое назначение графиков | - |
| `GET` | `/admin/schedules/1c/list` | Список всех графиков | - |
| `GET` | `/admin/schedules/1c` | Детали графика с днями | - |
| `GET` | `/admin/employees/schedules` | Назначения графиков | - |
| `POST` | `/admin/sync/departments` | Синхронизация подразделений | - |
| `POST` | `/admin/sync/positions` | Синхронизация должностей | - |
| `POST` | `/admin/sync/employees` | Синхронизация сотрудников | - |

---

## 📥 1. Импорт графиков

```http
POST /api/admin/schedules/import-1c
Content-Type: application/json

{
  "ДатаВыгрузки": "2025-10-11T10:30:00",
  "КоличествоГрафиков": 1,
  "Графики": [
    {
      "НаименованиеГрафика": "09:00-18:00/MG",
      "КодГрафика": "uuid-код-графика",
      "РабочиеДни": [
        {
          "Дата": "2025-10-11",
          "Месяц": "2025-10-01",
          "ВидУчетаВремени": "Рабочее время",
          "ДополнительноеЗначение": 8,
          "ВремяНачалоРаботы": "09:00:00",
          "ВремяЗавершениеРаботы": "18:00:00"
        }
      ]
    }
  ]
}
```

**Ответ:**
```json
{
  "success": true,
  "statistics": {
    "totalSchedulesProcessed": 1,
    "totalWorkDaysInserted": 365
  }
}
```

---

## 👥 2. Обновление сотрудников

```http
POST /api/admin/employees/update-iin
Content-Type: application/json

[
  {
    "table_number": "АП00-00467",
    "iin": "830909401891",
    "payroll": 212338.00
  }
]
```

**Ответ:**
```json
{
  "success": true,
  "updated": 1
}
```

---

## 📅 3. Назначение графика

```http
POST /api/admin/schedules/assign-employee
Content-Type: application/json

{
  "employee_number": "АП00-00467",
  "schedule_code": "uuid-код-графика",
  "start_date": "2025-01-01",
  "end_date": null
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "График успешно назначен"
}
```

---

## 📊 4. Получить список графиков

```http
GET /api/admin/schedules/1c/list
```

**Ответ:**
```json
[
  {
    "schedule_code": "uuid",
    "schedule_name": "09:00-18:00/MG",
    "days_count": 249,
    "first_day": "2025-01-04",
    "last_day": "2025-12-31"
  }
]
```

---

## 🔍 5. Детали графика

```http
GET /api/admin/schedules/1c?scheduleCode=uuid&dateFrom=2025-10-01&dateTo=2025-10-31
```

**Ответ:**
```json
{
  "schedule": {
    "schedule_code": "uuid",
    "schedule_name": "09:00-18:00/MG"
  },
  "workDays": [
    {
      "work_date": "2025-10-01",
      "work_hours": 8,
      "work_start_time": "09:00:00",
      "work_end_time": "18:00:00"
    }
  ]
}
```

---

## ⚠️ Типичные ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| 400 Bad Request | Невалидный JSON | Проверить формат данных |
| 404 Not Found | Объект не найден | Проверить ID/код |
| 413 Payload Too Large | Файл > 500MB | Разбить на пакеты |
| 500 Internal Error | Ошибка сервера | Связаться с поддержкой |

---

## 🔑 Обязательные поля

### Для графика:
- ✅ `НаименованиеГрафика` (String)
- ✅ `КодГрафика` (UUID)
- ✅ `РабочиеДни` (Array)

### Для рабочего дня:
- ✅ `Дата` (YYYY-MM-DD)
- ✅ `Месяц` (YYYY-MM-01)
- ✅ `ВидУчетаВремени` (String)
- ✅ `ДополнительноеЗначение` (Integer)
- ⚠️ `ВремяНачалоРаботы` (HH:MM:SS или NULL)
- ⚠️ `ВремяЗавершениеРаботы` (HH:MM:SS или NULL)

---

## 📞 Поддержка

- 📧 Email: support@madlengroup.com
- 📚 Полная документация: [API_1C_INTEGRATION.md](API_1C_INTEGRATION.md)
- 🐛 Issues: https://github.com/madlengroup/hr-miniapp/issues

---

**Версия:** 1.0 | **Обновлено:** 2025-10-11
