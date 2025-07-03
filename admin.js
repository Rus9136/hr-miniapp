// Admin Panel JavaScript

// Use API_BASE_URL from app.js if available, otherwise define it
const ADMIN_API_BASE_URL = window.API_BASE_URL || (
    window.location.hostname === 'localhost' 
        ? 'http://localhost:3030/api' 
        : 'https://madlen.space/api'
);

// DOM elements
const adminScreen = document.getElementById('adminScreen');
let menuItems = [];
let contentSections = [];

// Current data
let employeesData = [];
let departmentsData = [];
let positionsData = [];
let organizationsData = [];

// Store event handlers to avoid duplicates
let menuClickHandler = null;
let logoutHandler = null;

// Section initialization flags
let reportsInitialized = false;

// Show notification function
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification-toast');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.textContent = message;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Hide and remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Initialize admin panel (for internal use)
function initAdminPanel() {
    // Get DOM elements after admin screen is shown
    menuItems = document.querySelectorAll('.menu-item');
    contentSections = document.querySelectorAll('.content-section');
    
    console.log('Menu items found:', menuItems.length);
    console.log('Content sections found:', contentSections.length);
    
    // Setup event handlers
    setupAdminEventHandlers();
    
    // Initialize employee modal
    initEmployeeModal();
}

// Load organizations for filters
window.loadOrganizations = async function loadOrganizations() {
    console.log('=== loadOrganizations function called ===');
    try {
        console.log('Loading organizations...');
        console.log('API URL:', `${ADMIN_API_BASE_URL}/admin/organizations`);
        
        // Проверяем, что API_BASE_URL определен
        if (!ADMIN_API_BASE_URL) {
            throw new Error('ADMIN_API_BASE_URL is not defined');
        }
        
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw response data:', data);
        
        if (!Array.isArray(data)) {
            throw new Error('Response is not an array');
        }
        
        organizationsData = data;
        console.log('Organizations loaded:', organizationsData.length);
        
        // Ждем немного, чтобы DOM точно был готов
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Populate organization filters
        const employeesFilter = document.getElementById('employees-company-filter');
        const departmentsFilter = document.getElementById('departments-company-filter');
        
        console.log('Employees filter element:', employeesFilter);
        console.log('Departments filter element:', departmentsFilter);
        
        if (employeesFilter) {
            const optionsHtml = '<option value="">Все организации</option>' +
                organizationsData.map(org => 
                    `<option value="${org.object_bin}">${org.object_company} (${org.object_bin})</option>`
                ).join('');
            employeesFilter.innerHTML = optionsHtml;
            console.log('Employees filter populated with', organizationsData.length, 'options');
        } else {
            console.warn('Employees filter element not found!');
        }
        
        if (departmentsFilter) {
            const optionsHtml = '<option value="">Все компании</option>' +
                organizationsData.map(org => 
                    `<option value="${org.object_bin}">${org.object_company} (${org.object_bin})</option>`
                ).join('');
            departmentsFilter.innerHTML = optionsHtml;
            console.log('Departments filter populated with', organizationsData.length, 'options');
        } else {
            console.warn('Departments filter element not found!');
        }
        
        console.log('=== loadOrganizations completed successfully ===');
        return true;
        
    } catch (error) {
        console.error('Error loading organizations:', error);
        console.error('Error stack:', error.stack);
        return false;
    }
}

// Добавляем тестовую функцию для отладки
window.testLoadOrganizations = function() {
    console.log('=== MANUAL TEST: testLoadOrganizations called ===');
    return window.loadOrganizations();
}

// Switch between sections
function switchSection(sectionName) {
    console.log('🔄 switchSection called with:', sectionName);
    
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
        if (isActive) {
            console.log(`✅ Activated section: ${section.id}`);
        }
    });
    
    // Verify the target section exists
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (!targetSection) {
        console.error(`❌ Target section '${sectionName}-section' not found!`);
        console.log('🔍 Available sections:');
        contentSections.forEach(section => {
            console.log(`- ${section.id}`);
        });
    }

    // Load data for the section
    switch (sectionName) {
        case 'employees':
            console.log('Switching to employees section');
            loadEmployees().then(() => {
                console.log('Calling loadOrganizations for employees');
                // Принудительно вызываем функцию через window
                return window.loadOrganizations ? window.loadOrganizations() : loadOrganizations();
            }).catch(error => {
                console.error('Error in employees section:', error);
                // Резервный вызов через setTimeout
                setTimeout(() => {
                    console.log('Fallback: calling window.loadOrganizations via setTimeout');
                    window.loadOrganizations();
                }, 1000);
            });
            break;
        case 'departments':
            console.log('Switching to departments section');
            loadDepartments().then(() => {
                console.log('Calling loadOrganizations for departments');
                // Принудительно вызываем функцию через window
                return window.loadOrganizations ? window.loadOrganizations() : loadOrganizations();
            }).catch(error => {
                console.error('Error in departments section:', error);
                // Резервный вызов через setTimeout
                setTimeout(() => {
                    console.log('Fallback: calling window.loadOrganizations via setTimeout');
                    window.loadOrganizations();
                }, 1000);
            });
            break;
        case 'positions':
            loadPositions();
            break;
        case 'schedules':
            initSchedulesSection();
            break;
        case 'schedule-card':
            initScheduleCardSection();
            break;
        case 'schedule-assign':
            initScheduleAssignSection();
            break;
        case 'time-events':
            initTimeEventsSection();
            break;
        case 'reports':
            initReportsSection();
            break;
        case 'payroll-report':
            initPayrollReportSection();
            break;
        case 'ai-recommendation':
            initAIRecommendationSection();
            break;
        case 'upload':
            initUploadSection();
            break;
        case 'news':
            loadAdminNews();
            initNewsSection();
            break;
    }
}

// Track if search inputs have been initialized
let searchInputsInitialized = false;

// Initialize search inputs
function initSearchInputs() {
    if (searchInputsInitialized) return;
    
    const employeesSearch = document.getElementById('employees-search');
    const departmentsSearch = document.getElementById('departments-search');
    const positionsSearch = document.getElementById('positions-search');
    const employeesCompanyFilter = document.getElementById('employees-company-filter');
    const departmentsCompanyFilter = document.getElementById('departments-company-filter');
    
    if (employeesSearch) {
        employeesSearch.addEventListener('input', (e) => {
            filterEmployees();
        });
    }
    
    if (employeesCompanyFilter) {
        employeesCompanyFilter.addEventListener('change', (e) => {
            filterEmployees();
        });
    }

    if (departmentsSearch) {
        departmentsSearch.addEventListener('input', (e) => {
            filterDepartments();
        });
    }
    
    if (departmentsCompanyFilter) {
        departmentsCompanyFilter.addEventListener('change', (e) => {
            filterDepartments();
        });
    }

    if (positionsSearch) {
        positionsSearch.addEventListener('input', (e) => {
            filterPositions(e.target.value);
        });
    }
    
    searchInputsInitialized = true;
}

// Load employees
async function loadEmployees() {
    console.log('loadEmployees called');
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) {
        console.error('employees-tbody not found!');
        return;
    }
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка данных...</td></tr>';

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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display employees
function displayEmployees(employees) {
    const tbody = document.getElementById('employees-tbody');
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = employees.map(emp => `
        <tr>
            <td>${emp.table_number}</td>
            <td>${emp.full_name}</td>
            <td>${emp.department_name || '-'}</td>
            <td>${emp.position_name || '-'}</td>
            <td>${emp.current_schedule || '-'}</td>
            <td>${emp.iin || ''}</td>
            <td>
                <button class="btn btn--sm btn--outline edit-employee-btn" 
                        data-table-number="${emp.table_number}" 
                        title="Редактировать сотрудника">
                    ✏️
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-employee-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Edit button clicked');
            const tableNumber = e.target.dataset.tableNumber;
            console.log('Table number from button:', tableNumber);
            
            if (tableNumber) {
                openEmployeeModal(tableNumber);
            } else {
                console.error('No table number found on button');
                alert('Ошибка: не удалось определить табельный номер сотрудника');
            }
        });
    });
}

// Filter employees
function filterEmployees() {
    const searchTerm = document.getElementById('employees-search').value || '';
    const selectedBin = document.getElementById('employees-company-filter').value || '';
    
    const filtered = employeesData.filter(emp => {
        const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            emp.table_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBin = !selectedBin || emp.object_bin === selectedBin;
        return matchesSearch && matchesBin;
    });
    
    displayEmployees(filtered);
    document.getElementById('employees-total').textContent = filtered.length;
}

// Load departments
async function loadDepartments() {
    const tbody = document.getElementById('departments-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка данных</td></tr>';

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        if (!response.ok) throw new Error('Failed to load departments');

        departmentsData = await response.json();
        displayDepartments(departmentsData);
        document.getElementById('departments-total').textContent = departmentsData.length;
    } catch (error) {
        console.error('Error loading departments:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display departments
function displayDepartments(departments) {
    const tbody = document.getElementById('departments-tbody');
    
    if (departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = departments.map(dept => `
        <tr>
            <td>${dept.object_code}</td>
            <td>${dept.object_name}</td>
            <td>${dept.object_company || '-'}</td>
            <td>${dept.object_bin || '-'}</td>
            <td>${dept.hall_area ? dept.hall_area : '-'}</td>
            <td>
                <button class="btn btn--sm btn--outline edit-department-btn" 
                        data-department-id="${dept.id}" 
                        title="Редактировать подразделение">
                    ✏️
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-department-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Department edit button clicked');
            const departmentId = e.target.dataset.departmentId;
            console.log('Department ID from button:', departmentId);
            
            if (departmentId) {
                openDepartmentModal(departmentId);
            } else {
                console.error('No department ID found on button');
                alert('Ошибка: не удалось определить ID подразделения');
            }
        });
    });
}

