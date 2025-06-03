# Database Migrations

This directory contains PostgreSQL migration scripts for the HR Mini App.

## Migration Files

- `002_work_schedules.sql` - Creates advanced work schedule management tables

## Running Migrations

To run a specific migration:

```bash
node migrations/run_migration.js 002_work_schedules.sql
```

## Work Schedules Migration (002)

This migration creates a comprehensive work schedule management system with:

### Tables Created:

1. **work_schedule_templates** - Different work patterns (5/2, shifts, etc.)
2. **work_schedule_rules** - Daily rules for each template
3. **employee_schedule_history** - Tracks schedule assignments over time

### Features:

- Support for various schedule types: fixed, shift, flexible, custom
- Configurable work hours, break times, and tolerance periods
- Historical tracking of schedule changes
- Built-in templates: Standard 5/2, Shift 2/2, Shift 3/3, 24h Shift, Flexible

### Useful Functions:

- `get_employee_schedule_for_date(employee_number, date)` - Gets schedule rules for a specific date
- `employee_current_schedules` view - Shows current schedule assignments

### Example Usage:

```sql
-- Get schedule for employee on specific date
SELECT * FROM get_employee_schedule_for_date('АП00-00358', '2025-01-06');

-- View all current schedule assignments
SELECT * FROM employee_current_schedules;

-- Assign a schedule to an employee
INSERT INTO employee_schedule_history (employee_id, employee_number, template_id, start_date, assigned_by)
VALUES (1, 'АП00-00358', 1, '2025-01-01', 'admin');
```