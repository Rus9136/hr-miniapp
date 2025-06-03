console.log('🚀 HR Mini App FINAL v4.0 - CACHE BUST: ' + new Date().getTime());

// API configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3030/api' 
    : 'https://madlen.space/api';
window.API_BASE_URL = API_BASE_URL; // Export for admin.js

// State management
let currentEmployee = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let calendarData = [];
let timeEventsData = null;

// Platform detection
const isInTelegram = window.tgApp ? window.tgApp.isInTelegram : false;
const currentScreen = { name: 'login', previous: null };

console.log(`Platform: ${isInTelegram ? 'Telegram Mini App' : 'Web Browser'}`);

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const menuScreen = document.getElementById('menuScreen');
const mainScreen = document.getElementById('mainScreen');
const newsScreen = document.getElementById('newsScreen');
const salaryScreen = document.getElementById('salaryScreen');
const vacationScreen = document.getElementById('vacationScreen');
const hrScreen = document.getElementById('hrScreen');
const dayModal = document.getElementById('dayModal');
const statsModal = document.getElementById('statsModal');

// Navigation functions for Telegram
function showScreen(screenName, screenElement) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    // Show target screen
    screenElement.classList.add('active');
    screenElement.style.display = 'block';
    
    // Update current screen state
    currentScreen.previous = currentScreen.name;
    currentScreen.name = screenName;
    
    // Handle Telegram navigation
    if (isInTelegram) {
        handleTelegramNavigation(screenName);
    }
    
    console.log(`Navigated to: ${screenName}`);
}

function handleTelegramNavigation(screenName) {
    if (!window.tgApp) return;
    
    // Show/hide back button based on screen
    if (screenName === 'login' || screenName === 'menu') {
        window.tgApp.hideBackButton();
    } else {
        window.tgApp.showBackButton();
    }
    
    // Hide admin screen in Telegram (web only)
    if (screenName === 'admin' && isInTelegram) {
        window.tgApp.showAlert('Админ-панель доступна только в веб-версии');
        goBackToPreviousScreen();
        return;
    }
    
    // Haptic feedback on navigation
    window.tgApp.impactOccurred('light');
}

function goBackToPreviousScreen() {
    const previousScreenName = currentScreen.previous || 'menu';
    let targetScreen;
    
    switch (previousScreenName) {
        case 'login':
            targetScreen = loginScreen;
            break;
        case 'menu':
            targetScreen = menuScreen;
            break;
        case 'main':
            targetScreen = mainScreen;
            break;
        case 'news':
            targetScreen = newsScreen;
            break;
        case 'salary':
            targetScreen = salaryScreen;
            break;
        case 'vacation':
            targetScreen = vacationScreen;
            break;
        case 'hr':
            targetScreen = hrScreen;
            break;
        default:
            targetScreen = menuScreen;
    }
    
    showScreen(previousScreenName, targetScreen);
}

// Handle Telegram back button
if (isInTelegram) {
    window.addEventListener('telegram-back-button', () => {
        console.log('Telegram back button pressed');
        
        // Close modals first
        if (dayModal.style.display === 'block') {
            dayModal.style.display = 'none';
            return;
        }
        if (statsModal.style.display === 'block') {
            statsModal.style.display = 'none';
            return;
        }
        
        // Navigate back to previous screen
        goBackToPreviousScreen();
    });
}