// Filter departments
function filterDepartments() {
    const searchTerm = document.getElementById('departments-search').value || '';
    const selectedBin = document.getElementById('departments-company-filter').value || '';
    
    const filtered = departmentsData.filter(dept => {
        const matchesSearch = dept.object_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            dept.object_code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBin = !selectedBin || dept.object_bin === selectedBin;
        return matchesSearch && matchesBin;
    });
    
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

// Diagnostic function for debugging
window.debugScheduleModule = function() {
    console.log('🔧 === SCHEDULE MODULE DIAGNOSTICS ===');
    
    console.log('📊 DOM Elements Check:');
    const elementsToCheck = [
        'schedules-section',
        'schedule-card-section', 
        'create-schedule-btn',
        'schedule-card-title',
        'save-schedule-btn',
        'add-work-date-btn'
    ];
    
    elementsToCheck.forEach(id => {
        const element = document.getElementById(id);
        console.log(`${id}: ${element ? '✅ Found' : '❌ Missing'}`);
        if (element && element.style) {
            console.log(`  - Display: ${element.style.display || 'default'}`);
            console.log(`  - Computed: ${window.getComputedStyle(element).display}`);
        }
    });
    
    console.log('📊 Variables State:');
    console.log(`schedulesInitialized: ${schedulesInitialized}`);
    console.log(`scheduleCardInitialized: ${scheduleCardInitialized}`);
    console.log(`menuItems.length: ${menuItems.length}`);
    console.log(`contentSections.length: ${contentSections.length}`);
    
    console.log('📊 Functions Available:');
    const functionsToCheck = [
        'initSchedulesSection',
        'openScheduleCard', 
        'showCreateScheduleModal',
        'switchSection'
    ];
    
    functionsToCheck.forEach(funcName => {
        console.log(`${funcName}: ${typeof window[funcName] === 'function' ? '✅ Available' : '❌ Missing'}`);
    });
    
    console.log('🔧 === END DIAGNOSTICS ===');
};

// Export for use in app.js
window.initAdminPanel = function() {
    console.log('loadAdminPanel called');
    // Перезагружаем DOM элементы
    menuItems = document.querySelectorAll('.menu-item');
    contentSections = document.querySelectorAll('.content-section');
    console.log('Found menu items:', menuItems.length);
    console.log('Found content sections:', contentSections.length);
    
    // Инициализируем обработчики событий
    setupAdminEventHandlers();
    
    // Загружаем первую секцию
    switchSection('employees');
    
    // Add debug function to global scope
    window.debugScheduleModule = window.debugScheduleModule;
};

// Setup admin event handlers (extracted from initAdminPanel to avoid recursion)
function setupAdminEventHandlers() {
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

// Track if upload section has been initialized
let uploadSectionInitialized = false;

// Initialize upload section
function initUploadSection() {
    if (uploadSectionInitialized) return;
    
    // Load organizations for dropdown
    loadOrganizationsForUpload();
    
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
    
    uploadSectionInitialized = true;
}

// Load organizations for upload dropdown
async function loadOrganizationsForUpload() {
    console.log('=== loadOrganizationsForUpload called ===');
    try {
        console.log('Loading organizations for upload form...');
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        console.log('Upload organizations response status:', response.status);
        
        if (!response.ok) throw new Error(`Failed to load organizations: ${response.status}`);
        
        const organizations = await response.json();
        console.log('Upload organizations loaded:', organizations.length);
        
        const select = document.getElementById('upload-org');
        console.log('Upload org select element:', select);
        
        if (!select) {
            console.error('Upload org select element not found!');
            return;
        }
        
        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Add organizations
        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.object_bin;
            option.textContent = `${org.object_company} (${org.object_bin})`;
            select.appendChild(option);
        });
        
        console.log('Upload organizations dropdown populated with', organizations.length, 'items');
        
    } catch (error) {
        console.error('Error loading organizations for upload:', error);
        console.error('Error stack:', error.stack);
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
    const maxPolls = 1800; // 30 minutes max (1800 * 1 second)
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

// Admin time events data
let adminTimeEventsData = [];
let adminTimeRecordsData = [];
let timeEventsInitialized = false;

// Load organizations for time events filter
async function loadOrganizationsForTimeEvents() {
    console.log('=== loadOrganizationsForTimeEvents called ===');
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error(`Failed to load organizations: ${response.status}`);
        
        const organizations = await response.json();
        console.log('Time events organizations loaded:', organizations.length);
        
        const select = document.getElementById('events-organization-filter');
        if (!select) {
            console.error('Events organization filter element not found!');
            return;
        }
        
        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Add organizations
        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.object_bin;
            option.textContent = `${org.object_company} (${org.object_bin})`;
            select.appendChild(option);
        });
        
        console.log('Time events organizations filter populated');
        
    } catch (error) {
        console.error('Error loading organizations for time events:', error);
    }
}

// Handle organization change for cascading department filter in time events
function onTimeEventsOrganizationChange() {
    const organizationBin = document.getElementById('events-organization-filter').value;
    console.log('Time events organization changed to:', organizationBin);
    
    // Clear department selection
    document.getElementById('events-department-filter').value = '';
    
    // Reload departments filtered by organization
    loadDepartmentsForTimeEventsFilter(organizationBin || null);
}

// Initialize time events section
function initTimeEventsSection() {
    if (timeEventsInitialized) {
        // Just load data if already initialized
        loadTimeEvents();
        return;
    }
    
    // Set default dates to show available data (May 2025)
    const dateFrom = new Date('2025-05-01');
    const dateTo = new Date('2025-05-31');
    
    document.getElementById('events-date-from').value = dateFrom.toISOString().split('T')[0];
    document.getElementById('events-date-to').value = dateTo.toISOString().split('T')[0];
    
    // Load organizations and departments for filters
    loadOrganizationsForTimeEvents();
    loadDepartmentsForTimeEventsFilter();
    
    // Event listeners
    document.getElementById('events-filter-btn').addEventListener('click', loadTimeEvents);
    document.getElementById('events-clear-btn').addEventListener('click', clearEventsFilter);
    document.getElementById('events-delete-all-btn').addEventListener('click', clearAllTimeEvents);
    
    // Organization filter change event for cascading departments
    document.getElementById('events-organization-filter').addEventListener('change', onTimeEventsOrganizationChange);
    
    timeEventsInitialized = true;
    
    // Load initial data
    loadTimeEvents();
}

// Load departments for time events filter
async function loadDepartmentsForTimeEventsFilter(organizationBin = null) {
    console.log('=== loadDepartmentsForTimeEventsFilter called ===', 'organizationBin:', organizationBin);
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        if (!response.ok) throw new Error('Failed to load departments');
        
        const allDepartments = await response.json();
        console.log('All departments loaded for time events:', allDepartments.length);
        
        // Filter departments by organization if specified
        const departments = organizationBin 
            ? allDepartments.filter(dept => dept.object_bin === organizationBin)
            : allDepartments;
            
        console.log('Filtered departments for time events:', departments.length);
        
        const departmentFilter = document.getElementById('events-department-filter');
        
        if (departmentFilter) {
            // Clear existing options except the first one
            while (departmentFilter.children.length > 1) {
                departmentFilter.removeChild(departmentFilter.lastChild);
            }
            
            // Add departments
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.object_code;
                option.textContent = dept.object_name;
                departmentFilter.appendChild(option);
            });
            
            console.log('Time events departments filter populated with', departments.length, 'items');
        } else {
            console.error('Events department filter element not found!');
        }
    } catch (error) {
        console.error('Error loading departments for time events filter:', error);
    }
}

// Load time events
async function loadTimeEvents() {
    const tbody = document.getElementById('time-events-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка данных...</td></tr>';
    
    const params = new URLSearchParams();
    const organization = document.getElementById('events-organization-filter').value;
    const department = document.getElementById('events-department-filter').value;
    const dateFrom = document.getElementById('events-date-from').value;
    const dateTo = document.getElementById('events-date-to').value;
    
    if (organization) params.append('organization', organization);
    if (department) params.append('department', department);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/time-events?${params}`);
        if (!response.ok) throw new Error('Failed to load time events');
        
        adminTimeEventsData = await response.json();
        displayTimeEvents(adminTimeEventsData);
        document.getElementById('events-total').textContent = adminTimeEventsData.length;
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
        const eventType = event.event_type === '1' ? 'Вход' : 'Выход';
        const eventClass = event.event_type === '1' ? 'event-type-1' : 'event-type-2';
        
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
    document.getElementById('events-organization-filter').value = '';
    document.getElementById('events-department-filter').value = '';
    
    // Reset to default dates (May 2025)
    const dateFrom = new Date('2025-05-01');
    const dateTo = new Date('2025-05-31');
    
    document.getElementById('events-date-from').value = dateFrom.toISOString().split('T')[0];
    document.getElementById('events-date-to').value = dateTo.toISOString().split('T')[0];
    
    // Reset departments to show all when organization is cleared
    loadDepartmentsForTimeEventsFilter();
    
    loadTimeEvents();
}

// Clear all time events from database
async function clearAllTimeEvents() {
    // Confirm before deleting
    const confirmMessage = 'ВНИМАНИЕ! Вы действительно хотите удалить ВСЕ записи из таблицы событий входа/выхода?\n\n' + 
                          'Это действие невозможно отменить!';
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Double confirmation for safety
    const secondConfirm = confirm('Это последнее предупреждение!\n\nУдалить все записи событий?');
    if (!secondConfirm) {
        return;
    }
    
    const btn = document.getElementById('events-delete-all-btn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    
    // Show loading state
    btn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/time-events/clear-all`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Успешно! ${data.message}`);
            // Reload the table
            loadTimeEvents();
        } else {
            alert(`Ошибка: ${data.error}`);
        }
    } catch (error) {
        console.error('Error clearing time events:', error);
        alert('Ошибка при очистке таблицы: ' + error.message);
    } finally {
        // Reset button state
        btn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Track if time records section has been initialized
let timeRecordsInitialized = false;

// Load organizations for reports filter
async function loadOrganizationsForReports() {
    console.log('=== loadOrganizationsForReports called ===');
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/organizations`);
        if (!response.ok) throw new Error(`Failed to load organizations: ${response.status}`);
        
        const result = await response.json();
        const organizations = result.data || [];
        console.log('Reports organizations loaded:', organizations.length);
        
        const select = document.getElementById('report-organization-filter');
        if (!select) {
            console.error('Report organization filter element not found!');
            return;
        }
        
        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Add organizations
        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.organization;
            option.textContent = `${org.company_name || org.organization} (${org.organization})`;
            select.appendChild(option);
        });
        
        console.log('Reports organizations filter populated');
        
    } catch (error) {
        console.error('Error loading organizations for reports:', error);
    }
}

