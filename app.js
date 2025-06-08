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
let newsData = [];
let newsPage = 1;
let isLoadingNews = false;
let hasMoreNews = true;
let currentNewsId = null;

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
const departmentStatsScreen = document.getElementById('departmentStatsScreen');
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
        case 'departmentStats':
            targetScreen = departmentStatsScreen;
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

// Statistics button - now opens department stats screen
document.getElementById('statsBtn').addEventListener('click', async () => {
    // Navigate to department stats screen
    const departmentStatsScreen = document.getElementById('departmentStatsScreen');
    showScreen('departmentStats', departmentStatsScreen);
    
    // Load department statistics
    await loadDepartmentStats();
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
        // Load employee schedule first
        const scheduleUrl = `${API_BASE_URL}/employee/by-number/${tableNumber}/schedule/${currentYear}/${currentMonth + 1}`;
        console.log('📅 Loading employee schedule:', scheduleUrl);
        
        const scheduleResponse = await fetch(scheduleUrl + '?v=' + Date.now());
        let employeeSchedule = null;
        
        if (scheduleResponse.ok) {
            const scheduleData = await scheduleResponse.json();
            if (scheduleData.hasSchedule) {
                employeeSchedule = scheduleData;
                console.log('✅ Employee schedule loaded:', scheduleData.schedule.name);
            } else {
                console.log('ℹ️ Employee has no assigned schedule');
            }
        } else {
            console.log('⚠️ Failed to load employee schedule');
        }
        
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
        
        // Merge schedule data with calendar data
        if (employeeSchedule && employeeSchedule.workDays) {
            const scheduleMap = {};
            employeeSchedule.workDays.forEach(day => {
                const dateStr = day.date.split('T')[0];
                scheduleMap[dateStr] = day;
            });
            
            calendarData.forEach(day => {
                const scheduleDay = scheduleMap[day.date];
                if (scheduleDay) {
                    day.scheduleStartTime = scheduleDay.startTime;
                    day.scheduleEndTime = scheduleDay.endTime;
                    day.scheduleHours = scheduleDay.workHours;
                    day.isScheduledWorkDay = scheduleDay.isWorkDay;
                }
            });
        }
        
        // Update month display with schedule info
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        let monthTitle = `${monthNames[currentMonth]} ${currentYear}`;
        
        if (employeeSchedule && employeeSchedule.hasSchedule) {
            document.getElementById('currentMonth').innerHTML = 
                `${monthTitle}<br><small style="font-size: 0.8em; color: #666;">График: ${employeeSchedule.schedule.name}</small>`;
        } else {
            document.getElementById('currentMonth').textContent = monthTitle;
        }
        
        // Store schedule for later use
        window.currentEmployeeSchedule = employeeSchedule;
        
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
        
        // Build day content with schedule info if available
        let dayContent = `<div class="day-number">${day.day}</div>`;
        
        // Show schedule time if available (for work days with schedule, not weekends)
        if (day.scheduleStartTime && day.scheduleEndTime && day.status !== 'weekend') {
            // Format schedule time
            const formatTime = (time) => time ? time.substring(0, 5) : '';
            dayContent += `
                <div class="day-schedule" style="font-size: 0.7em; color: #666; margin-top: 2px;">
                    ${formatTime(day.scheduleStartTime)}-${formatTime(day.scheduleEndTime)}
                </div>
            `;
        }
        
        dayContent += `<div class="day-status">${getStatusText(day.status)}</div>`;
        
        dayElement.innerHTML = dayContent;
        
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
    console.log('Opening modal for day:', day);
    
    const monthNames = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    
    // Set modal title
    document.getElementById('modalDate').textContent = 
        `${day.day} ${monthNames[currentMonth]} ${currentYear}`;
    
    // Format times
    const formatTime = (datetime) => {
        if (!datetime) return '--';
        try {
            // Handle both ISO format (2025-05-02T02:57:55.000Z) and SQL format (2025-05-02 02:57:55)
            const date = new Date(datetime);
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'Asia/Almaty'
            });
        } catch (error) {
            console.error('Error formatting time:', datetime, error);
            return '--';
        }
    };
    
    // Field 1: Status
    const statusElement = document.getElementById('dayStatus');
    statusElement.textContent = getStatusText(day.status);
    statusElement.className = `detail-value status status--${day.status.replace(/_/g, '-')}`;
    
    // Check if there's schedule data
    const hasSchedule = day.scheduleStartTime && day.scheduleEndTime;
    const hasActualData = day.checkIn || day.checkOut;
    const isWeekend = day.status === 'weekend';
    
    // Field 2: Planned time
    let plannedTime;
    if (isWeekend) {
        // For weekends, don't show planned time
        plannedTime = '--';
    } else if (hasSchedule) {
        plannedTime = `${formatTime('2025-01-01 ' + day.scheduleStartTime)} - ${formatTime('2025-01-01 ' + day.scheduleEndTime)}`;
    } else if (hasActualData) {
        plannedTime = 'Нет графика';
    } else {
        plannedTime = '--';
    }
    document.getElementById('plannedTime').textContent = plannedTime;
    
    // Field 3: Planned hours
    let plannedHours;
    if (isWeekend) {
        // For weekends, don't show planned hours
        plannedHours = '--';
    } else if (day.scheduleHours) {
        plannedHours = `${day.scheduleHours} ч`;
    } else if (hasActualData) {
        plannedHours = 'Нет графика';
    } else {
        plannedHours = '--';
    }
    document.getElementById('plannedHours').textContent = plannedHours;
    
    // Field 4: Actual arrival
    document.getElementById('actualArrival').textContent = formatTime(day.checkIn);
    
    // Field 5: Actual departure
    document.getElementById('actualDeparture').textContent = formatTime(day.checkOut);
    
    // Hide/show planned section based on data availability
    const plannedSection = document.querySelector('.detail-section:first-of-type');
    if (plannedSection) {
        if ((!hasSchedule && !hasActualData) || isWeekend) {
            plannedSection.style.display = 'none';
        } else {
            plannedSection.style.display = 'block';
        }
    }
    
    // Open modal
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

