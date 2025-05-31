// API configuration
const API_BASE_URL = 'http://localhost:3030/api';
window.API_BASE_URL = API_BASE_URL; // Export for admin.js

// State management
let currentEmployee = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let calendarData = [];
let timeEventsData = null;

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

// Login functionality
document.getElementById('loginForm').addEventListener('submit', async (e) => {
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
            // Switch to admin panel
            loginScreen.classList.remove('active');
            loginScreen.style.display = 'none';
            
            const adminScreen = document.getElementById('adminScreen');
            adminScreen.classList.add('active');
            adminScreen.style.display = 'block';
            
            // Load admin data
            if (window.initAdminPanel) {
                window.initAdminPanel();
            }
        } else {
            // Regular employee - show menu screen
            document.getElementById('menuEmployeeName').textContent = currentEmployee.fullName;
            document.getElementById('employeeName').textContent = currentEmployee.fullName;
            
            // Switch to menu screen
            loginScreen.classList.remove('active');
            loginScreen.style.display = 'none';
            menuScreen.classList.add('active');
            menuScreen.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Ошибка подключения к серверу: ' + error.message);
    }
});

// Navigation functions
function showScreen(screenId) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    // Show requested screen
    const targetScreen = document.getElementById(screenId + 'Screen');
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'block';
    }
}

// Navigation will be initialized after DOM loads

// Logout functionality for all logout buttons
function logout() {
    currentEmployee = null;
    document.getElementById('employeeId').value = '';
    showScreen('login');
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
    console.log('Loading calendar data...');
    if (!currentEmployee) {
        console.log('No current employee');
        return;
    }
    
    try {
        const url = `${API_BASE_URL}/employee/${currentEmployee.id}/timesheet/${currentYear}/${currentMonth + 1}`;
        console.log('Fetching:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to load calendar data');
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
        alert('Ошибка загрузки данных календаря');
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
        const response = await fetch(
            `${API_BASE_URL}/employee/${currentEmployee.id}/time-events`
        );
        
        if (!response.ok) {
            throw new Error('Failed to load time events');
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
        alert('Ошибка загрузки данных входов/выходов');
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
        
        row.innerHTML = `
            <td>${date.getDate()} ${monthNames[date.getMonth()]} (${weekDays[date.getDay()]})</td>
            <td>${formatTime(event.firstEntry)}</td>
            <td>${formatTime(event.lastExit)}</td>
            <td>${event.hoursWorked ? event.hoursWorked + ' ч' : '--'}</td>
            <td>
                <span class="detail-status status--${event.status}">
                    ${getStatusText(event.status)}
                </span>
            </td>
        `;
        
        eventsTableBody.appendChild(row);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
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
});

// Initialize navigation handlers
function initializeNavigation() {
    // Menu navigation
    document.querySelectorAll('.menu-card').forEach(card => {
        card.addEventListener('click', async () => {
            const section = card.dataset.section;
            
            switch(section) {
                case 'news':
                    showScreen('news');
                    break;
                case 'attendance':
                    showScreen('main');
                    await loadCalendarData();
                    break;
                case 'salary':
                    showScreen('salary');
                    break;
                case 'vacation':
                    showScreen('vacation');
                    break;
                case 'hr':
                    showScreen('hr');
                    break;
            }
        });
    });

    // Back navigation
    document.querySelectorAll('.btn-back, .breadcrumb-item').forEach(btn => {
        if (btn.dataset.back) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const target = btn.dataset.back;
                if (target === 'menu') {
                    showScreen('menu');
                }
            });
        }
    });
}