// Load departments for reports filter
async function loadDepartmentsForReports(organization = null) {
    console.log('=== loadDepartmentsForReports called ===', 'organization:', organization);
    try {
        const params = new URLSearchParams();
        if (organization && organization.trim() !== '') {
            params.append('organization', organization);
            console.log('Adding organization filter:', organization);
        }
        
        const url = `${ADMIN_API_BASE_URL}/admin/reports/departments?${params}`;
        console.log('Fetching departments from:', url);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load departments: ${response.status}`);
        
        const result = await response.json();
        const departments = result.data || [];
        console.log('Reports departments loaded:', departments.length, 'departments:', departments);
        
        const select = document.getElementById('report-department-filter');
        if (!select) {
            console.error('Report department filter element not found!');
            return;
        }
        
        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Add departments
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            select.appendChild(option);
        });
        
        console.log('Reports departments filter populated with', departments.length, 'items');
        
    } catch (error) {
        console.error('Error loading departments for reports:', error);
    }
}

// Handle organization change for cascading department filter in reports
function onReportOrganizationChange() {
    const organization = document.getElementById('report-organization-filter').value;
    console.log('Report organization changed to:', organization);
    
    // Clear department selection
    const departmentSelect = document.getElementById('report-department-filter');
    departmentSelect.value = '';
    
    // Reload departments filtered by organization
    loadDepartmentsForReports(organization);
}

// Initialize time records section
function initReportsSection() {
    if (reportsInitialized) {
        // Just load data if already initialized
        return;
    }
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date-filter').value = today;
    
    // Load organizations and departments for filters
    loadOrganizationsForReports();
    loadDepartmentsForReports();
    
    // Event listeners
    document.getElementById('generate-report-btn').addEventListener('click', generateLateEmployeesReport);
    document.getElementById('clear-report-btn').addEventListener('click', clearReportFilters);
    
    // Organization filter change event for cascading departments
    document.getElementById('report-organization-filter').addEventListener('change', onReportOrganizationChange);
    
    reportsInitialized = true;
    
    // Don't load initial data - wait for user to click generate
    clearReportTable();
}

// Generate late employees report
async function generateLateEmployeesReport() {
    const generateBtn = document.getElementById('generate-report-btn');
    const spinner = generateBtn.querySelector('.spinner');
    const btnText = generateBtn.querySelector('.btn-text');
    
    // Show loading state
    spinner.style.display = 'inline';
    btnText.textContent = 'Формирование отчета...';
    generateBtn.disabled = true;
    
    const tbody = document.getElementById('reports-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Формирование отчета...</td></tr>';
    
    const params = new URLSearchParams();
    const date = document.getElementById('report-date-filter').value;
    const organization = document.getElementById('report-organization-filter').value;
    const department = document.getElementById('report-department-filter').value;
    
    if (date) params.append('date', date);
    if (organization) params.append('organization', organization);
    if (department) params.append('department', department);
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/late-employees?${params}`);
        if (!response.ok) throw new Error('Failed to generate late employees report');
        
        const result = await response.json();
        displayLateEmployeesReport(result.data);
        document.getElementById('report-total').textContent = result.total_count;
        
        console.log(`Late employees report generated: ${result.total_count} employees found`);
    } catch (error) {
        console.error('Error generating late employees report:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc3545;">Ошибка формирования отчета: ' + error.message + '</td></tr>';
        document.getElementById('report-total').textContent = '0';
    } finally {
        // Hide loading state
        spinner.style.display = 'none';
        btnText.textContent = 'Сформировать отчет';
        generateBtn.disabled = false;
    }
}

// Display late employees report
function displayLateEmployeesReport(employees) {
    const tbody = document.getElementById('reports-tbody');
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #28a745;">Опоздавших сотрудников не найдено</td></tr>';
        return;
    }
    
    tbody.innerHTML = employees.map(employee => {
        const statusClass = employee.status === 'late' ? 'status-late' : 'status-absent';
        const statusText = employee.status === 'late' ? 'Опоздание' : 'Отсутствие';
        
        return `
            <tr>
                <td>${employee.employee_name}</td>
                <td>${employee.table_number}</td>
                <td>${employee.department_name}</td>
                <td>${employee.schedule_name || '-'}</td>
                <td>${employee.schedule_start_time || '-'}</td>
                <td>${employee.actual_entry_time}</td>
                <td><span class="${statusClass}">${employee.late_time_formatted}</span></td>
            </tr>
        `;
    }).join('');
}

// Clear report table
function clearReportTable() {
    const tbody = document.getElementById('reports-tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #6c757d;">Выберите дату и нажмите "Сформировать отчет"</td></tr>';
    document.getElementById('report-total').textContent = '0';
}

// Clear report filters
function clearReportFilters() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date-filter').value = today;
    document.getElementById('report-organization-filter').value = '';
    document.getElementById('report-department-filter').value = '';
    
    // Reset departments to show all when organization is cleared
    loadDepartmentsForReports();
    
    // Clear report table
    clearReportTable();
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


// ==================== WORK SCHEDULES SECTION ====================

// Schedule templates data
let schedulesData = [];
let scheduleRuleIndex = 1;

// Initialize schedules section
let schedulesInitialized = false;
let currentScheduleCode = null; // Переменная для хранения текущего кода графика

function initSchedulesSection() {
    console.log('🔧 initSchedulesSection called for 1C schedules, initialized:', schedulesInitialized);
    
    if (schedulesInitialized) {
        loadSchedules();
        return;
    }
    
    // No need for create button anymore, just load 1C schedules
    setTimeout(() => {
        schedulesInitialized = true;
        loadSchedules();
    }, 200);
}

// Load schedules from 1C
async function loadSchedules() {
    const tbody = document.getElementById('schedules-tbody');
    tbody.innerHTML = '<tr><td colspan="2" class="loading">Загрузка данных...</td></tr>';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/schedules/1c/list`);
        if (!response.ok) throw new Error('Failed to load schedules');
        
        schedulesData = await response.json();
        displaySchedules(schedulesData);
        document.getElementById('schedules-total').textContent = schedulesData.length;
        
        // Initialize search functionality
        initSchedulesSearch();
    } catch (error) {
        console.error('Error loading schedules:', error);
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display schedules from 1C
function displaySchedules(schedules) {
    const tbody = document.getElementById('schedules-tbody');
    const searchValue = document.getElementById('schedules-search')?.value.toLowerCase() || '';
    
    // Filter schedules based on search
    const filteredSchedules = searchValue 
        ? schedules.filter(schedule => 
            schedule.schedule_name.toLowerCase().includes(searchValue)
          )
        : schedules;
    
    // Update filtered count
    const totalSpan = document.getElementById('schedules-total');
    if (totalSpan) {
        totalSpan.textContent = filteredSchedules.length;
        if (searchValue && filteredSchedules.length !== schedules.length) {
            totalSpan.innerHTML = `${filteredSchedules.length} <span style="color: #6c757d;">(из ${schedules.length})</span>`;
        }
    }
    
    if (filteredSchedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center;">Нет данных</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredSchedules.map(schedule => {
        return `
            <tr>
                <td>${schedule.schedule_name}</td>
                <td>
                    <button class="btn btn--sm btn--primary" onclick="openScheduleCard('${schedule.schedule_code}')">Открыть</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Initialize search functionality for schedules
function initSchedulesSearch() {
    const searchInput = document.getElementById('schedules-search');
    if (searchInput && !searchInput.hasAttribute('data-initialized')) {
        searchInput.setAttribute('data-initialized', 'true');
        
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                displaySchedules(schedulesData);
            }, 300); // Debounce for 300ms
        });
        
        // Clear search on Escape key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                displaySchedules(schedulesData);
            }
        });
    }
}

// Open schedule card for creating new schedule
function showCreateScheduleModal() {
    openScheduleCard(null); // null means create new
}

// Open schedule card for 1C schedule
function openScheduleCard(scheduleCode) {
    console.log('🎯 openScheduleCard called with scheduleCode:', scheduleCode);
    
    // Store current schedule code for later use
    currentScheduleCode = scheduleCode;
    
    // Hide schedules list and show card
    switchSection('schedule-card');
    
    // Wait a bit for the section to be displayed, then update elements
    setTimeout(() => {
        console.log('🔍 Looking for schedule-card-title...');
        const titleElement = document.getElementById('schedule-card-title');
        if (titleElement) {
            console.log('✅ schedule-card-title found');
            if (scheduleCode) {
                // Show existing 1C schedule
                console.log('📝 Setting title for 1C schedule view');
                titleElement.textContent = 'График работы из 1С';
                loadScheduleCard1C(scheduleCode);
            } else {
                console.log('❌ No schedule code provided');
                titleElement.textContent = 'Ошибка загрузки графика';
            }
        } else {
            console.error('❌ schedule-card-title element not found!');
        }
    }, 200);
}

// Initialize schedule card section
let scheduleCardInitialized = false;

function initScheduleCardSection() {
    if (scheduleCardInitialized) return;
    
    // Set up event listeners with safety checks
    const backBtn = document.getElementById('back-to-schedules-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            switchSection('schedules');
        });
    }
    
    const saveBtn = document.getElementById('save-schedule-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveScheduleCard);
    }
    
    const addDateBtn = document.getElementById('add-work-date-btn');
    if (addDateBtn) {
        addDateBtn.addEventListener('click', addWorkDate);
    }
    
    // Add event listener for apply times button
    const applyTimesBtn = document.getElementById('apply-times-btn');
    if (applyTimesBtn) {
        applyTimesBtn.addEventListener('click', applyTimesToAllDays);
    }
    
    // Form validation
    ['schedule-card-name', 'schedule-card-check-in', 'schedule-card-check-out'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', validateScheduleCard);
        }
    });
    
    scheduleCardInitialized = true;
}

