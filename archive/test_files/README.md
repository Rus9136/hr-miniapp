# Archive: Test Files

## Описание
Этот архив содержит тестовые файлы и утилиты, которые были перемещены из корня проекта для очистки структуры.

## Дата перемещения
2025-06-18

## Статистика
- **Перемещено файлов**: 37
- **Категории**: HTML тесты, JS утилиты, Python тесты, проверочные скрипты

## Важные файлы, которые ОСТАЛИСЬ в корне:
- `add_test_data.js` - основная утилита добавления тестовых данных
- `check_db.js` - проверка состояния базы данных
- `test_admin.html` - тесты админ-панели
- `test_debug.html` - консоль отладки API
- `test_debug_auth.html` - отладка авторизации
- `test_telegram.html` - тесты Telegram интеграции
- `test_night_shift_fix.js` - утилита тестирования ночных смен
- `test_schedule_based_hours.js` - тесты графиков работы
- `test_timezone_fix.js` - тесты часовых поясов

## Содержимое архива

### HTML Test Files (8 files)
- test_admin_simple.html
- test_final.html
- test_frontend.html
- test_integration.html
- test_platform_detection.html
- test_schedule_display.html
- test_schedules.html
- test_telegram_frontend.html

### Test Data Creation (3 files)
- add_test_events_for_employee.js
- add_test_news.js
- create_night_shift_test_data.js

### Analysis & Fix Scripts (7 files)
- analyze_night_shifts.js
- correct_timezone_test.js
- final_timezone_test.js
- fix_event_types.js
- fix_night_shift_calculation.js
- fix_production_direct.js
- fix_time_events.js

### Check Scripts (6 files)
- check_dates.js
- check_loaded_events.js
- check_organization_data.js
- check_production.js
- check_time_data.js
- estimate_loading_time.js

### Cleanup & Migration Scripts (8 files)
- clear_and_reload_production.js
- clear_production_tables.js
- clear_time_tables.js
- production_test.js
- run_migration_1c.js
- run_migration_hours_breakdown.js
- run_migration_off_schedule.js
- set_db_timezone.js

### Python Tests (4 files)
- test_schedule_assignment.py
- test_schedule_assignment_simple.py
- test_schedules_1c.py
- test_schedules_1c_pytest.py

## Безопасность
Все файлы проверены и могут быть безопасно удалены, если приложение работает стабильно.

## Восстановление
Если нужно восстановить какой-либо файл, переместите его обратно в корень проекта:
```bash
mv archive/test_files/filename.js ./
```