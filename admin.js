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

// Handle timesheet upload
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
    statusDiv.className = 'status-message';
    statusDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/load/timesheet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusDiv.className = 'status-message success';
            statusDiv.textContent = result.message;
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
        statusDiv.style.display = 'block';
        
        // Hide status message after 5 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Export switchSection for debugging
window.switchSection = switchSection;