// Load schedule card data from 1C
async function loadScheduleCard1C(scheduleCode) {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/schedules/1c?scheduleCode=${scheduleCode}`);
        if (!response.ok) throw new Error('Failed to load 1C schedule');
        
        const data = await response.json();
        const schedules = data.schedules || [];
        
        if (schedules.length === 0) {
            throw new Error('No data found for this schedule');
        }
        
        const firstSchedule = schedules[0];
        
        // Populate schedule name and times
        const nameElement = document.getElementById('schedule-card-name');
        if (nameElement) {
            nameElement.value = firstSchedule.schedule_name || '';
            nameElement.readOnly = true;
        }
        
        const checkInElement = document.getElementById('schedule-card-check-in');
        const checkOutElement = document.getElementById('schedule-card-check-out');
        if (checkInElement) {
            checkInElement.value = firstSchedule.work_start_time || '';
            checkInElement.readOnly = false; // Разрешаем редактирование
        }
        if (checkOutElement) {
            checkOutElement.value = firstSchedule.work_end_time || '';
            checkOutElement.readOnly = false; // Разрешаем редактирование
        }
        
        // Hide description field for 1C schedules
        const descriptionElement = document.getElementById('schedule-card-description');
        if (descriptionElement) {
            descriptionElement.closest('.form-group').style.display = 'none';
        }
        
        // Display work dates from 1C
        displayWorkDates1C(schedules);
        
        // Hide employee assignment section for 1C schedules
        const employeeSection = document.querySelector('.schedule-employees-section');
        if (employeeSection) {
            employeeSection.style.display = 'none';
        }
        
        // Hide save button and add date button for 1C schedules
        const saveBtn = document.getElementById('save-schedule-btn');
        const addDateBtn = document.getElementById('add-work-date-btn');
        if (saveBtn) saveBtn.style.display = 'none';
        if (addDateBtn) addDateBtn.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading 1C schedule:', error);
        alert('Ошибка загрузки графика из 1С: ' + error.message);
    }
}

// Display work dates from 1C schedule
function displayWorkDates1C(schedules) {
    const tbody = document.getElementById('work-dates-tbody');
    
    if (schedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет рабочих дней</td></tr>';
        return;
    }
    
    // Update table header for 1C data
    const table = document.getElementById('work-dates-table');
    const thead = table.querySelector('thead tr');
    if (thead) {
        thead.innerHTML = `
            <th style="width: 150px;">Дата</th>
            <th style="width: 100px;">Часов работы</th>
            <th style="width: 150px;">Тип времени</th>
            <th style="width: 100px;">Время входа</th>
            <th style="width: 100px;">Время выхода</th>
        `;
    }
    
    tbody.innerHTML = schedules.map(schedule => {
        const workDate = new Date(schedule.work_date);
        const dateStr = workDate.toLocaleDateString('ru-RU');
        
        // Format time fields
        const startTime = schedule.work_start_time || '';
        const endTime = schedule.work_end_time || '';
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${schedule.work_hours || 0}</td>
                <td>${schedule.time_type || ''}</td>
                <td>${startTime}</td>
                <td>${endTime}</td>
            </tr>
        `;
    }).join('');
}

// Clear schedule card form
function clearScheduleCard() {
    // Clear form fields with safety checks
    const elements = [
        { id: 'schedule-card-id', value: '' },
        { id: 'schedule-card-name', value: '' },
        { id: 'schedule-card-description', value: '' },
        { id: 'schedule-card-check-in', value: '09:00' },
        { id: 'schedule-card-check-out', value: '18:00' }
    ];
    
    elements.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            element.value = item.value;
        } else {
            console.warn(`Element ${item.id} not found in clearScheduleCard`);
        }
    });
    
    // Clear tables
    displayWorkDates([]);
    displayAssignedEmployees([]);
}

// This function has been removed as part of modal-to-card conversion

// Add work date to schedule
function addWorkDate() {
    // Создаем строку для ввода новой даты прямо в таблице
    const tbody = document.getElementById('work-dates-tbody');
    
    // Проверяем, нет ли уже строки для ввода
    if (tbody.querySelector('.new-date-row')) {
        return; // Уже есть строка для ввода
    }
    
    // Добавляем новую строку для ввода
    const newRow = document.createElement('tr');
    newRow.className = 'new-date-row';
    newRow.innerHTML = `
        <td>
            <input type="date" class="work-date-input" id="temp-date-input" required>
        </td>
        <td class="day-of-week" id="temp-day-display">-</td>
        <td>
            <button class="btn btn--sm btn--primary" onclick="confirmAddDate()">Добавить</button>
            <button class="btn btn--sm btn--outline" onclick="cancelAddDate()">Отмена</button>
        </td>
    `;
    
    tbody.appendChild(newRow);
    
    // Фокус на поле ввода даты
    document.getElementById('temp-date-input').focus();
    
    // Добавляем обработчик для отображения дня недели
    document.getElementById('temp-date-input').addEventListener('change', function() {
        const date = new Date(this.value);
        const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        document.getElementById('temp-day-display').textContent = dayNames[date.getDay()];
    });
}

// Confirm adding new date
function confirmAddDate() {
    const dateInput = document.getElementById('temp-date-input');
    const newDate = dateInput.value;
    
    if (!newDate) {
        alert('Выберите дату');
        return;
    }
    
    // Получаем текущие даты
    const tbody = document.getElementById('work-dates-tbody');
    const existingDates = Array.from(tbody.querySelectorAll('tr:not(.new-date-row)'))
        .map(row => row.querySelector('td')?.textContent)
        .filter(date => date && date !== 'Нет рабочих дней');
    
    // Проверяем на дубликаты
    if (existingDates.includes(formatDate(newDate))) {
        alert('Эта дата уже добавлена');
        return;
    }
    
    // Удаляем строку ввода
    cancelAddDate();
    
    // Обновляем список дат
    const allDates = [...existingDates.map(d => parseDate(d)), newDate].sort();
    displayWorkDates(allDates.map(date => ({ work_date: date })));
}

// Cancel adding new date
function cancelAddDate() {
    const newRow = document.querySelector('.new-date-row');
    if (newRow) {
        newRow.remove();
    }
}

// Remove work date from schedule
function removeWorkDate(dateToRemove) {
    const tbody = document.getElementById('work-dates-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr:not(.new-date-row)'));
    
    // Получаем все даты кроме удаляемой
    const remainingDates = rows
        .map(row => row.querySelector('td')?.textContent)
        .filter(date => date && date !== dateToRemove && date !== 'Нет рабочих дней')
        .map(date => ({ work_date: parseDate(date) }));
    
    displayWorkDates(remainingDates);
}

