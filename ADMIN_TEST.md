# Инструкция по тестированию админ-панели

## 1. Запуск приложения
```bash
cd /Users/rus/Projects/hr-miniapp
npm start
```

## 2. Вход в админ-панель
1. Откройте браузер: http://localhost:5555
2. В поле "Табельный номер" введите: **admin12qw**
3. Нажмите "Войти"

## 3. Проверка функциональности

### В консоли браузера (F12) должны появиться логи:
- "loadAdminPanel called"
- "Found menu items: 5" (или больше)
- "Found content sections: 5"
- "loadEmployees called"
- "Loaded employees: 2442" (или другое число)

### Проверьте работу кнопок в левой панели:
1. **Сотрудники** - должна отобразиться таблица с сотрудниками
2. **Подразделения** - должна отобразиться таблица с подразделениями
3. **Должности** - должна отобразиться таблица с должностями

### Проверьте поиск:
- В каждой таблице есть поле поиска
- При вводе текста таблица должна фильтроваться

## 4. Отладка в консоли

Если что-то не работает, выполните в консоли браузера:

```javascript
// Проверить наличие элементов
document.querySelectorAll('.menu-item').length
document.querySelectorAll('.content-section').length

// Проверить видимость секций
document.getElementById('employees-section').style.display
document.getElementById('departments-section').style.display
document.getElementById('positions-section').style.display

// Переключить секцию вручную
window.switchSection('departments')
window.switchSection('positions')

// Проверить данные
fetch('http://localhost:3030/api/admin/employees').then(r => r.json()).then(console.log)
fetch('http://localhost:3030/api/admin/departments').then(r => r.json()).then(console.log)
fetch('http://localhost:3030/api/admin/positions').then(r => r.json()).then(console.log)
```

## 5. Известные проблемы и решения

### Если таблица пустая:
1. Проверьте консоль на ошибки
2. Проверьте, что backend работает на порту 3030
3. Проверьте API: http://localhost:3030/api/admin/employees

### Если кнопки не работают:
1. Обновите страницу (F5)
2. Очистите кеш браузера
3. Проверьте консоль на ошибки JavaScript