// Telegram automatic authentication
async function tryTelegramAuth() {
    if (!isInTelegram || !window.tgApp) return false;
    
    try {
        console.log('Attempting Telegram authentication...');
        const initData = window.tgApp.getInitData();
        
        if (!initData) {
            console.log('No Telegram initData available');
            return false;
        }
        
        const response = await fetch(`${API_BASE_URL}/telegram/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });
        
        const result = await response.json();
        
        if (result.success && result.isLinked) {
            // Auto-login successful
            currentEmployee = result.employee;
            document.getElementById('menuEmployeeName').textContent = currentEmployee.fullName;
            document.getElementById('employeeName').textContent = currentEmployee.fullName;
            
            showScreen('menu', menuScreen);
            
            console.log('Telegram auto-login successful:', currentEmployee.fullName);
            return true;
        } else if (result.success === false && !result.isLinked) {
            // Account not linked - show linking form
            showTelegramLinkingForm(result.telegram_user);
            return true; // Handled, don't show regular login
        }
        
        return false;
    } catch (error) {
        console.error('Telegram auth error:', error);
        return false;
    }
}

// Show Telegram account linking form
function showTelegramLinkingForm(telegramUser) {
    const loginContent = document.querySelector('.login-content');
    loginContent.innerHTML = `
        <h1>Привязка аккаунта</h1>
        <p class="login-subtitle">Привет, ${telegramUser.first_name}!</p>
        <p class="login-subtitle">Введите ваш табельный номер для привязки аккаунта Telegram</p>
        
        <form id="linkingForm" class="login-form">
            <div class="form-group">
                <label for="linkEmployeeId" class="form-label">Табельный номер</label>
                <input type="text" id="linkEmployeeId" class="form-control" placeholder="Например: АП00-00358" required>
            </div>
            <button type="submit" class="btn btn--primary btn--full-width">Привязать аккаунт</button>
        </form>
        
        <div style="text-align: center; margin-top: 20px;">
            <button id="skipLinking" class="btn btn--outline">Ввести номер каждый раз</button>
        </div>
    `;
    
    // Handle account linking
    document.getElementById('linkingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await linkTelegramAccount(telegramUser);
    });
    
    // Handle skip linking
    document.getElementById('skipLinking').addEventListener('click', () => {
        showRegularLoginForm();
    });
}

// Link Telegram account with employee number
async function linkTelegramAccount(telegramUser) {
    const employeeNumber = document.getElementById('linkEmployeeId').value;
    
    try {
        const initData = window.tgApp.getInitData();
        const response = await fetch(`${API_BASE_URL}/telegram/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, employeeNumber })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Linking successful - auto login
            currentEmployee = result.employee;
            document.getElementById('menuEmployeeName').textContent = currentEmployee.fullName;
            document.getElementById('employeeName').textContent = currentEmployee.fullName;
            
            showScreen('menu', menuScreen);
            
            if (window.tgApp) {
                window.tgApp.showAlert(`Аккаунт успешно привязан! Добро пожаловать, ${currentEmployee.fullName}`);
            }
            
            console.log('Account linked and logged in:', currentEmployee.fullName);
        } else {
            if (window.tgApp) {
                window.tgApp.showAlert(result.error || 'Ошибка привязки аккаунта');
            } else {
                alert(result.error || 'Ошибка привязки аккаунта');
            }
        }
    } catch (error) {
        console.error('Account linking error:', error);
        if (window.tgApp) {
            window.tgApp.showAlert('Ошибка подключения к серверу');
        } else {
            alert('Ошибка подключения к серверу');
        }
    }
}

// Show regular login form
function showRegularLoginForm() {
    const loginContent = document.querySelector('.login-content');
    loginContent.innerHTML = `
        <h1>Учет рабочего времени</h1>
        <p class="login-subtitle">Введите ваш табельный номер</p>
        
        <form id="loginForm" class="login-form">
            <div class="form-group">
                <label for="employeeId" class="form-label">Табельный номер</label>
                <input type="text" id="employeeId" class="form-control" placeholder="Например: АП00-00358" required>
            </div>
            <button type="submit" class="btn btn--primary btn--full-width">Войти</button>
        </form>
    `;
    
    // Re-attach login handler
    document.getElementById('loginForm').addEventListener('submit', handleRegularLogin);
}