// Load department statistics
async function loadDepartmentStats() {
    console.log('Loading department statistics...');
    
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
    
    // Show loading
    const loadingElement = document.getElementById('departmentStatsLoading');
    const tableContainer = document.querySelector('.department-stats-table-container');
    loadingElement.style.display = 'block';
    tableContainer.style.display = 'none';
    
    try {
        // Get current month and year
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        
        // Update month display
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        document.getElementById('currentMonthName').textContent = `${monthNames[month - 1]} ${year}`;
        
        // Load department stats
        const url = `${API_BASE_URL}/employee/by-number/${tableNumber}/department-stats/${year}/${month}`;
        console.log('Loading department stats from:', url);
        
        const response = await fetch(url + '?v=' + Date.now());
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Department stats API error:', response.status, errorText);
            throw new Error(`Failed to load department stats: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Department stats data:', data);
        
        // Update department name
        document.getElementById('departmentName').textContent = data.departmentName || 'Подразделение';
        
        // Render department stats table
        renderDepartmentStatsTable(data.data);
        
        // Hide loading and show table
        loadingElement.style.display = 'none';
        tableContainer.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading department stats:', error);
        loadingElement.style.display = 'none';
        
        if (isInTelegram && window.tgApp) {
            window.tgApp.showAlert(`Ошибка загрузки статистики: ${error.message}`);
        } else {
            alert(`Ошибка загрузки статистики: ${error.message}`);
        }
    }
}

// Render department statistics table
function renderDepartmentStatsTable(data) {
    const tableBody = document.getElementById('departmentStatsTableBody');
    tableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Нет данных за выбранный период</td></tr>';
        return;
    }
    
    // Format time function
    const formatTime = (datetime) => {
        if (!datetime) return '--:--';
        try {
            const date = new Date(datetime);
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'Asia/Almaty'
            });
        } catch (error) {
            console.error('Error formatting time:', datetime, error);
            return '--:--';
        }
    };
    
    // Format date function
    const formatDate = (dateStr) => {
        try {
            const date = new Date(dateStr);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const weekDays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            const weekDay = weekDays[date.getDay()];
            return `${day}.${month} (${weekDay})`;
        } catch (error) {
            return dateStr;
        }
    };
    
    // Get status text and CSS class
    const getStatusInfo = (status) => {
        const statusMap = {
            'on_time': { text: 'Вовремя', class: 'on-time' },
            'late': { text: 'Опоздание', class: 'late' },
            'absent': { text: 'Отсутствие', class: 'absent' },
            'weekend': { text: 'Выходной', class: 'weekend' },
            'weekend_worked': { text: 'Работа в выходной', class: 'weekend-worked' },
            'no_schedule_worked': { text: 'Без графика', class: 'no-schedule' },
            'early_leave': { text: 'Ранний уход', class: 'early-leave' },
            'no_exit': { text: 'Нет выхода', class: 'no-exit' }
        };
        return statusMap[status] || { text: status, class: 'unknown' };
    };
    
    // Group data by date for better display
    const groupedData = {};
    data.forEach(row => {
        if (!groupedData[row.date]) {
            groupedData[row.date] = [];
        }
        groupedData[row.date].push(row);
    });
    
    // Render grouped data
    Object.keys(groupedData).sort().forEach(date => {
        const dayData = groupedData[date];
        
        dayData.forEach((row, index) => {
            const tr = document.createElement('tr');
            
            // Add weekend styling
            if (row.isWeekend || row.status === 'weekend' || row.status === 'weekend_worked') {
                tr.classList.add('weekend-row');
            }
            
            const statusInfo = getStatusInfo(row.status);
            
            tr.innerHTML = `
                <td class="date-cell">${index === 0 ? formatDate(date) : ''}</td>
                <td class="employee-name">${row.employeeName}</td>
                <td class="time-cell">${row.scheduleStartTime ? formatTime('2000-01-01T' + row.scheduleStartTime) : '--:--'}</td>
                <td class="time-cell">${row.scheduleEndTime ? formatTime('2000-01-01T' + row.scheduleEndTime) : '--:--'}</td>
                <td class="time-cell">${formatTime(row.actualStartTime)}</td>
                <td class="time-cell">${formatTime(row.actualEndTime)}</td>
                <td><span class="detail-status status--${statusInfo.class}">${statusInfo.text}</span></td>
            `;
            
            tableBody.appendChild(tr);
        });
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
    
    // Setup news scroll handler
    setupNewsScroll();
    
    // Initialize the application (Telegram auth or regular login)
    await initApp();
});

// News functions
async function loadNews(reset = false) {
    if (isLoadingNews || (!hasMoreNews && !reset)) return;
    
    if (reset) {
        newsPage = 1;
        newsData = [];
        hasMoreNews = true;
        const newsContainer = document.querySelector('.news-container');
        newsContainer.innerHTML = '<div class="news-loading">Загрузка новостей...</div>';
    }
    
    isLoadingNews = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/news?page=${newsPage}&limit=10`);
        
        if (!response.ok) {
            throw new Error('Failed to load news');
        }
        
        const data = await response.json();
        console.log('Loaded news:', data);
        
        if (data.news.length === 0 && newsPage === 1) {
            renderEmptyNews();
        } else {
            newsData = newsData.concat(data.news);
            hasMoreNews = data.pagination.page < data.pagination.pages;
            renderNews();
            newsPage++;
        }
    } catch (error) {
        console.error('Error loading news:', error);
        if (newsPage === 1) {
            renderNewsError();
        }
    } finally {
        isLoadingNews = false;
    }
}