// Save schedule card
async function saveScheduleCard() {
    const button = document.getElementById('save-schedule-btn');
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    
    // Validate required fields
    const name = document.getElementById('schedule-card-name').value.trim();
    const checkIn = document.getElementById('schedule-card-check-in').value;
    const checkOut = document.getElementById('schedule-card-check-out').value;
    
    if (!name || !checkIn || !checkOut) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    // Collect form data
    const scheduleId = document.getElementById('schedule-card-id').value;
    const formData = {
        name: name,
        description: document.getElementById('schedule-card-description').value,
        check_in_time: checkIn,
        check_out_time: checkOut,
        dates: getWorkDatesFromTable()
    };
    
    // Show loading
    button.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';
    
    try {
        const url = scheduleId ? 
            `${ADMIN_API_BASE_URL}/admin/schedules/templates/${scheduleId}` :
            `${ADMIN_API_BASE_URL}/admin/schedules/templates`;
        
        const response = await fetch(url, {
            method: scheduleId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success || response.ok) {
            alert(scheduleId ? 'График успешно обновлен' : 'График успешно создан');
            switchSection('schedules');
            loadSchedules();
        } else {
            alert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Error saving schedule:', error);
        alert('Ошибка сохранения графика');
    } finally {
        button.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
    }
}

// Display work dates in table
function displayWorkDates(dates) {
    const tbody = document.getElementById('work-dates-tbody');
    
    if (!tbody) {
        console.error('work-dates-tbody element not found');
        return;
    }
    
    if (dates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #6c757d;">Нет рабочих дней</td></tr>';
        return;
    }
    
    // Сортируем даты по возрастанию
    const sortedDates = dates.sort((a, b) => new Date(a.work_date) - new Date(b.work_date));
    
    tbody.innerHTML = sortedDates.map(dateObj => {
        const date = new Date(dateObj.work_date);
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const dayOfWeek = dayNames[date.getDay()];
        const formattedDate = formatDate(dateObj.work_date);
        
        return `
            <tr>
                <td>${formattedDate}</td>
                <td class="day-of-week">${dayOfWeek}</td>
                <td>
                    <button class="remove-date-btn" onclick="removeWorkDate('${formattedDate}')">
                        Удалить
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Display assigned employees in table
function displayAssignedEmployees(employees) {
    const tbody = document.getElementById('assigned-employees-tbody');
    
    if (!tbody) {
        console.error('assigned-employees-tbody element not found');
        return;
    }
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #6c757d;">Нет назначенных сотрудников</td></tr>';
        return;
    }
    
    tbody.innerHTML = employees.map(emp => `
        <tr>
            <td>${emp.full_name}</td>
            <td>${emp.table_number}</td>
            <td>${emp.department_name || '-'}</td>
            <td>${emp.organization || '-'}</td>
            <td>${formatDate(emp.start_date)}</td>
        </tr>
    `).join('');
}

// Get work dates from table
function getWorkDatesFromTable() {
    const tbody = document.getElementById('work-dates-tbody');
    const rows = tbody.querySelectorAll('tr:not(.new-date-row)');
    const dates = [];
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2 && !cells[0].textContent.includes('Нет рабочих')) {
            // Преобразуем отформатированную дату обратно в формат YYYY-MM-DD
            const dateText = cells[0].textContent.trim();
            if (dateText && dateText !== '-') {
                dates.push(parseDate(dateText));
            }
        }
    });
    
    return dates;
}

// Helper function to parse date from display format to YYYY-MM-DD
function parseDate(displayDate) {
    // displayDate может быть в формате "DD.MM.YYYY" или уже в "YYYY-MM-DD"
    if (displayDate.includes('.')) {
        const parts = displayDate.split('.');
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return displayDate;
}

// Add validation function
function validateScheduleCard() {
    const name = document.getElementById('schedule-card-name').value.trim();
    const checkIn = document.getElementById('schedule-card-check-in').value;
    const checkOut = document.getElementById('schedule-card-check-out').value;
    
    const saveBtn = document.getElementById('save-schedule-btn');
    const isValid = name && checkIn && checkOut;
    
    if (saveBtn) {
        saveBtn.disabled = !isValid;
    }
}

// Show schedule details (redirect to card)
async function showScheduleDetails(scheduleId) {
    openScheduleCard(scheduleId);
}

// Get day of week name
function getDayOfWeekName(dayNumber) {
    const days = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    return days[dayNumber] || `День ${dayNumber}`;
}

// ==================== SCHEDULE ASSIGNMENT SECTION ====================

let scheduleAssignInitialized = false;
let availableEmployees = [];
let selectedEmployeeIds = new Set();

// Initialize schedule assignment section
function initScheduleAssignSection() {
    if (scheduleAssignInitialized) {
        loadAssignmentData();
        return;
    }
    
    // Set up event listeners
    document.getElementById('assign-template-select').addEventListener('change', handleTemplateSelect);
    document.getElementById('assign-organization-filter').addEventListener('change', handleAssignOrganizationChange);
    document.getElementById('assign-filter-btn').addEventListener('click', loadAvailableEmployees);
    document.getElementById('assign-header-checkbox').addEventListener('change', handleSelectAllEmployees);
    document.getElementById('assign-select-all').addEventListener('change', handleSelectAllEmployees);
    document.getElementById('assign-submit-btn').addEventListener('click', handleScheduleAssignment);
    
    // Set default date to today
    document.getElementById('assign-start-date').value = new Date().toISOString().split('T')[0];
    
    scheduleAssignInitialized = true;
    loadAssignmentData();
}

// Load assignment data
async function loadAssignmentData() {
    // Load schedule templates
    loadScheduleTemplates();
    
    // Load organizations
    loadAssignOrganizations();
    
    // Load departments
    loadAssignDepartments();
    
    // Load positions
    loadAssignPositions();
}

// Load schedule templates for dropdown
async function loadScheduleTemplates() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/schedules/templates`);
        if (!response.ok) throw new Error('Failed to load templates');
        
        const templates = await response.json();
        const select = document.getElementById('assign-template-select');
        
        // Clear existing options except first
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading schedule templates:', error);
    }
}

// Load organizations for assignment filter
async function loadAssignOrganizations() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error('Failed to load organizations');
        
        const organizations = await response.json();
        const select = document.getElementById('assign-organization-filter');
        
        // Clear existing options except first
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.object_bin;
            option.textContent = `${org.object_company} (${org.object_bin})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading organizations:', error);
    }
}

// Load departments for assignment filter
async function loadAssignDepartments(organizationBin = null) {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        if (!response.ok) throw new Error('Failed to load departments');
        
        const allDepartments = await response.json();
        const departments = organizationBin ?
            allDepartments.filter(dept => dept.object_bin === organizationBin) :
            allDepartments;
        
        const select = document.getElementById('assign-department-filter');
        
        // Clear existing options except first
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.object_code;
            option.textContent = dept.object_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

// Load positions for assignment filter
async function loadAssignPositions() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/positions`);
        if (!response.ok) throw new Error('Failed to load positions');
        
        const positions = await response.json();
        const select = document.getElementById('assign-position-filter');
        
        // Clear existing options except first
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        positions.forEach(pos => {
            const option = document.createElement('option');
            option.value = pos.staff_position_code;
            option.textContent = pos.staff_position_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading positions:', error);
    }
}

// Handle template selection
function handleTemplateSelect() {
    const templateId = document.getElementById('assign-template-select').value;
    updateAssignButtonState();
}

// Handle organization change for cascading filter
function handleAssignOrganizationChange() {
    const organizationBin = document.getElementById('assign-organization-filter').value;
    document.getElementById('assign-department-filter').value = '';
    loadAssignDepartments(organizationBin || null);
}

// Load available employees
async function loadAvailableEmployees() {
    const params = new URLSearchParams();
    const organization = document.getElementById('assign-organization-filter').value;
    const department = document.getElementById('assign-department-filter').value;
    const position = document.getElementById('assign-position-filter').value;
    
    if (organization) params.append('organization', organization);
    if (department) params.append('department', department);
    if (position) params.append('position', position);
    
    const tbody = document.getElementById('assign-employees-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка сотрудников...</td></tr>';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/schedules/available-employees?${params}`);
        if (!response.ok) throw new Error('Failed to load employees');
        
        availableEmployees = await response.json();
        displayAvailableEmployees();
    } catch (error) {
        console.error('Error loading available employees:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display available employees
function displayAvailableEmployees() {
    const tbody = document.getElementById('assign-employees-tbody');
    
    if (availableEmployees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет доступных сотрудников</td></tr>';
        return;
    }
    
    tbody.innerHTML = availableEmployees.map(emp => `
        <tr>
            <td>
                <input type="checkbox" 
                    class="employee-checkbox" 
                    value="${emp.id}" 
                    onchange="handleEmployeeSelection(${emp.id})"
                    ${selectedEmployeeIds.has(emp.id) ? 'checked' : ''}>
            </td>
            <td>${emp.full_name}</td>
            <td>${emp.table_number}</td>
            <td>${emp.department_name || '-'}</td>
            <td>${emp.current_schedule || 'Не назначен'}</td>
        </tr>
    `).join('');
    
    updateSelectedCount();
}

// Handle employee selection
function handleEmployeeSelection(employeeId) {
    const checkbox = document.querySelector(`.employee-checkbox[value="${employeeId}"]`);
    
    if (checkbox.checked) {
        selectedEmployeeIds.add(employeeId);
    } else {
        selectedEmployeeIds.delete(employeeId);
    }
    
    updateSelectedCount();
    updateAssignButtonState();
}

// Handle select all employees
function handleSelectAllEmployees(e) {
    const isChecked = e.target.checked;
    
    // Update both checkboxes
    document.getElementById('assign-header-checkbox').checked = isChecked;
    document.getElementById('assign-select-all').checked = isChecked;
    
    // Update all employee checkboxes
    document.querySelectorAll('.employee-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
        const employeeId = parseInt(checkbox.value);
        
        if (isChecked) {
            selectedEmployeeIds.add(employeeId);
        } else {
            selectedEmployeeIds.delete(employeeId);
        }
    });
    
    updateSelectedCount();
    updateAssignButtonState();
}

// Update selected count
function updateSelectedCount() {
    document.getElementById('assign-selected-count').textContent = selectedEmployeeIds.size;
}

// Update assign button state
function updateAssignButtonState() {
    const templateSelected = document.getElementById('assign-template-select').value;
    const employeesSelected = selectedEmployeeIds.size > 0;
    const startDate = document.getElementById('assign-start-date').value;
    
    document.getElementById('assign-submit-btn').disabled = !(templateSelected && employeesSelected && startDate);
}

// Handle schedule assignment
async function handleScheduleAssignment() {
    const button = document.getElementById('assign-submit-btn');
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    const statusDiv = document.getElementById('assign-status');
    
    const templateId = document.getElementById('assign-template-select').value;
    const startDate = document.getElementById('assign-start-date').value;
    const employeeIds = Array.from(selectedEmployeeIds);
    
    // Show loading
    button.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    statusDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/schedules/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                template_id: parseInt(templateId),
                employee_ids: employeeIds,
                start_date: startDate,
                assigned_by: 'admin'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusDiv.className = 'status-message success';
            statusDiv.textContent = result.message;
            statusDiv.style.display = 'block';
            
            // Clear selections
            selectedEmployeeIds.clear();
            document.getElementById('assign-header-checkbox').checked = false;
            document.getElementById('assign-select-all').checked = false;
            
            // Reload employees to show updated schedules
            loadAvailableEmployees();
        } else {
            statusDiv.className = 'status-message error';
            statusDiv.textContent = result.error || 'Ошибка назначения графика';
            statusDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error assigning schedule:', error);
        statusDiv.className = 'status-message error';
        statusDiv.textContent = 'Ошибка соединения с сервером';
        statusDiv.style.display = 'block';
    } finally {
        button.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
        updateAssignButtonState();
    }
}

// Apply times to all days in the schedule
async function applyTimesToAllDays() {
    const checkInElement = document.getElementById('schedule-card-check-in');
    const checkOutElement = document.getElementById('schedule-card-check-out');
    
    if (!checkInElement || !checkOutElement) {
        alert('Ошибка: не найдены поля времени');
        return;
    }
    
    const startTime = checkInElement.value;
    const endTime = checkOutElement.value;
    
    // Проверяем, что оба поля заполнены
    if (!startTime || !endTime) {
        alert('Пожалуйста, заполните оба поля времени (вход и выход)');
        return;
    }
    
    if (!currentScheduleCode) {
        alert('Ошибка: не найден код графика');
        return;
    }
    
    // Подтверждение от пользователя
    if (!confirm(`Применить время входа ${startTime} и выхода ${endTime} ко всем дням графика?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/schedules/1c/update-times`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scheduleCode: currentScheduleCode,
                startTime: startTime,
                endTime: endTime
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Перезагружаем данные графика чтобы показать обновленные значения
            loadScheduleCard1C(currentScheduleCode);
        } else {
            alert(`Ошибка: ${result.message || 'Неизвестная ошибка'}`);
        }
        
    } catch (error) {
        console.error('Error applying times:', error);
        alert('Ошибка при применении времени: ' + error.message);
    }
}

// News management functions
let currentEditingNewsId = null;

// Load news for admin panel
async function loadAdminNews() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/news`);
        if (!response.ok) throw new Error('Failed to load news');
        
        const data = await response.json();
        const tbody = document.getElementById('news-tbody');
        const totalSpan = document.getElementById('news-total');
        
        tbody.innerHTML = '';
        totalSpan.textContent = data.pagination.total;
        
        data.news.forEach(item => {
            const row = document.createElement('tr');
            const createdDate = new Date(item.created_at).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            row.innerHTML = `
                <td>${createdDate}</td>
                <td>${item.title}</td>
                <td>${item.author}</td>
                <td>
                    <button class="btn btn--sm btn--outline" onclick="editNews(${item.id})">Редактировать</button>
                    <button class="btn btn--sm btn--danger" onclick="deleteNews(${item.id})">Удалить</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading news:', error);
    }
}

// Show news modal
function showNewsModal(newsId = null) {
    const modal = document.getElementById('newsModal');
    const modalTitle = document.getElementById('newsModalTitle');
    const form = document.getElementById('newsForm');
    
    currentEditingNewsId = newsId;
    
    if (newsId) {
        modalTitle.textContent = 'Редактировать новость';
        // Load news data
        loadNewsData(newsId);
    } else {
        modalTitle.textContent = 'Добавить новость';
        form.reset();
        document.getElementById('newsId').value = '';
    }
    
    modal.classList.add('active');
}

// Load news data for editing
async function loadNewsData(newsId) {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/news/${newsId}`);
        if (!response.ok) throw new Error('Failed to load news');
        
        const news = await response.json();
        
        document.getElementById('newsId').value = news.id;
        document.getElementById('newsTitle').value = news.title;
        document.getElementById('newsDescription').value = news.description;
        document.getElementById('newsImage').value = news.image_url || '';
    } catch (error) {
        console.error('Error loading news data:', error);
        alert('Ошибка загрузки новости');
    }
}

// Edit news
window.editNews = function(newsId) {
    showNewsModal(newsId);
};

// Delete news
window.deleteNews = async function(newsId) {
    if (!confirm('Вы уверены, что хотите удалить эту новость?')) return;
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/news/${newsId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete news');
        
        loadAdminNews();
    } catch (error) {
        console.error('Error deleting news:', error);
        alert('Ошибка удаления новости');
    }
};

// Initialize news section event handlers
function initNewsSection() {
    const addNewsBtn = document.getElementById('add-news-btn');
    const closeNewsModalBtn = document.getElementById('closeNewsModal');
    const cancelNewsBtn = document.getElementById('cancelNewsBtn');
    const newsForm = document.getElementById('newsForm');
    
    if (addNewsBtn && !addNewsBtn.hasEventListener) {
        addNewsBtn.addEventListener('click', () => showNewsModal());
        addNewsBtn.hasEventListener = true;
    }
    
    if (closeNewsModalBtn && !closeNewsModalBtn.hasEventListener) {
        closeNewsModalBtn.addEventListener('click', () => {
            document.getElementById('newsModal').classList.remove('active');
        });
        closeNewsModalBtn.hasEventListener = true;
    }
    
    if (cancelNewsBtn && !cancelNewsBtn.hasEventListener) {
        cancelNewsBtn.addEventListener('click', () => {
            document.getElementById('newsModal').classList.remove('active');
        });
        cancelNewsBtn.hasEventListener = true;
    }
    
    if (newsForm && !newsForm.hasEventListener) {
        newsForm.addEventListener('submit', handleNewsSubmit);
        newsForm.hasEventListener = true;
    }
}

// Handle news form submission
async function handleNewsSubmit(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');
    
    const formData = {
        title: document.getElementById('newsTitle').value,
        description: document.getElementById('newsDescription').value,
        image_url: document.getElementById('newsImage').value || null
    };
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        const newsId = document.getElementById('newsId').value;
        const url = newsId 
            ? `${ADMIN_API_BASE_URL}/news/${newsId}`
            : `${ADMIN_API_BASE_URL}/news`;
        const method = newsId ? 'PUT' : 'POST';
        
        console.log('Sending news data:', formData);
        console.log('URL:', url);
        console.log('Method:', method);
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        document.getElementById('newsModal').classList.remove('active');
        loadAdminNews();
    } catch (error) {
        console.error('Error saving news:', error);
        alert('Ошибка сохранения новости');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Employee modal functions
function openEmployeeModal(tableNumber) {
    try {
        console.log('Opening employee modal for:', tableNumber);
        console.log('Current employeesData length:', employeesData ? employeesData.length : 0);
        
        if (!employeesData || employeesData.length === 0) {
            console.error('No employees data available');
            alert('Ошибка: данные сотрудников не загружены. Попробуйте обновить страницу.');
            return;
        }
        
        const employee = employeesData.find(emp => emp.table_number === tableNumber);
        if (!employee) {
            console.error('Employee not found:', tableNumber);
            console.log('Available employees:', employeesData.map(emp => emp.table_number));
            alert(`Ошибка: сотрудник с табельным номером ${tableNumber} не найден.`);
            return;
        }
        
        console.log('Found employee:', employee);
    
    // Fill form fields
    document.getElementById('employeeTableNumber').value = employee.table_number;
    document.getElementById('employeeTableNumberDisplay').value = employee.table_number;
    document.getElementById('employeeFullName').value = employee.full_name || '';
    document.getElementById('employeeIIN').value = employee.iin || '';
    document.getElementById('employeePayroll').value = employee.payroll || '';
    document.getElementById('employeeDepartment').value = employee.department_name || '-';
    document.getElementById('employeePosition').value = employee.position_name || '-';
    document.getElementById('employeeSchedule').value = employee.current_schedule || '-';
    document.getElementById('employeeStatus').value = employee.status || '-';
    document.getElementById('employeeBIN').value = employee.object_bin || '-';
    document.getElementById('employeeCode').value = employee.object_code || '-';
    
    // Clear status message
    const statusDiv = document.getElementById('employeeFormStatus');
    statusDiv.style.display = 'none';
    statusDiv.className = 'status-message';
    
        // Show modal
        const modal = document.getElementById('employeeModal');
        if (!modal) {
            console.error('Employee modal not found in DOM');
            alert('Ошибка: модальное окно не найдено. Попробуйте обновить страницу.');
            return;
        }
        
        console.log('Showing modal...');
        // Не используем style.display напрямую из-за !important в CSS
        modal.classList.add('active');
        
        // Повторно инициализируем обработчики событий
        console.log('Re-initializing modal event handlers...');
        initEmployeeModal();
        
    } catch (error) {
        console.error('Error opening employee modal:', error);
        alert('Ошибка при открытии модального окна: ' + error.message);
    }
}

function closeEmployeeModal() {
    try {
        console.log('Closing employee modal...');
        const modal = document.getElementById('employeeModal');
        if (modal) {
            // Не используем style.display напрямую из-за !important в CSS
            modal.classList.remove('active');
        }
        
        const form = document.getElementById('employeeForm');
        if (form) {
            form.reset();
        }
        
        // Hide status message
        const statusDiv = document.getElementById('employeeFormStatus');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
        
        console.log('Employee modal closed successfully');
    } catch (error) {
        console.error('Error closing employee modal:', error);
    }
}

async function saveEmployee(formData) {
    const tableNumber = formData.get('table_number');
    const fullName = formData.get('full_name');
    const iin = formData.get('iin');
    const payroll = formData.get('payroll');
    
    // Validate required fields
    if (!tableNumber || !fullName) {
        throw new Error('Табельный номер и ФИО обязательны для заполнения');
    }
    
    // Validate IIN format if provided
    if (iin && !/^\d{12}$/.test(iin)) {
        throw new Error('ИИН должен состоять из 12 цифр');
    }
    
    // Validate payroll if provided
    if (payroll && (isNaN(payroll) || parseFloat(payroll) < 0)) {
        throw new Error('ФОТ должен быть положительным числом');
    }
    
    // Prepare data for API call
    const updateData = [{
        table_number: tableNumber
    }];
    
    // Add fields that can be updated
    if (iin) updateData[0].iin = iin;
    if (payroll) updateData[0].payroll = parseFloat(payroll);
    if (fullName) updateData[0].full_name = fullName;
    
    console.log('Sending API request with data:', updateData);
    
    // Call API to update employee
    const response = await fetch(`${ADMIN_API_BASE_URL}/admin/employees/update-iin`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
        let errorMessage = 'Ошибка при сохранении данных';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) {
            errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        }
        console.error('API error:', errorMessage);
        throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'Ошибка при сохранении данных');
    }
    
    if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join('; '));
    }
    
    return result;
}

