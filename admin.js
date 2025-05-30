// Admin Panel JavaScript

// Use API_BASE_URL from app.js if available, otherwise define it
const ADMIN_API_BASE_URL = window.API_BASE_URL || 'http://localhost:3030/api';

// DOM elements
const adminScreen = document.getElementById('adminScreen');
let menuItems = [];
let contentSections = [];

// Current data
let employeesData = [];
let departmentsData = [];
let positionsData = [];

// Store event handlers to avoid duplicates
let menuClickHandler = null;
let logoutHandler = null;

// Initialize admin panel
function initAdminPanel() {
    // Get DOM elements after admin screen is shown
    menuItems = document.querySelectorAll('.menu-item');
    contentSections = document.querySelectorAll('.content-section');
    
    console.log('Menu items found:', menuItems.length);
    console.log('Content sections found:', contentSections.length);
    
    // Create click handler
    menuClickHandler = (e) => {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        console.log('Menu clicked, switching to section:', section);
        switchSection(section);
    };
    
    // Menu navigation - remove old listeners and add new ones
    menuItems.forEach(item => {
        // Remove any existing listeners
        item.removeEventListener('click', menuClickHandler);
        // Add new listener
        item.addEventListener('click', menuClickHandler);
    });

    // Logout button
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutHandler = () => {
            adminScreen.classList.remove('active');
            adminScreen.style.display = 'none';
            document.getElementById('loginScreen').classList.add('active');
            document.getElementById('loginScreen').style.display = 'block';
            document.getElementById('employeeId').value = '';
        };
        
        logoutBtn.removeEventListener('click', logoutHandler);
        logoutBtn.addEventListener('click', logoutHandler);
    }

    // Search inputs
    initSearchInputs();
}

// Switch between sections
function switchSection(sectionName) {
    // Update menu
    menuItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionName);
    });

    // Update content
    contentSections.forEach(section => {
        const isActive = section.id === `${sectionName}-section`;
        section.classList.toggle('active', isActive);
        // Добавляем display style как fallback
        section.style.display = isActive ? 'block' : 'none';
    });

    // Load data for the section
    switch (sectionName) {
        case 'employees':
            loadEmployees();
            break;
        case 'departments':
            loadDepartments();
            break;
        case 'positions':
            loadPositions();
            break;
        case 'time-events':
            initTimeEventsSection();
            break;
        case 'time-records':
            initTimeRecordsSection();
            break;
        case 'upload':
            initUploadSection();
            break;
    }
}

// Initialize search inputs
function initSearchInputs() {
    document.getElementById('employees-search').addEventListener('input', (e) => {
        filterEmployees(e.target.value);
    });

    document.getElementById('departments-search').addEventListener('input', (e) => {
        filterDepartments(e.target.value);
    });

    document.getElementById('positions-search').addEventListener('input', (e) => {
        filterPositions(e.target.value);
    });
}