// Regular login functionality
async function handleRegularLogin(e) {
    e.preventDefault();
    
    const tableNumber = document.getElementById('employeeId').value;
    console.log('Trying to login with:', tableNumber);
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableNumber })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Ошибка входа');
            return;
        }
        
        currentEmployee = await response.json();
        console.log('Current employee:', currentEmployee);
        
        // Check if admin
        if (tableNumber === 'admin12qw') {
            // Prevent admin access in Telegram
            if (isInTelegram) {
                window.tgApp.showAlert('Админ-панель доступна только в веб-версии приложения');
                return;
            }
            
            // Switch to admin panel
            const adminScreen = document.getElementById('adminScreen');
            showScreen('admin', adminScreen);
            
            // Load admin data
            if (window.initAdminPanel) {
                window.initAdminPanel();
            }
        } else {
            // Regular employee - show menu screen
            document.getElementById('menuEmployeeName').textContent = currentEmployee.fullName;
            document.getElementById('employeeName').textContent = currentEmployee.fullName;
            
            // Switch to menu screen
            showScreen('menu', menuScreen);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Ошибка подключения к серверу: ' + error.message);
    }
}

// Initialize the application
async function initApp() {
    // Debug info for Telegram
    console.log('App initialization:', {
        isInTelegram,
        hasWindow: !!window,
        hasTgApp: !!window.tgApp,
        userAgent: navigator.userAgent,
        location: window.location.href
    });
    
    if (isInTelegram) {
        console.log('Telegram mode detected, trying authentication...');
        // Try Telegram authentication first
        const authSuccess = await tryTelegramAuth();
        if (!authSuccess) {
            console.log('Telegram auth failed, showing regular login form');
            // Fallback to regular login if auto-auth fails
            showRegularLoginForm();
        }
    } else {
        console.log('Web browser mode, setting up regular login');
        // Web browser - attach regular login handler
        document.getElementById('loginForm').addEventListener('submit', handleRegularLogin);
    }
}

// Initialize app when DOM is ready (combined with existing DOMContentLoaded)

// Updated navigation functions

// Navigation will be initialized after DOM loads

// Logout functionality for all logout buttons
function logout() {
    currentEmployee = null;
    document.getElementById('employeeId').value = '';
    showScreen('login', loginScreen);
}

// Add logout listeners
const menuLogoutBtn = document.getElementById('menuLogoutBtn');
const logoutBtn = document.getElementById('logoutBtn');

if (menuLogoutBtn) {
    menuLogoutBtn.addEventListener('click', logout);
}
if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

// Calendar navigation
document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    loadCalendarData();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    loadCalendarData();
});

// Statistics button
document.getElementById('statsBtn').addEventListener('click', async () => {
    await loadTimeEvents();
    statsModal.classList.add('active');
});

// Close stats modal
if (document.getElementById('closeStatsModal')) {
    document.getElementById('closeStatsModal').addEventListener('click', () => {
        statsModal.classList.remove('active');
    });
}

// Click outside stats modal to close
statsModal.addEventListener('click', (e) => {
    if (e.target === statsModal) {
        statsModal.classList.remove('active');
    }
});

// ESC key to close stats modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && statsModal.classList.contains('active')) {
        statsModal.classList.remove('active');
    }
});

// Modal close button
document.getElementById('closeModal').addEventListener('click', () => {
    dayModal.classList.remove('active');
});

// Click outside modal to close
dayModal.addEventListener('click', (e) => {
    if (e.target === dayModal) {
        dayModal.classList.remove('active');
    }
});