function showEmployeeFormStatus(message, isError = false) {
    const statusDiv = document.getElementById('employeeFormStatus');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${isError ? 'error' : 'success'}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide success messages after 3 seconds
    if (!isError) {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

// Initialize employee modal event handlers
function initEmployeeModal() {
    const modal = document.getElementById('employeeModal');
    const closeBtn = document.getElementById('closeEmployeeModal');
    const cancelBtn = document.getElementById('cancelEmployeeBtn');
    const form = document.getElementById('employeeForm');
    
    console.log('Initializing employee modal...');
    console.log('Modal found:', !!modal);
    console.log('Close button found:', !!closeBtn);
    console.log('Cancel button found:', !!cancelBtn);
    console.log('Form found:', !!form);
    
    // Remove existing event listeners to prevent duplicates
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeEmployeeModal);
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Close button clicked');
            closeEmployeeModal();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.removeEventListener('click', closeEmployeeModal);
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cancel button clicked');
            closeEmployeeModal();
        });
    }
    
    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked');
                closeEmployeeModal();
            }
        });
    }
    
    // Save button handler
    const saveBtn = document.getElementById('saveEmployeeBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Save button clicked');
            
            const submitBtn = saveBtn;
            const btnText = submitBtn.querySelector('.btn-text');
            const spinner = submitBtn.querySelector('.spinner');
            
            // Show loading state
            submitBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline';
            
            try {
                // Get form data manually
                const tableNumber = document.getElementById('employeeTableNumber').value;
                const fullName = document.getElementById('employeeFullName').value;
                const iin = document.getElementById('employeeIIN').value;
                const payroll = document.getElementById('employeePayroll').value;
                
                console.log('Form data:', { tableNumber, fullName, iin, payroll });
                
                // Create FormData manually
                const formData = new FormData();
                formData.set('table_number', tableNumber);
                formData.set('full_name', fullName);
                formData.set('iin', iin);
                formData.set('payroll', payroll);
                
                const result = await saveEmployee(formData);
                console.log('Save result:', result);
                
                showEmployeeFormStatus('Данные сотрудника успешно сохранены', false);
                
                // Reload employees data
                console.log('Reloading employees...');
                await loadEmployees();
                
                // Close modal after delay
                setTimeout(() => {
                    closeEmployeeModal();
                }, 1500);
                
            } catch (error) {
                console.error('Error saving employee:', error);
                showEmployeeFormStatus(error.message, true);
            } finally {
                submitBtn.disabled = false;
                if (btnText) btnText.style.display = 'inline';
                if (spinner) spinner.style.display = 'none';
            }
        });
    }
}

// Payroll report functionality
let payrollReportInitialized = false;

async function initPayrollReportSection() {
    if (payrollReportInitialized) {
        return;
    }
    
    console.log('Initializing payroll report section...');
    
    // Load organizations and departments for filter
    await loadPayrollOrganizations();
    await loadPayrollDepartments();
    
    // Set up event handlers
    const orgFilter = document.getElementById('payroll-organization-filter');
    const deptFilter = document.getElementById('payroll-department-filter');
    const generateBtn = document.getElementById('generate-payroll-report-btn');
    const clearBtn = document.getElementById('clear-payroll-report-btn');
    
    // Organization filter change - update departments
    if (orgFilter) {
        orgFilter.addEventListener('change', async (e) => {
            const selectedOrg = e.target.value;
            console.log('Payroll organization changed to:', selectedOrg);
            
            // Clear department selection
            const deptFilter = document.getElementById('payroll-department-filter');
            if (deptFilter) {
                deptFilter.value = '';
            }
            
            // Reload departments filtered by organization
            await loadPayrollDepartments(selectedOrg || null);
        });
    }
    
    // Generate report button
    if (generateBtn) {
        generateBtn.addEventListener('click', generatePayrollReport);
    }
    
    // Clear report button
    if (clearBtn) {
        clearBtn.addEventListener('click', clearPayrollReport);
    }
    
    // Set default dates (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const dateFrom = document.getElementById('payroll-date-from');
    const dateTo = document.getElementById('payroll-date-to');
    
    if (dateFrom) dateFrom.value = firstDay.toISOString().split('T')[0];
    if (dateTo) dateTo.value = lastDay.toISOString().split('T')[0];
    
    payrollReportInitialized = true;
}

