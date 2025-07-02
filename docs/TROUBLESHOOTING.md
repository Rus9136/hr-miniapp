# Troubleshooting Guide

## Common Issues and Solutions

### 🔴 Application Won't Start

#### Symptoms
- Server doesn't respond on port 3030
- "Connection refused" errors

#### Solutions
```bash
# Check if port is already in use
lsof -i :3030

# Kill existing process
lsof -ti:3030 | xargs kill -9

# Restart with logs
node backend/server.js 2>&1 | tee server.log
```

### 🔴 Database Connection Errors

#### Symptoms
- "ECONNREFUSED" errors
- "Database hr_tracker does not exist"

#### Solutions
```bash
# Check PostgreSQL status
docker ps | grep postgres

# Create database manually
docker exec -it hr-postgres psql -U postgres -c "CREATE DATABASE hr_tracker;"

# Check connection
docker exec hr-miniapp nc -zv hr-postgres 5432
```

### 🔴 Login Issues

#### Issue: "Сотрудник не найден"
**Cause**: Employee with given IIN doesn't exist
**Solution**: 
- Use test IIN: 123456789012
- Or add employee with: `node add_test_data.js`

#### Issue: Admin login not working
**Cause**: Wrong password or format
**Solution**: 
- Use exactly: admin12qw
- Enter in IIN field, not separate password field

### 🔴 Telegram Integration Issues

#### Bot doesn't respond
```bash
# Check bot token
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# Check webhook
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
```

#### Account linking fails
- Ensure user logged in via web first
- Check JWT token is valid
- Verify Telegram data signature

### 🔴 iOS WebView Issues

#### Navigation not working
- Check platformDetector.js is loaded
- Verify IOSAdapter is initialized
- Look for JavaScript errors in Safari console

#### Styles broken
- Ensure ios-styles.css is loaded
- Check viewport meta tag is present

### 🟡 Performance Issues

#### Slow API responses
```bash
# Check database indexes
docker exec -it hr-postgres psql -U hr_user hr_tracker -c "\di"

# Add missing indexes if needed
CREATE INDEX idx_time_events_employee_date ON time_events(employee_number, event_datetime);
CREATE INDEX idx_employees_number ON employees(table_number);
```

#### High memory usage
```bash
# Check Node.js memory
docker stats hr-miniapp

# Increase memory limit if needed
docker update --memory="1g" hr-miniapp
```

### 🟡 Data Sync Issues

#### External API returns empty arrays
**This is expected behavior** - External API often has no data
- Use local test data instead
- Run `node add_test_data.js`

#### Excel upload fails
- Check file format (must be .xlsx)
- Verify column names match expected format
- Look for specific error in response

### 🟡 Display Issues

#### Calendar not showing data
1. Check browser console for errors
2. Verify API returns data:
   ```bash
   curl http://localhost:3030/api/employee/by-number/АП00-00358/timesheet/2025/6
   ```
3. Clear browser cache

#### Wrong status colors
- Check time zone settings
- Verify schedule assignments
- Look at time calculation logic

### 🔵 Development Issues

#### Changes not reflecting
```bash
# Clear Node.js cache
rm -rf node_modules/.cache

# Restart with fresh build
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### TypeScript/ESLint errors
```bash
# Install dev dependencies
npm install --include=dev

# Run checks
npm run lint
npm run typecheck
```

## Debug Tools

### API Testing
```bash
# Test login
curl -X POST http://localhost:3030/api/login \
  -H "Content-Type: application/json" \
  -d '{"iin":"123456789012"}'

# Test with token
TOKEN="your_jwt_token"
curl http://localhost:3030/api/employee/by-number/АП00-00358/timesheet/2025/6 \
  -H "Authorization: Bearer $TOKEN"
```

### Database Queries
```bash
# Connect to database
docker exec -it hr-postgres psql -U hr_user hr_tracker

# Useful queries
SELECT COUNT(*) FROM employees;
SELECT * FROM employees WHERE iin = '123456789012';
SELECT * FROM time_events ORDER BY event_datetime DESC LIMIT 10;
```

### Check Logs
```bash
# Application logs
docker logs hr-miniapp --tail 100 -f

# Database logs  
docker logs hr-postgres --tail 50

# Nginx logs
docker logs hr-nginx --tail 50
```

## Error Messages Reference

| Error | Meaning | Solution |
|-------|---------|----------|
| "ECONNREFUSED ::1:5432" | PostgreSQL not running | Start PostgreSQL service |
| "JWT malformed" | Invalid token format | Re-login to get new token |
| "Telegram data is invalid" | HMAC validation failed | Check bot token is correct |
| "Cannot read property 'tableNumber' of null" | Employee not found | Verify employee exists in DB |
| "CORS policy blocked" | Cross-origin request blocked | Check CORS configuration |

## Getting Help

1. **Check logs first** - Most issues are visible in logs
2. **Test in isolation** - Use curl to test API directly
3. **Verify data** - Use check_db.js to inspect database
4. **Browser console** - Frontend errors appear here
5. **Docker status** - Ensure all containers are healthy

### Useful Commands Summary
```bash
# Quick health check
curl http://localhost:3030/api/health

# View recent errors
docker logs hr-miniapp 2>&1 | grep ERROR | tail -20

# Database connection test
docker exec hr-miniapp pg_isready -h hr-postgres -U hr_user

# Full system check
docker-compose ps && curl -s http://localhost:3030/api/health | jq .
```