// Load employees
async function loadEmployees() {
    console.log('loadEmployees called');
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) {
        console.error('employees-tbody not found!');
        return;
    }
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка данных...</td></tr>';

    try {
        console.log('Fetching employees from:', `${ADMIN_API_BASE_URL}/admin/employees`);
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/employees`);
        if (!response.ok) throw new Error('Failed to load employees');

        employeesData = await response.json();
        console.log('Loaded employees:', employeesData.length);
        displayEmployees(employeesData);
        document.getElementById('employees-total').textContent = employeesData.length;
    } catch (error) {
        console.error('Error loading employees:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display employees
function displayEmployees(employees) {
    const tbody = document.getElementById('employees-tbody');
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = employees.map(emp => `
        <tr>
            <td>${emp.table_number}</td>
            <td>${emp.full_name}</td>
            <td>${emp.department_name || '-'}</td>
            <td>${emp.position_name || '-'}</td>
            <td><span class="status-badge ${emp.status === 1 ? 'active' : 'inactive'}">${emp.status === 1 ? 'Активен' : 'Неактивен'}</span></td>
        </tr>
    `).join('');
}

// Filter employees
function filterEmployees(searchTerm) {
    const filtered = employeesData.filter(emp => 
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.table_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
    displayEmployees(filtered);
    document.getElementById('employees-total').textContent = filtered.length;
}

// Load departments
async function loadDepartments() {
    const tbody = document.getElementById('departments-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Загрузка данных</td></tr>';

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        if (!response.ok) throw new Error('Failed to load departments');

        departmentsData = await response.json();
        displayDepartments(departmentsData);
        document.getElementById('departments-total').textContent = departmentsData.length;
    } catch (error) {
        console.error('Error loading departments:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display departments
function displayDepartments(departments) {
    const tbody = document.getElementById('departments-tbody');
    
    if (departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = departments.map(dept => `
        <tr>
            <td>${dept.object_code}</td>
            <td>${dept.object_name}</td>
            <td>${dept.object_company || '-'}</td>
            <td>${dept.object_bin || '-'}</td>
        </tr>
    `).join('');
}

// Filter departments
function filterDepartments(searchTerm) {
    const filtered = departmentsData.filter(dept => 
        dept.object_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.object_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    displayDepartments(filtered);
    document.getElementById('departments-total').textContent = filtered.length;
}

// Load positions
async function loadPositions() {
    const tbody = document.getElementById('positions-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="loading">Загрузка данных</td></tr>';

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/positions`);
        if (!response.ok) throw new Error('Failed to load positions');

        positionsData = await response.json();
        displayPositions(positionsData);
        document.getElementById('positions-total').textContent = positionsData.length;
    } catch (error) {
        console.error('Error loading positions:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display positions
function displayPositions(positions) {
    const tbody = document.getElementById('positions-tbody');
    
    if (positions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = positions.map(pos => `
        <tr>
            <td>${pos.staff_position_code}</td>
            <td>${pos.staff_position_name}</td>
            <td>${pos.object_bin || '-'}</td>
        </tr>
    `).join('');
}

// Filter positions
function filterPositions(searchTerm) {
    const filtered = positionsData.filter(pos => 
        pos.staff_position_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.staff_position_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    displayPositions(filtered);
    document.getElementById('positions-total').textContent = filtered.length;
}

// Initialize when DOM is ready
// Закомментируем автоматическую инициализацию, так как она вызывается из loadAdminPanel
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', initAdminPanel);
// } else {
//     initAdminPanel();
// }

// Export for use in app.js
window.loadAdminPanel = function() {
    console.log('loadAdminPanel called');
    // Перезагружаем DOM элементы
    menuItems = document.querySelectorAll('.menu-item');
    contentSections = document.querySelectorAll('.content-section');
    console.log('Found menu items:', menuItems.length);
    console.log('Found content sections:', contentSections.length);
    
    // Переинициализируем обработчики
    initAdminPanel();
    
    // Загружаем первую секцию
    switchSection('employees');
};

// Initialize upload section
function initUploadSection() {
    // Load organizations for dropdown
    loadOrganizations();
    
    // Sync buttons
    document.getElementById('sync-employees').addEventListener('click', () => syncData('employees'));
    document.getElementById('sync-departments').addEventListener('click', () => syncData('departments'));
    document.getElementById('sync-positions').addEventListener('click', () => syncData('positions'));
    
    // Timesheet upload form
    document.getElementById('timesheet-upload-form').addEventListener('submit', handleTimesheetUpload);
    
    // Set default dates (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('upload-date-from').value = firstDay.toISOString().split('T')[0];
    document.getElementById('upload-date-to').value = lastDay.toISOString().split('T')[0];
}

// Load organizations for dropdown
async function loadOrganizations() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error('Failed to load organizations');
        
        const organizations = await response.json();
        const select = document.getElementById('upload-org');
        
        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.object_bin;
            option.textContent = org.object_company;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading organizations:', error);
    }
}

// Sync data function
async function syncData(type) {
    const button = document.getElementById(`sync-${type}`);
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    const statusDiv = document.getElementById('sync-status');
    
    // Show loading state
    button.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    statusDiv.className = 'status-message';
    statusDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/sync/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusDiv.className = 'status-message success';
            statusDiv.textContent = result.message;
            
            // Reload the corresponding table if it's active
            const activeSection = document.querySelector('.content-section.active');
            if (activeSection && activeSection.id === `${type}-section`) {
                switch(type) {
                    case 'employees': loadEmployees(); break;
                    case 'departments': loadDepartments(); break;
                    case 'positions': loadPositions(); break;
                }
            }
        } else {
            statusDiv.className = 'status-message error';
            statusDiv.textContent = result.error || 'Ошибка синхронизации';
        }
    } catch (error) {
        statusDiv.className = 'status-message error';
        statusDiv.textContent = 'Ошибка соединения с сервером';
        console.error('Sync error:', error);
    } finally {
        // Hide loading state
        button.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
        statusDiv.style.display = 'block';
        
        // Hide status message after 5 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Handle timesheet upload with progress tracking
async function handleTimesheetUpload(e) {
    e.preventDefault();
    
    const form = e.target;
    const button = form.querySelector('button[type="submit"]');
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    const statusDiv = document.getElementById('timesheet-status');
    
    // Get form data
    const formData = {
        tableNumber: document.getElementById('upload-table-number').value,
        dateFrom: document.getElementById('upload-date-from').value,
        dateTo: document.getElementById('upload-date-to').value,
        objectBin: document.getElementById('upload-org').value
    };
    
    // Show loading state
    button.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    statusDiv.className = 'status-message info';
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<div>Инициализация загрузки...</div>';
    
    try {
        // Start the loading process
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/load/timesheet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success && result.loadingId) {
            // Start polling for progress
            await pollLoadingProgress(result.loadingId, statusDiv);
        } else {
            statusDiv.className = 'status-message error';
            statusDiv.textContent = result.error || 'Ошибка загрузки табельных данных';
        }
    } catch (error) {
        statusDiv.className = 'status-message error';
        statusDiv.textContent = 'Ошибка соединения с сервером';
        console.error('Timesheet upload error:', error);
    } finally {
        // Hide loading state
        button.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Poll for loading progress
async function pollLoadingProgress(loadingId, statusDiv) {
    const maxPolls = 300; // 5 minutes max (300 * 1 second)
    let pollCount = 0;
    
    const poll = async () => {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}/admin/load/progress/${loadingId}`);
            const progress = await response.json();
            
            if (progress.success) {
                updateProgressDisplay(progress, statusDiv);
                
                if (progress.status === 'completed') {
                    statusDiv.className = 'status-message success';
                    statusDiv.innerHTML = `
                        <div><strong>Загрузка завершена!</strong></div>
                        <div>${progress.message}</div>
                        <div>Всего подразделений: ${progress.totalEmployees ? Math.ceil(progress.totalEmployees / 10) : 'N/A'}</div>
                        <div>Обработано сотрудников: ${progress.processedEmployees || 0}</div>
                        <div>Загружено событий: ${progress.eventsLoaded || 0}</div>
                    `;
                    return;
                } else if (progress.status === 'error') {
                    statusDiv.className = 'status-message error';
                    statusDiv.textContent = progress.message || 'Ошибка загрузки';
                    return;
                }
                
                // Continue polling if still in progress
                pollCount++;
                if (pollCount < maxPolls) {
                    setTimeout(poll, 1000); // Poll every second
                } else {
                    statusDiv.className = 'status-message error';
                    statusDiv.textContent = 'Превышено время ожидания загрузки';
                }
            } else {
                statusDiv.className = 'status-message error';
                statusDiv.textContent = progress.error || 'Ошибка получения статуса загрузки';
            }
        } catch (error) {
            console.error('Progress polling error:', error);
            statusDiv.className = 'status-message error';
            statusDiv.textContent = 'Ошибка получения статуса загрузки';
        }
    };
    
    // Start polling
    setTimeout(poll, 1000);
}

// Update progress display
function updateProgressDisplay(progress, statusDiv) {
    const percentage = progress.totalEmployees ? 
        Math.round((progress.processedEmployees / progress.totalEmployees) * 100) : 0;
    
    statusDiv.className = 'status-message info';
    statusDiv.innerHTML = `
        <div><strong>${progress.message}</strong></div>
        ${progress.currentDepartment ? `<div>Текущее подразделение: "${progress.currentDepartment}"</div>` : ''}
        ${progress.totalEmployees ? `<div>Прогресс: ${progress.processedEmployees}/${progress.totalEmployees} сотрудников (${percentage}%)</div>` : ''}
        ${progress.eventsLoaded ? `<div>Загружено событий: ${progress.eventsLoaded}</div>` : ''}
        <div style="background: #f0f0f0; border-radius: 4px; height: 8px; margin-top: 8px;">
            <div style="background: #007bff; height: 100%; border-radius: 4px; width: ${percentage}%; transition: width 0.3s;"></div>
        </div>
    `;
}

// Time events data
let timeEventsData = [];
let timeRecordsData = [];

// Initialize time events section
function initTimeEventsSection() {
    // Set default dates to show available data (May 2025)
    const dateFrom = new Date('2025-05-01');
    const dateTo = new Date('2025-05-31');
    
    document.getElementById('events-date-from').value = dateFrom.toISOString().split('T')[0];
    document.getElementById('events-date-to').value = dateTo.toISOString().split('T')[0];
    
    // Event listeners
    document.getElementById('events-filter-btn').addEventListener('click', loadTimeEvents);
    document.getElementById('events-clear-btn').addEventListener('click', clearEventsFilter);
    
    // Load initial data
    loadTimeEvents();
}

// Load time events
async function loadTimeEvents() {
    const tbody = document.getElementById('time-events-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка данных...</td></tr>';
    
    const params = new URLSearchParams();
    const employee = document.getElementById('events-employee-filter').value;
    const dateFrom = document.getElementById('events-date-from').value;
    const dateTo = document.getElementById('events-date-to').value;
    
    if (employee) params.append('employee', employee);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/time-events?${params}`);
        if (!response.ok) throw new Error('Failed to load time events');
        
        timeEventsData = await response.json();
        displayTimeEvents(timeEventsData);
        document.getElementById('events-total').textContent = timeEventsData.length;
    } catch (error) {
        console.error('Error loading time events:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display time events
function displayTimeEvents(events) {
    const tbody = document.getElementById('time-events-tbody');
    
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет данных</td></tr>';
        return;
    }
    
    tbody.innerHTML = events.map(event => {
        const eventType = event.event_type == 1 ? 'Вход' : 'Выход';
        const eventClass = event.event_type == 1 ? 'event-type-1' : 'event-type-2';
        
        return `
            <tr>
                <td>${formatDateTime(event.event_datetime)}</td>
                <td>${event.full_name || `ID: ${event.employee_id}`}</td>
                <td>${event.table_number || '-'}</td>
                <td><span class="${eventClass}">${eventType}</span></td>
                <td>${event.department_name || '-'}</td>
            </tr>
        `;
    }).join('');
}

// Clear events filter
function clearEventsFilter() {
    document.getElementById('events-employee-filter').value = '';
    
    // Reset to default dates (May 2025)
    const dateFrom = new Date('2025-05-01');
    const dateTo = new Date('2025-05-31');
    
    document.getElementById('events-date-from').value = dateFrom.toISOString().split('T')[0];
    document.getElementById('events-date-to').value = dateTo.toISOString().split('T')[0];
    
    loadTimeEvents();
}

// Initialize time records section
function initTimeRecordsSection() {
    // Set default month to May 2025 (where we have data)
    document.getElementById('records-month-filter').value = '2025-05';
    
    // Event listeners
    document.getElementById('records-filter-btn').addEventListener('click', loadTimeRecords);
    document.getElementById('records-clear-btn').addEventListener('click', clearRecordsFilter);
    document.getElementById('records-recalculate-btn').addEventListener('click', recalculateTimeRecords);
    
    // Load initial data
    loadTimeRecords();
}

// Load time records
async function loadTimeRecords() {
    const tbody = document.getElementById('time-records-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка данных...</td></tr>';
    
    const params = new URLSearchParams();
    const employee = document.getElementById('records-employee-filter').value;
    const month = document.getElementById('records-month-filter').value;
    const status = document.getElementById('records-status-filter').value;
    
    if (employee) params.append('employee', employee);
    if (month) params.append('month', month);
    if (status) params.append('status', status);
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/time-records?${params}`);
        if (!response.ok) throw new Error('Failed to load time records');
        
        timeRecordsData = await response.json();
        displayTimeRecords(timeRecordsData);
        document.getElementById('records-total').textContent = timeRecordsData.length;
    } catch (error) {
        console.error('Error loading time records:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display time records
function displayTimeRecords(records) {
    const tbody = document.getElementById('time-records-tbody');
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет данных</td></tr>';
        return;
    }
    
    tbody.innerHTML = records.map(record => {
        const statusText = {
            'on_time': 'Вовремя',
            'late': 'Опоздание',
            'early_leave': 'Ранний уход',
            'absent': 'Отсутствие'
        }[record.status] || record.status;
        
        const checkInTime = record.check_in ? formatTime(record.check_in) : '-';
        const checkOutTime = record.check_out ? formatTime(record.check_out) : '-';
        const hoursWorked = record.hours_worked ? record.hours_worked.toFixed(1) : '-';
        
        return `
            <tr>
                <td>${formatDate(record.date)}</td>
                <td>${record.full_name || `ID: ${record.employee_id}`}</td>
                <td>${record.table_number || '-'}</td>
                <td>${checkInTime}</td>
                <td>${checkOutTime}</td>
                <td>${hoursWorked}</td>
                <td><span class="status-${record.status}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// Clear records filter
function clearRecordsFilter() {
    document.getElementById('records-employee-filter').value = '';
    document.getElementById('records-status-filter').value = '';
    
    // Reset to May 2025 (where we have data)
    document.getElementById('records-month-filter').value = '2025-05';
    
    loadTimeRecords();
}

// Helper functions
function formatDateTime(datetime) {
    const date = new Date(datetime);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatTime(datetime) {
    const date = new Date(datetime);
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Recalculate time records from time_events
async function recalculateTimeRecords() {
    const button = document.getElementById('records-recalculate-btn');
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    
    // Show loading state
    button.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/recalculate-time-records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success message
            const statusDiv = document.createElement('div');
            statusDiv.className = 'status-message success';
            statusDiv.textContent = `Пересчет завершен! Обработано ${result.processedRecords} записей`;
            statusDiv.style.position = 'fixed';
            statusDiv.style.top = '20px';
            statusDiv.style.right = '20px';
            statusDiv.style.zIndex = '9999';
            document.body.appendChild(statusDiv);
            
            // Hide message after 3 seconds
            setTimeout(() => {
                statusDiv.remove();
            }, 3000);
            
            // Reload the table to show updated data
            loadTimeRecords();
        } else {
            alert('Ошибка пересчета: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Recalculation error:', error);
        alert('Ошибка соединения с сервером');
    } finally {
        // Hide loading state
        button.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Export switchSection for debugging
window.switchSection = switchSection;