function renderNews() {
    const newsContainer = document.querySelector('.news-container');
    
    // Clear loading message if it's the first page
    if (newsPage === 1) {
        newsContainer.innerHTML = '';
    }
    
    // Remove existing loading indicator
    const existingLoader = newsContainer.querySelector('.news-loading');
    if (existingLoader) {
        existingLoader.remove();
    }
    
    newsData.forEach(news => {
        const newsItem = document.createElement('div');
        newsItem.className = 'news-item';
        newsItem.dataset.newsId = news.id;
        
        // Format date
        const date = new Date(news.created_at);
        const monthNames = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        const dateStr = `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        
        // Truncate description for preview (150 characters)
        const preview = news.description.length > 150 
            ? news.description.substring(0, 150) + '...' 
            : news.description;
        
        newsItem.innerHTML = `
            ${news.image_url ? `<img src="${news.image_url}" alt="${news.title}" class="news-image">` : ''}
            <div class="news-date">${dateStr}</div>
            <h3 class="news-title">${news.title}</h3>
            <p class="news-content">${preview}</p>
            <button class="btn btn--outline btn--sm news-read-more" data-id="${news.id}">Читать далее</button>
        `;
        
        newsContainer.appendChild(newsItem);
    });
    
    // Add load more indicator if there are more news
    if (hasMoreNews) {
        const loadMoreDiv = document.createElement('div');
        loadMoreDiv.className = 'news-loading';
        loadMoreDiv.innerHTML = '<p>Загрузка...</p>';
        newsContainer.appendChild(loadMoreDiv);
    }
    
    // Attach event listeners to "Read more" buttons
    document.querySelectorAll('.news-read-more').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newsId = e.target.dataset.id;
            showFullNews(newsId);
        });
    });
}

function renderEmptyNews() {
    const newsContainer = document.querySelector('.news-container');
    newsContainer.innerHTML = `
        <div class="placeholder-message">
            <p>📰 Новостей пока нет</p>
            <p>Здесь будут отображаться корпоративные новости и объявления</p>
        </div>
    `;
}

function renderNewsError() {
    const newsContainer = document.querySelector('.news-container');
    newsContainer.innerHTML = `
        <div class="placeholder-message">
            <p>⚠️ Ошибка загрузки новостей</p>
            <p>Пожалуйста, попробуйте позже</p>
        </div>
    `;
}

async function showFullNews(newsId) {
    currentNewsId = newsId;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/news/${newsId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load news details');
        }
        
        const news = await response.json();
        
        // Format date
        const date = new Date(news.created_at);
        const monthNames = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        const dateStr = `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        
        // Create full news view
        const newsScreen = document.getElementById('newsScreen');
        const originalContent = newsScreen.innerHTML;
        
        newsScreen.innerHTML = `
            <header class="app-header">
                <button class="btn-header btn-back" id="backToNewsList">← Назад</button>
                <h2>Новость</h2>
                <div></div>
            </header>
            
            <div class="container">
                <nav class="breadcrumb">
                    <a href="#" class="breadcrumb-item" data-back="menu">Главное меню</a>
                    <span class="breadcrumb-separator">/</span>
                    <a href="#" class="breadcrumb-item" id="backToNewsListBreadcrumb">Новости компании</a>
                    <span class="breadcrumb-separator">/</span>
                    <span class="breadcrumb-item active">Просмотр новости</span>
                </nav>
                
                <div class="news-full">
                    ${news.image_url ? `<img src="${news.image_url}" alt="${news.title}" class="news-full-image">` : ''}
                    <div class="news-meta">
                        <span class="news-date">${dateStr}</span>
                        <span class="news-author">Автор: ${news.author}</span>
                    </div>
                    <h1 class="news-full-title">${news.title}</h1>
                    <div class="news-full-content">${news.description.replace(/\n/g, '<br>')}</div>
                </div>
            </div>
        `;
        
        // Add back button handlers
        const backToNewsList = () => {
            currentNewsId = null;  // Reset currentNewsId when going back
            newsScreen.innerHTML = originalContent;
            initializeNavigation();
            loadNews(false);
        };
        
        document.getElementById('backToNewsList').addEventListener('click', backToNewsList);
        document.getElementById('backToNewsListBreadcrumb').addEventListener('click', (e) => {
            e.preventDefault();
            backToNewsList();
        });
        
        // Handle breadcrumb back to menu
        document.querySelector('[data-back="menu"]').addEventListener('click', (e) => {
            e.preventDefault();
            currentNewsId = null;  // Reset currentNewsId when going back
            newsScreen.innerHTML = originalContent;
            initializeNavigation();
            showScreen('menu', menuScreen);
        });
        
    } catch (error) {
        console.error('Error loading news details:', error);
        if (isInTelegram && window.tgApp) {
            window.tgApp.showAlert('Ошибка загрузки новости');
        } else {
            alert('Ошибка загрузки новости');
        }
    }
}

// Handle infinite scroll for news
function setupNewsScroll() {
    const newsScreen = document.getElementById('newsScreen');
    
    newsScreen.addEventListener('scroll', () => {
        // Check if we're on the news list (not full news view)
        if (currentNewsId !== null) return;
        
        const scrollTop = newsScreen.scrollTop;
        const scrollHeight = newsScreen.scrollHeight;
        const clientHeight = newsScreen.clientHeight;
        
        // Load more when user is near the bottom (within 200px)
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            loadNews(false);
        }
    });
}

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
                    await loadNews(true);
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
                case 'departmentStats':
                    showScreen('departmentStats', departmentStatsScreen);
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
                    } else if (target === 'main') {
                        showScreen('main', mainScreen);
                    }
                });
            }
        });
    }
}