async function loadPayrollOrganizations() {
    console.log('=== loadPayrollOrganizations called ===');
    try {
        console.log('Loading organizations for payroll...');
        console.log('API URL:', `${ADMIN_API_BASE_URL}/admin/organizations`);
        
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const organizations = await response.json();
        console.log('Organizations loaded:', organizations.length);
        
        const select = document.getElementById('payroll-organization-filter');
        console.log('Payroll organization filter element:', select);
        
        if (select) {
            select.innerHTML = '<option value="">Все организации</option>';
            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.object_bin;
                option.textContent = `${org.object_company} (${org.object_bin})`;
                select.appendChild(option);
            });
            console.log('Payroll organizations filter populated with', organizations.length, 'options');
        } else {
            console.error('Payroll organization filter element not found!');
        }
    } catch (error) {
        console.error('Error loading organizations for payroll:', error);
    }
}

async function loadPayrollDepartments(organizationBin = null) {
    console.log('=== loadPayrollDepartments called ===', 'organizationBin:', organizationBin);
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        if (!response.ok) throw new Error('Failed to load departments');
        
        const allDepartments = await response.json();
        console.log('All departments loaded for payroll:', allDepartments.length);
        
        // Filter departments by organization if specified
        const departments = organizationBin 
            ? allDepartments.filter(dept => dept.object_bin === organizationBin)
            : allDepartments;
            
        console.log('Filtered departments for payroll:', departments.length);
        
        // Debug: show first few departments when filtering
        if (organizationBin && departments.length > 0) {
            console.log('Sample filtered departments:');
            departments.slice(0, 5).forEach(dept => {
                console.log(`  ${dept.object_name} (${dept.object_code})`);
            });
            
            // Check for Kitchen room specifically
            const kitchenRooms = departments.filter(d => d.object_name && d.object_name.toLowerCase().includes('kitchen'));
            console.log(`Kitchen rooms found: ${kitchenRooms.length}`);
            if (kitchenRooms.length > 0) {
                kitchenRooms.forEach(kr => {
                    console.log(`  Kitchen: ${kr.object_name} (${kr.object_code})`);
                });
            }
        }
        
        const deptFilter = document.getElementById('payroll-department-filter');
        console.log('Payroll department filter element:', deptFilter);
        
        if (deptFilter) {
            // Clear departments
            deptFilter.innerHTML = '<option value="">Все подразделения</option>';
            
            // Add departments
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.object_code;
                option.textContent = dept.object_name;
                deptFilter.appendChild(option);
            });
            
            console.log('Payroll departments filter populated with', departments.length, 'items');
        } else {
            console.error('Payroll department filter element not found!');
        }
    } catch (error) {
        console.error('Error loading departments for payroll:', error);
    }
}

async function generatePayrollReport() {
    const orgFilter = document.getElementById('payroll-organization-filter');
    const deptFilter = document.getElementById('payroll-department-filter');
    const dateFrom = document.getElementById('payroll-date-from');
    const dateTo = document.getElementById('payroll-date-to');
    const generateBtn = document.getElementById('generate-payroll-report-btn');
    const spinner = generateBtn?.querySelector('.spinner');
    const btnText = generateBtn?.querySelector('.btn-text');
    
    if (!dateFrom?.value || !dateTo?.value) {
        alert('Пожалуйста, выберите даты для отчета');
        return;
    }
    
    // Show loading state
    if (generateBtn) generateBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline';
    if (btnText) btnText.style.display = 'none';
    
    try {
        const params = new URLSearchParams({
            dateFrom: dateFrom.value,
            dateTo: dateTo.value
        });
        
        if (orgFilter?.value) params.append('organization', orgFilter.value);
        if (deptFilter?.value) params.append('department', deptFilter.value);
        
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/payroll?${params}`);
        if (!response.ok) throw new Error('Failed to generate report');
        
        const result = await response.json();
        displayPayrollReport(result);
        
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Ошибка при формировании отчета: ' + error.message);
    } finally {
        if (generateBtn) generateBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.display = 'inline';
    }
}

function displayPayrollReport(result) {
    const tbody = document.getElementById('payroll-report-body');
    const footer = document.getElementById('payroll-report-footer');
    const totalSpan = document.getElementById('payroll-total');
    const totalAmount = document.getElementById('payroll-total-amount');
    
    if (!tbody) return;
    
    // Clear existing data
    tbody.innerHTML = '';
    
    if (!result.data || result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Нет данных за выбранный период</td></tr>';
        footer.style.display = 'none';
        totalSpan.textContent = '0.00';
        return;
    }
    
    // Group data by date for better display
    const groupedData = {};
    result.data.forEach(row => {
        const date = new Date(row.work_date).toLocaleDateString('ru-RU');
        if (!groupedData[date]) {
            groupedData[date] = [];
        }
        groupedData[date].push(row);
    });
    
    // Display data
    Object.entries(groupedData).forEach(([date, employees]) => {
        employees.forEach((emp, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index === 0 ? date : ''}</td>
                <td>${emp.full_name}</td>
                <td>${emp.table_number}</td>
                <td>${emp.department_name || '-'}</td>
                <td>${parseFloat(emp.payroll).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
                <td>${emp.shifts_count}</td>
                <td>${parseFloat(emp.daily_payroll).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
            `;
            tbody.appendChild(tr);
        });
    });
    
    // Update totals
    totalSpan.textContent = parseFloat(result.summary.total).toLocaleString('ru-RU', { minimumFractionDigits: 2 });
    totalAmount.textContent = parseFloat(result.summary.total).toLocaleString('ru-RU', { minimumFractionDigits: 2 });
    footer.style.display = 'table-footer-group';
}

function clearPayrollReport() {
    // Clear filters
    document.getElementById('payroll-organization-filter').value = '';
    document.getElementById('payroll-department-filter').value = '';
    
    // Reset dates to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('payroll-date-from').value = firstDay.toISOString().split('T')[0];
    document.getElementById('payroll-date-to').value = lastDay.toISOString().split('T')[0];
    
    // Clear report
    const tbody = document.getElementById('payroll-report-body');
    const footer = document.getElementById('payroll-report-footer');
    const totalSpan = document.getElementById('payroll-total');
    
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Выберите параметры и нажмите "Сформировать отчет"</td></tr>';
    }
    if (footer) {
        footer.style.display = 'none';
    }
    if (totalSpan) {
        totalSpan.textContent = '0.00';
    }
    
    // Reload departments
    loadPayrollDepartments('');
}

// Export functions for debugging
window.switchSection = switchSection;
window.loadEmployees = loadEmployees;
window.loadDepartments = loadDepartments;
window.loadPositions = loadPositions;
window.showScheduleDetails = showScheduleDetails;
window.openScheduleCard = openScheduleCard;
window.confirmAddDate = confirmAddDate;
window.cancelAddDate = cancelAddDate;
window.loadNews = loadNews;
window.removeWorkDate = removeWorkDate;
window.handleEmployeeSelection = handleEmployeeSelection;
window.openEmployeeModal = openEmployeeModal;
window.closeEmployeeModal = closeEmployeeModal;

// ===== DEPARTMENT MODAL FUNCTIONS =====

// Open department modal for editing
function openDepartmentModal(departmentId) {
    try {
        console.log('Opening department modal for ID:', departmentId);
        
        // Validate data availability
        if (!departmentsData || departmentsData.length === 0) {
            console.error('No departments data available');
            alert('Ошибка: данные подразделений не загружены. Попробуйте обновить страницу.');
            return;
        }
        
        // Find department by ID
        const department = departmentsData.find(dept => dept.id == departmentId);
        if (!department) {
            console.error('Department not found:', departmentId);
            alert(`Ошибка: подразделение с ID ${departmentId} не найдено.`);
            return;
        }
        
        console.log('Found department:', department);
    
        // Fill form fields with current department data
        document.getElementById('departmentId').value = department.id;
        document.getElementById('departmentCode').value = department.object_code || '';
        document.getElementById('departmentName').value = department.object_name || '';
        document.getElementById('departmentCompany').value = department.object_company || '';
        document.getElementById('departmentBin').value = department.object_bin || '';
        document.getElementById('departmentIikoId').value = department.id_iiko || '';
        document.getElementById('departmentHallArea').value = department.hall_area || '';
        document.getElementById('departmentKitchenArea').value = department.kitchen_area || '';
        document.getElementById('departmentSeatsCount').value = department.seats_count || '';
        
        // Clear status message
        const statusDiv = document.getElementById('departmentFormStatus');
        statusDiv.style.display = 'none';
        statusDiv.className = 'status-message';
        
        // Show modal
        const modal = document.getElementById('departmentModal');
        modal.classList.add('active');
        
        // Re-initialize event handlers
        initDepartmentModal();
        
    } catch (error) {
        console.error('Error opening department modal:', error);
        alert('Ошибка при открытии модального окна: ' + error.message);
    }
}

function closeDepartmentModal() {
    try {
        console.log('Closing department modal...');
        const modal = document.getElementById('departmentModal');
        if (modal) {
            modal.classList.remove('active');
            console.log('Department modal closed');
        }
    } catch (error) {
        console.error('Error closing department modal:', error);
    }
}