// Load calendar data
async function loadCalendarData() {
    console.log('🔧 Loading calendar data...');
    console.log('🔧 Current employee:', currentEmployee);
    
    if (!currentEmployee) {
        console.log('❌ No current employee set');
        showError('Ошибка: пользователь не авторизован');
        return;
    }
    
    const tableNumber = currentEmployee.tableNumber || currentEmployee.table_number;
    if (!tableNumber) {
        console.log('❌ No table number found for employee:', currentEmployee);
        showError('Ошибка: табельный номер не найден');
        return;
    }
    
    try {
        // Try new API first (by table number)
        let url = `${API_BASE_URL}/employee/by-number/${tableNumber}/timesheet/${currentYear}/${currentMonth + 1}`;
        console.log('🚀 FINAL v4.0 - NEW API:', url);
        
        let response = await fetch(url + '?v=' + Date.now());
        
        // If new API fails (404 or returns HTML), fallback to old API
        if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
            console.log('⚠️ New API not available, falling back to old API');
            
            // Use old API with employee ID
            if (currentEmployee.id) {
                url = `${API_BASE_URL}/employee/${currentEmployee.id}/timesheet/${currentYear}/${currentMonth + 1}`;
                console.log('🔧 Trying old API:', url);
                response = await fetch(url + '?v=' + Date.now());
            }
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Calendar API error:', response.status, errorText);
            throw new Error(`Failed to load calendar data: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Calendar data:', data);
        calendarData = data.calendar;
        
        // Update month display
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        document.getElementById('currentMonth').textContent = 
            `${monthNames[currentMonth]} ${currentYear}`;
        
        // Render calendar
        renderCalendar();
    } catch (error) {
        console.error('Error loading calendar:', error);
        if (isInTelegram && window.tgApp) {
            window.tgApp.showAlert(`Ошибка загрузки календаря: ${error.message}`);
        } else {
            alert(`Ошибка загрузки календаря: ${error.message}`);
        }
    }
}

// Render calendar
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        header.style.fontWeight = 'bold';
        header.style.textAlign = 'center';
        header.style.padding = '10px 0';
        calendar.appendChild(header);
    });
    
    // Get first day of month (0 = Sunday, adjust to Monday start)
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const startPadding = firstDay === 0 ? 6 : firstDay - 1;
    
    // Add empty cells for padding
    for (let i = 0; i < startPadding; i++) {
        calendar.appendChild(document.createElement('div'));
    }
    
    // Add days
    calendarData.forEach(day => {
        const dayElement = document.createElement('div');
        // Convert underscores to dashes for CSS class names
        const cssStatus = day.status.replace(/_/g, '-');
        dayElement.className = `calendar-day calendar-day--${cssStatus}`;
        dayElement.innerHTML = `
            <div class="day-number">${day.day}</div>
            <div class="day-status">${getStatusText(day.status)}</div>
        `;
        
        dayElement.addEventListener('click', () => showDayDetails(day));
        calendar.appendChild(dayElement);
    });
}

// Get status text
function getStatusText(status) {
    const statusMap = {
        'on_time': 'Вовремя',
        'late': 'Опоздание',
        'absent': 'Отсутствие',
        'weekend': 'Выходной',
        'early_leave': 'Ранний уход',
        'no_exit': 'Нет выхода'
    };
    return statusMap[status] || '';
}

// Show day details in modal
function showDayDetails(day) {
    const monthNames = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    
    document.getElementById('modalDate').textContent = 
        `${day.day} ${monthNames[currentMonth]} ${currentYear}`;
    
    // Format times
    const formatTime = (datetime) => {
        if (!datetime) return '--';
        const time = datetime.split(' ')[1];
        return time ? time.substring(0, 5) : '--';
    };
    
    document.getElementById('arrivalTime').textContent = formatTime(day.checkIn);
    document.getElementById('departureTime').textContent = formatTime(day.checkOut);
    
    // Format hours worked
    const hoursWorked = day.hoursWorked ? `${day.hoursWorked.toFixed(1)} ч` : '--';
    document.getElementById('workedHours').textContent = hoursWorked;
    
    // Set status
    const statusElement = document.getElementById('dayStatus');
    statusElement.textContent = getStatusText(day.status);
    statusElement.className = `detail-value status status--${day.status}`;
    
    dayModal.classList.add('active');
}

// Load time events for the last 2 months
async function loadTimeEvents() {
    if (!currentEmployee) return;
    
    try {
        // Use table_number instead of ID for API calls
        const url = `${API_BASE_URL}/employee/by-number/${currentEmployee.tableNumber || currentEmployee.table_number}/time-events`;
        console.log('Loading time events for employee:', currentEmployee);
        console.log('Fetching time events URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Time events API error:', response.status, errorText);
            throw new Error(`Failed to load time events: ${response.status} - ${errorText}`);
        }
        
        timeEventsData = await response.json();
        
        // Update period display
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            const monthNames = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        };
        
        document.getElementById('eventsPeriod').textContent = 
            `${formatDate(timeEventsData.period.dateFrom)} - ${formatDate(timeEventsData.period.dateTo)}`;
        
        // Render events table
        renderTimeEvents();
    } catch (error) {
        console.error('Error loading time events:', error);
        if (isInTelegram && window.tgApp) {
            window.tgApp.showAlert(`Ошибка загрузки входов/выходов: ${error.message}`);
        } else {
            alert(`Ошибка загрузки входов/выходов: ${error.message}`);
        }
    }
}

// Render time events table
function renderTimeEvents() {
    const eventsTableBody = document.getElementById('eventsTableBody');
    eventsTableBody.innerHTML = '';
    
    if (!timeEventsData || !timeEventsData.events || timeEventsData.events.length === 0) {
        eventsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Нет данных за выбранный период</td></tr>';
        return;
    }
    
    timeEventsData.events.forEach(event => {
        const date = new Date(event.date);
        const monthNames = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        const weekDays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        
        const formatTime = (datetime) => {
            if (!datetime) return '--:--';
            const time = datetime.split(' ')[1] || datetime.split('T')[1];
            return time ? time.substring(0, 5) : '--:--';
        };
        
        const row = document.createElement('tr');
        if (date.getDay() === 0 || date.getDay() === 6) {
            row.style.backgroundColor = '#f8f9fa';
        }
        
        // Convert underscores to dashes for CSS class
        const cssStatus = event.status ? event.status.replace(/_/g, '-') : '';
        
        row.innerHTML = `
            <td>${date.getDate()} ${monthNames[date.getMonth()]} (${weekDays[date.getDay()]})</td>
            <td>${formatTime(event.firstEntry)}</td>
            <td>${formatTime(event.lastExit)}</td>
            <td>${event.hoursWorked ? event.hoursWorked + ' ч' : '--'}</td>
            <td>
                <span class="detail-status status--${cssStatus}">
                    ${getStatusText(event.status)}
                </span>
            </td>
        `;
        
        eventsTableBody.appendChild(row);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Set up all modals to close on outside click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Re-initialize navigation after DOM is loaded
    initializeNavigation();
    
    // Initialize the application (Telegram auth or regular login)
    await initApp();
});

// Initialize navigation handlers
function initializeNavigation() {
    // Menu navigation
    document.querySelectorAll('.menu-card').forEach(card => {
        card.addEventListener('click', async () => {
            const section = card.dataset.section;
            
            // Haptic feedback for Telegram
            if (isInTelegram) {
                window.tgApp.impactOccurred('light');
            }
            
            switch(section) {
                case 'news':
                    showScreen('news', newsScreen);
                    break;
                case 'attendance':
                    showScreen('main', mainScreen);
                    await loadCalendarData();
                    break;
                case 'salary':
                    showScreen('salary', salaryScreen);
                    break;
                case 'vacation':
                    showScreen('vacation', vacationScreen);
                    break;
                case 'hr':
                    showScreen('hr', hrScreen);
                    break;
            }
        });
    });

    // Back navigation (only for web browser)
    if (!isInTelegram) {
        document.querySelectorAll('.btn-back, .breadcrumb-item').forEach(btn => {
            if (btn.dataset.back) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = btn.dataset.back;
                    if (target === 'menu') {
                        showScreen('menu', menuScreen);
                    }
                });
            }
        });
    }
}