// Admin Panel - Main Router (index.js)
// Главная точка входа и маршрутизация

// DOM elements - will be initialized on load
let adminScreen = null;
let menuItems = [];
let contentSections = [];

// Handler references for event listener cleanup
let menuClickHandler = null;
let logoutHandler = null;

// Track if search inputs have been initialized
let searchInputsInitialized = false;

// Initialize admin panel
function initAdminPanel() {
    console.log('initAdminPanel called');

    // Get DOM elements
    adminScreen = document.getElementById('adminScreen');
    menuItems = document.querySelectorAll('.menu-item');
    contentSections = document.querySelectorAll('.content-section');

    console.log('Found menu items:', menuItems.length);
    console.log('Found content sections:', contentSections.length);

    // Initialize event handlers
    setupAdminEventHandlers();

    // Load first section
    switchSection('employees');

    // Add debug function to global scope
    window.debugScheduleModule = debugScheduleModule;
}

// Setup admin event handlers
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
        item.removeEventListener('click', menuClickHandler);
        item.addEventListener('click', menuClickHandler);
    });

    // Logout button
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutHandler = () => {
            if (adminScreen) {
                adminScreen.classList.remove('active');
                adminScreen.style.display = 'none';
            }
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen) {
                loginScreen.classList.add('active');
                loginScreen.style.display = 'block';
            }
            const employeeIdInput = document.getElementById('employeeId');
            if (employeeIdInput) {
                employeeIdInput.value = '';
            }
        };

        logoutBtn.removeEventListener('click', logoutHandler);
        logoutBtn.addEventListener('click', logoutHandler);
    }

    // Search inputs
    initSearchInputs();
}

// Switch between sections
function switchSection(sectionName) {
    console.log('switchSection called with:', sectionName);

    // Update menu
    menuItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionName);
    });

    // Update content
    contentSections.forEach(section => {
        const isActive = section.id === `${sectionName}-section`;
        section.classList.toggle('active', isActive);
        section.style.display = isActive ? 'block' : 'none';
        if (isActive) {
            console.log(`Activated section: ${section.id}`);
        }
    });

    // Verify the target section exists
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (!targetSection) {
        console.error(`Target section '${sectionName}-section' not found!`);
        console.log('Available sections:');
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
                return window.loadOrganizations ? window.loadOrganizations() : loadOrganizations();
            }).catch(error => {
                console.error('Error in employees section:', error);
                setTimeout(() => {
                    console.log('Fallback: calling window.loadOrganizations via setTimeout');
                    if (window.loadOrganizations) window.loadOrganizations();
                }, 1000);
            });
            break;

        case 'departments':
            console.log('Switching to departments section');
            loadDepartments().then(() => {
                console.log('Calling loadOrganizations for departments');
                return window.loadOrganizations ? window.loadOrganizations() : loadOrganizations();
            }).catch(error => {
                console.error('Error in departments section:', error);
                setTimeout(() => {
                    console.log('Fallback: calling window.loadOrganizations via setTimeout');
                    if (window.loadOrganizations) window.loadOrganizations();
                }, 1000);
            });
            break;

        case 'positions':
            loadPositions();
            break;

        case 'organizations':
            initOrganizationsSection();
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

        case 'reports':
            initReportsSection();
            break;

        case 'ai-recommendation':
            if (typeof window.initAIRecommendationSection === 'function') {
                initAIRecommendationSection();
            } else {
                console.log('Waiting for AI recommendations script to load...');
                setTimeout(() => {
                    if (typeof window.initAIRecommendationSection === 'function') {
                        initAIRecommendationSection();
                    } else {
                        console.error('AI recommendations script failed to load');
                    }
                }, 100);
            }
            break;

        case 'upload':
            initUploadSection();
            break;

        case 'cron-scheduler':
            if (typeof initCronSchedulerSection === 'function') {
                initCronSchedulerSection();
            } else {
                console.error('CRON Scheduler script not loaded');
            }
            break;

        case 'news':
            loadAdminNews();
            initNewsSection();
            break;
    }
}

