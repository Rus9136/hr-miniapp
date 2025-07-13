# GET Department by ID or id_iiko API

## Endpoint
```
GET /api/admin/departments/:id
```

## Description
Получение информации о конкретном подразделении по его внутреннему ID или id_iiko (UUID).

## Parameters
- `id` (required) - ID подразделения в базе данных ИЛИ id_iiko (UUID формат)

**Автоматическое определение типа:**
- Если параметр соответствует UUID формату (например: `12345678-1234-4234-a234-123456789012`), то поиск выполняется по полю `id_iiko`
- Если параметр числовой (например: `107`), то поиск выполняется по полю `id`

## Response

### Success (200 OK)
```json
{
  "id": 107,
  "id_iiko": "0d30c200-87b5-45a5-89f0-eb76e2892b4a",
  "object_name": "04 - Электроника",
  "object_code": "000000239",
  "object_parent": "000000238",
  "object_company": "Меломан Home Video ТОО",
  "object_bin": "040840001482",
  "hall_area": "150",
  "kitchen_area": null,
  "seats_count": null
}
```

### Fields Description
- `id` - Внутренний ID подразделения
- `id_iiko` - ID подразделения в системе iiko
- `object_name` - Название подразделения
- `object_code` - Код подразделения
- `object_parent` - Код родительского подразделения
- `object_company` - Название компании
- `object_bin` - БИН организации
- `hall_area` - Площадь зала (м²)
- `kitchen_area` - Площадь кухни (м²)
- `seats_count` - Количество посадочных мест

### Error Response (404 Not Found)
```json
{
  "error": "Department not found",
  "message": "Подразделение с ID 99999 не найдено"
}
```

### Error Response (500 Internal Server Error)
```json
{
  "error": "Internal server error",
  "message": "Ошибка при получении данных подразделения"
}
```

## Example Usage

### JavaScript/Fetch

**Поиск по числовому ID:**
```javascript
const departmentId = 107;

fetch(`/api/admin/departments/${departmentId}`)
  .then(response => {
    if (!response.ok) {
      throw new Error('Department not found');
    }
    return response.json();
  })
  .then(department => {
    console.log('Department:', department);
    console.log('Hall area:', department.hall_area);
    console.log('Seats count:', department.seats_count);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

**Поиск по id_iiko (UUID):**
```javascript
const departmentIdIiko = "12345678-1234-4234-a234-123456789012";

fetch(`/api/admin/departments/${departmentIdIiko}`)
  .then(response => response.json())
  .then(department => {
    console.log('Department by id_iiko:', department);
  });
```

### cURL Examples

**По числовому ID:**
```bash
curl -X GET "http://localhost:3030/api/admin/departments/107"
```

**По id_iiko (UUID):**
```bash
curl -X GET "http://localhost:3030/api/admin/departments/12345678-1234-4234-a234-123456789012"
```

### With jq for pretty output
```bash
# По ID
curl -s "http://localhost:3030/api/admin/departments/107" | jq .

# По id_iiko
curl -s "http://localhost:3030/api/admin/departments/12345678-1234-4234-a234-123456789012" | jq .
```