// API configuration
const API_BASE_URL = 'http://localhost:3030/api';

// State management
let currentEmployee = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let calendarData = [];
let statisticsData = null;

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const statsScreen = document.getElementById('statsScreen');
const dayModal = document.getElementById('dayModal');

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
        document.getElementById('employeeName').textContent = currentEmployee.fullName;
        
        // Switch to main screen
        console.log('Switching screens...');
        console.log('Login screen classes before:', loginScreen.className);
        console.log('Main screen classes before:', mainScreen.className);
        
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
        
        console.log('Login screen classes after:', loginScreen.className);
        console.log('Main screen classes after:', mainScreen.className);
        
        // Force display style as backup
        loginScreen.style.display = 'none';
        mainScreen.style.display = 'block';
        
        // Load calendar data
        await loadCalendarData();
    } catch (error) {
        console.error('Login error:', error);
        alert('Ошибка подключения к серверу: ' + error.message);
    }
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    currentEmployee = null;
    document.getElementById('employeeId').value = '';
    mainScreen.classList.remove('active');
    statsScreen.classList.remove('active');
    loginScreen.classList.add('active');
});

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
    mainScreen.classList.remove('active');
    statsScreen.classList.add('active');
    await loadStatistics();
});

// Back to calendar button
document.getElementById('backToCalendar').addEventListener('click', () => {
    statsScreen.classList.remove('active');
    mainScreen.classList.add('active');
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
        dayElement.className = `calendar-day calendar-day--${day.status}`;
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
        'early_leave': 'Ранний уход'
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

// Load statistics
async function loadStatistics() {
    if (!currentEmployee) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/employee/${currentEmployee.id}/statistics/${currentYear}/${currentMonth + 1}`
        );
        
        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }
        
        statisticsData = await response.json();
        
        // Update period display
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        document.getElementById('statsPeriod').textContent = 
            `${monthNames[currentMonth]} ${currentYear}`;
        
        // Update statistics
        const stats = statisticsData.statistics;
        document.getElementById('totalHours').textContent = stats.totalHours;
        document.getElementById('workDays').textContent = stats.workDays;
        document.getElementById('lateCount').textContent = stats.lateCount;
        document.getElementById('earlyLeaves').textContent = stats.earlyLeaves;
        
        // Render detailed list
        renderDetailedStatistics();
    } catch (error) {
        console.error('Error loading statistics:', error);
        alert('Ошибка загрузки статистики');
    }
}

// Render detailed statistics
function renderDetailedStatistics() {
    const detailedList = document.getElementById('detailedList');
    detailedList.innerHTML = '';
    
    if (!statisticsData || !statisticsData.detailedRecords) return;
    
    statisticsData.detailedRecords.forEach(record => {
        const date = new Date(record.date);
        const monthNames = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        
        const formatTime = (datetime) => {
            if (!datetime) return '--:--';
            const time = datetime.split(' ')[1];
            return time ? time.substring(0, 5) : '--:--';
        };
        
        const item = document.createElement('div');
        item.className = 'detail-item';
        item.innerHTML = `
            <div class="detail-date">${date.getDate()} ${monthNames[date.getMonth()]}</div>
            <div class="detail-info">
                <div class="detail-time">
                    ${formatTime(record.checkIn)} - ${formatTime(record.checkOut)}
                </div>
                <div class="detail-time">
                    ${record.hoursWorked ? record.hoursWorked.toFixed(1) + ' ч' : '--'}
                </div>
                <div class="detail-status status--${record.status}">
                    ${getStatusText(record.status)}
                </div>
            </div>
        `;
        
        detailedList.appendChild(item);
    });
}