// Load organizations for filters (shared function)
async function loadOrganizations() {
    console.log('=== loadOrganizations function called ===');
    try {
        console.log('Loading organizations...');
        console.log('API URL:', `${ADMIN_API_BASE_URL}/admin/organizations`);

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

        // Update AdminState if available
        if (window.AdminState) {
            window.AdminState.organizations = data;
        }
        console.log('Organizations loaded:', data.length);

        // Wait a bit for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Populate organization filters
        const employeesFilter = document.getElementById('employees-company-filter');
        const departmentsFilter = document.getElementById('departments-company-filter');

        console.log('Employees filter element:', employeesFilter);
        console.log('Departments filter element:', departmentsFilter);

        if (employeesFilter) {
            const optionsHtml = '<option value="">Все организации</option>' +
                data.map(org =>
                    `<option value="${org.object_bin}">${org.object_company} (${org.object_bin})</option>`
                ).join('');
            employeesFilter.innerHTML = optionsHtml;
            console.log('Employees filter populated with', data.length, 'options');
        } else {
            console.warn('Employees filter element not found!');
        }

        if (departmentsFilter) {
            const optionsHtml = '<option value="">Все компании</option>' +
                data.map(org =>
                    `<option value="${org.object_bin}">${org.object_company} (${org.object_bin})</option>`
                ).join('');
            departmentsFilter.innerHTML = optionsHtml;
            console.log('Departments filter populated with', data.length, 'options');
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

// Initialize search inputs
function initSearchInputs() {
    if (searchInputsInitialized) return;

    const employeesSearch = document.getElementById('employees-search');
    const departmentsSearch = document.getElementById('departments-search');
    const positionsSearch = document.getElementById('positions-search');
    const employeesCompanyFilter = document.getElementById('employees-company-filter');
    const departmentsCompanyFilter = document.getElementById('departments-company-filter');

    if (employeesSearch) {
        employeesSearch.addEventListener('input', () => {
            filterEmployees();
        });
    }

    if (employeesCompanyFilter) {
        employeesCompanyFilter.addEventListener('change', () => {
            filterEmployees();
        });
    }

    if (departmentsSearch) {
        departmentsSearch.addEventListener('input', () => {
            filterDepartments();
        });
    }

    if (departmentsCompanyFilter) {
        departmentsCompanyFilter.addEventListener('change', () => {
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

// Diagnostic function for debugging
function debugScheduleModule() {
    console.log('=== SCHEDULE MODULE DIAGNOSTICS ===');

    console.log('DOM Elements Check:');
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
        console.log(`${id}: ${element ? 'Found' : 'Missing'}`);
        if (element && element.style) {
            console.log(`  - Display: ${element.style.display || 'default'}`);
            console.log(`  - Computed: ${window.getComputedStyle(element).display}`);
        }
    });

    console.log('Variables State:');
    console.log(`menuItems.length: ${menuItems.length}`);
    console.log(`contentSections.length: ${contentSections.length}`);

    console.log('Functions Available:');
    const functionsToCheck = [
        'initSchedulesSection',
        'openScheduleCard',
        'showCreateScheduleModal',
        'switchSection'
    ];

    functionsToCheck.forEach(funcName => {
        console.log(`${funcName}: ${typeof window[funcName] === 'function' ? 'Available' : 'Missing'}`);
    });

    console.log('=== END DIAGNOSTICS ===');
}

// Test function for debugging organizations
function testLoadOrganizations() {
    console.log('=== MANUAL TEST: testLoadOrganizations called ===');
    return loadOrganizations();
}

// Export to window for global access
window.initAdminPanel = initAdminPanel;
window.switchSection = switchSection;
window.loadOrganizations = loadOrganizations;
window.initSearchInputs = initSearchInputs;
window.setupAdminEventHandlers = setupAdminEventHandlers;
window.debugScheduleModule = debugScheduleModule;
window.testLoadOrganizations = testLoadOrganizations;