// Initialize department modal event handlers
function initDepartmentModal() {
    const modal = document.getElementById('departmentModal');
    const closeBtn = document.getElementById('closeDepartmentModal');
    const cancelBtn = document.getElementById('cancelDepartmentBtn');
    const form = document.getElementById('departmentForm');
    
    console.log('Initializing department modal...');
    console.log('Modal found:', !!modal);
    console.log('Close button found:', !!closeBtn);
    console.log('Cancel button found:', !!cancelBtn);
    console.log('Form found:', !!form);
    
    // Remove existing event listeners to prevent duplicates
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeDepartmentModal);
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Close button clicked');
            closeDepartmentModal();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.removeEventListener('click', closeDepartmentModal);
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cancel button clicked');
            closeDepartmentModal();
        });
    }
    
    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked');
                closeDepartmentModal();
            }
        });
    }
    
    // Save button handler
    const saveBtn = document.getElementById('saveDepartmentBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Save department button clicked');
            
            const submitBtn = saveBtn;
            const btnText = submitBtn.querySelector('.btn-text');
            const spinner = submitBtn.querySelector('.spinner');
            
            // Show loading state
            submitBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline';
            
            try {
                // Get form data
                const departmentId = document.getElementById('departmentId').value;
                const iikoId = document.getElementById('departmentIikoId').value;
                const hallArea = document.getElementById('departmentHallArea').value;
                const kitchenArea = document.getElementById('departmentKitchenArea').value;
                const seatsCount = document.getElementById('departmentSeatsCount').value;
                
                console.log('Saving department data:', { departmentId, iikoId, hallArea, kitchenArea, seatsCount });
                
                const result = await saveDepartment(departmentId, iikoId, hallArea, kitchenArea, seatsCount);
                console.log('Save result:', result);
                
                showDepartmentFormStatus('Данные подразделения успешно сохранены', false);
                
                // Reload departments data
                await loadDepartments();
                
                // Close modal after delay
                setTimeout(() => {
                    closeDepartmentModal();
                }, 1500);
                
            } catch (error) {
                console.error('Error saving department:', error);
                showDepartmentFormStatus(error.message, true);
            } finally {
                submitBtn.disabled = false;
                if (btnText) btnText.style.display = 'inline';
                if (spinner) spinner.style.display = 'none';
            }
        });
    }
}

// Save department data
async function saveDepartment(departmentId, iikoId, hallArea, kitchenArea, seatsCount) {
    console.log('saveDepartment called with:', { departmentId, iikoId, hallArea, kitchenArea, seatsCount });
    
    // Validate required fields
    if (!departmentId) {
        throw new Error('ID подразделения обязателен');
    }
    
    // Client-side validation
    if (hallArea && hallArea !== '') {
        const hallAreaNum = parseFloat(hallArea);
        if (isNaN(hallAreaNum) || hallAreaNum <= 0) {
            throw new Error('Площадь зала должна быть положительным числом');
        }
    }
    
    if (kitchenArea && kitchenArea !== '') {
        const kitchenAreaNum = parseFloat(kitchenArea);
        if (isNaN(kitchenAreaNum) || kitchenAreaNum <= 0) {
            throw new Error('Площадь кухни должна быть положительным числом');
        }
    }
    
    if (seatsCount && seatsCount !== '') {
        const seatsNum = parseInt(seatsCount);
        if (isNaN(seatsNum) || seatsNum < 0) {
            throw new Error('Количество посадочных мест должно быть неотрицательным целым числом');
        }
    }
    
    // Prepare data for API call
    const updateData = {
        id_iiko: iikoId || null,
        hall_area: hallArea && hallArea !== '' ? parseFloat(hallArea) : null,
        kitchen_area: kitchenArea && kitchenArea !== '' ? parseFloat(kitchenArea) : null,
        seats_count: seatsCount && seatsCount !== '' ? parseInt(seatsCount) : null
    };
    
    console.log('Sending API request with data:', updateData);
    
    // Call API to update department
    const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments/${departmentId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
        let errorMessage = 'Ошибка при сохранении данных';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) {
            errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'Ошибка при сохранении данных');
    }
    
    return result;
}

// Show status message in department form
function showDepartmentFormStatus(message, isError = false) {
    const statusDiv = document.getElementById('departmentFormStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${isError ? 'error' : 'success'}`;
        statusDiv.style.display = 'block';
        
        // Auto-hide success messages after 3 seconds
        if (!isError) {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }
}

// Export department functions to global scope
window.openDepartmentModal = openDepartmentModal;
window.closeDepartmentModal = closeDepartmentModal;

// ================== AI-РЕКОМЕНДАЦИЯ SECTION ==================

// Initialize AI recommendation section
async function initAIRecommendationSection() {
    console.log('🤖 Initializing AI Recommendation section...');
    
    // Load organizations and departments for filter
    await loadAIOrganizations();
    await loadAIDepartments();
    
    // Set up event handlers
    const orgFilter = document.getElementById('ai-organization-filter');
    const deptFilter = document.getElementById('ai-department-filter');
    const processBtn = document.getElementById('ai-process-btn');
    
    // Organization filter change - update departments
    if (orgFilter) {
        // Remove existing event listeners to prevent duplicates
        orgFilter.removeEventListener('change', handleAIOrganizationChange);
        orgFilter.addEventListener('change', handleAIOrganizationChange);
    }
    
    // Process button click
    if (processBtn) {
        processBtn.addEventListener('click', processAIRecommendation);
    }
    
    console.log('✅ AI Recommendation section initialized');
}

// Handle organization change for AI section
async function handleAIOrganizationChange(e) {
    const selectedOrg = e.target.value;
    console.log('🏢 AI organization changed to:', selectedOrg);
    
    // Clear department selection
    const deptFilter = document.getElementById('ai-department-filter');
    if (deptFilter) {
        deptFilter.value = '';
        deptFilter.innerHTML = '<option value="">Выберите подразделение</option>';
        console.log('🔄 Department filter cleared');
    }
    
    // Reload departments filtered by organization
    console.log('📥 Loading departments for organization:', selectedOrg);
    await loadAIDepartments(selectedOrg || null);
}

// Load organizations for AI recommendation filter
async function loadAIOrganizations() {
    console.log('=== loadAIOrganizations called ===');
    try {
        console.log('Loading organizations for AI recommendation...');
        console.log('API URL:', `${ADMIN_API_BASE_URL}/admin/organizations`);
        
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const organizations = await response.json();
        console.log('Organizations loaded:', organizations.length);
        
        const select = document.getElementById('ai-organization-filter');
        console.log('AI organization filter element:', select);
        
        if (select) {
            select.innerHTML = '<option value="">Выберите организацию</option>';
            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.object_bin;
                option.textContent = `${org.object_company} (${org.object_bin})`;
                select.appendChild(option);
            });
            console.log('AI organizations filter populated with', organizations.length, 'options');
        } else {
            console.error('AI organization filter element not found!');
        }
    } catch (error) {
        console.error('Error loading organizations for AI recommendation:', error);
    }
}

// Load departments for AI recommendation filter
async function loadAIDepartments(organizationBin = null) {
    console.log('=== loadAIDepartments called ===', { organizationBin });
    try {
        let url = `${ADMIN_API_BASE_URL}/admin/departments`;
        if (organizationBin) {
            url += `?organization=${organizationBin}`;
        }
        
        console.log('Loading departments for AI recommendation...');
        console.log('API URL:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const departments = await response.json();
        console.log('Departments loaded:', departments.length);
        
        // Store departments data globally for access in processAIRecommendation
        window.aiDepartmentsData = departments;
        
        const select = document.getElementById('ai-department-filter');
        console.log('AI department filter element:', select);
        
        if (select) {
            select.innerHTML = '<option value="">Выберите подразделение</option>';
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.object_code;
                option.textContent = dept.object_name;
                // Store id_iiko in data attribute
                option.setAttribute('data-id-iiko', dept.id_iiko || '');
                select.appendChild(option);
            });
            console.log('AI departments filter populated with', departments.length, 'options');
        } else {
            console.error('AI department filter element not found!');
        }
    } catch (error) {
        console.error('Error loading departments for AI recommendation:', error);
    }
}

// Process AI recommendation
async function processAIRecommendation() {
    const orgFilter = document.getElementById('ai-organization-filter');
    const deptFilter = document.getElementById('ai-department-filter');
    const dateFromInput = document.getElementById('ai-date-from');
    const dateToInput = document.getElementById('ai-date-to');
    const processBtn = document.getElementById('ai-process-btn');
    const spinner = processBtn?.querySelector('.spinner');
    const btnText = processBtn?.querySelector('.btn-text');
    
    // Validation
    if (!orgFilter?.value) {
        showNotification('Выберите организацию', 'error');
        return;
    }
    
    if (!deptFilter?.value) {
        showNotification('Выберите подразделение', 'error');
        return;
    }
    
    if (!dateFromInput?.value) {
        showNotification('Выберите дату начала', 'error');
        return;
    }
    
    if (!dateToInput?.value) {
        showNotification('Выберите дату конца', 'error');
        return;
    }
    
    // Get selected department data
    const selectedDeptCode = deptFilter.value;
    const selectedOption = deptFilter.querySelector(`option[value="${selectedDeptCode}"]`);
    const idIiko = selectedOption?.getAttribute('data-id-iiko');
    
    // Additional way to get id_iiko from stored data
    const department = window.aiDepartmentsData?.find(dept => dept.object_code === selectedDeptCode);
    const departmentIdIiko = idIiko || department?.id_iiko;
    
    if (!departmentIdIiko) {
        showNotification('У выбранного подразделения не задан id_iiko', 'error');
        return;
    }
    
    // Show loading state
    if (processBtn) processBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline';
    if (btnText) btnText.style.display = 'none';
    
    try {
        // Prepare request data
        const requestData = {
            branch_id: departmentIdIiko,
            hall_area: department?.hall_area || null,
            kitchen_area: department?.kitchen_area || null,
            seats_count: department?.seats_count || null,
            date_start: dateFromInput.value,
            date_end: dateToInput.value
        };
        
        console.log('Sending AI recommendation request:', requestData);
        
        // Send request through our proxy to bypass CSP
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-webhook-proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        console.log('AI recommendation response:', result);
        
        if (!response.ok) {
            // Handle specific error responses
            if (response.status === 404) {
                showNotification('Сервис AI-рекомендаций временно недоступен. Попробуйте позже.', 'error');
                return;
            }
            
            if (response.status === 400) {
                showNotification('Неверные данные для обработки. Проверьте выбранные параметры.', 'error');
                return;
            }
            
            throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }
        
        // Show success message
        showNotification(
            `AI-рекомендация успешно отправлена для подразделения "${deptFilter.options[deptFilter.selectedIndex].textContent}"`, 
            'success'
        );
        
    } catch (error) {
        console.error('Error processing AI recommendation:', error);
        showNotification('Произошла ошибка при отправке данных для обработки: ' + error.message, 'error');
    } finally {
        // Hide loading state
        if (processBtn) processBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.display = 'inline';
    }
}

// Export AI recommendation functions
window.initAIRecommendationSection = initAIRecommendationSection;
window.loadAIOrganizations = loadAIOrganizations;
window.loadAIDepartments = loadAIDepartments;
window.processAIRecommendation = processAIRecommendation;