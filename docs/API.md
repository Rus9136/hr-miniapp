# API Documentation

## Base URL
- Development: `http://localhost:3030/api`
- Production: `https://madlen.space/api`

## Authentication
- Employee login: POST to `/api/login` with IIN (12 digits)
- Admin login: POST to `/api/login` with password "admin12qw"
- JWT tokens used for session management (30 days expiration)

## Main Application Endpoints

### Authentication
```
POST   /api/login
       Body: { iin: "123456789012" }
       Returns: { token, employee }

POST   /api/telegram/link
       Links Telegram account to employee

POST   /api/telegram/unlink
       Unlinks Telegram account
```

### Employee Data
```
GET    /api/employee/by-number/:tableNumber/timesheet/:year/:month
       Get monthly attendance calendar

GET    /api/employee/by-number/:tableNumber/statistics/:year/:month
       Get monthly statistics

GET    /api/employee/by-number/:tableNumber/time-events
       Get time events (entries/exits)

GET    /api/employee/by-number/:tableNumber/department-stats/:year/:month
       Get department statistics
```

### News
```
GET    /api/news
       Get company news list

GET    /api/news/:id
       Get specific news article
```

### Health Check
```
GET    /api/health
       Returns: { status: "OK", timestamp }
```

## Admin Panel Endpoints

### Authentication
Admin endpoints require Authorization header with JWT token from admin login.

### Employee Management
```
GET    /api/admin/employees
       Query params: page, limit, search, department

GET    /api/admin/departments
       Get all departments

GET    /api/admin/positions
       Get all positions
```

### Data Synchronization
```
POST   /api/admin/sync/departments
       Sync departments from external API

POST   /api/admin/sync/positions
       Sync positions from external API

POST   /api/admin/sync/employees
       Sync employees from external API
```

### Time Management
```
GET    /api/admin/time-events
       Query params: employee, date, page, limit

GET    /api/admin/time-records
       Query params: employee, date, status, page, limit

POST   /api/admin/recalculate-time-records
       Recalculate all time records
```

### Excel Import
```
POST   /api/admin/load/timesheet
       Body: multipart/form-data with Excel file
       Returns: { progressId }

GET    /api/admin/load/progress/:id
       Get import progress status
```

### Schedule Management
```
GET    /api/admin/work-schedules-1c
       Get all 1C work schedules

GET    /api/admin/work-schedules-1c/:id
       Get specific schedule details

POST   /api/admin/work-schedules-1c/employees
       Assign schedule to employees
       Body: { scheduleId, employeeIds[], dateStart, dateEnd }
```

### News Management
```
GET    /api/admin/news
       Get all news for admin

POST   /api/admin/news
       Create news article
       Body: { title, content, category, date }

PUT    /api/admin/news/:id
       Update news article

DELETE /api/admin/news/:id
       Delete news article
```

## Error Responses

All endpoints return consistent error format:
```json
{
  "error": "Error message",
  "details": "Additional information (optional)"
}
```

Common HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting
- 100 requests per minute per IP
- 1000 requests per hour per user

## External API Integration

Base URL: `http://tco.aqnietgroup.com:5555/v1`

### Available Endpoints
```
GET    /objects          # Departments
GET    /staff_position   # Positions
GET    /staff            # Employees
POST   /event/filter     # Time events
```

Note: External API often returns empty arrays. Fallback to test data is implemented.