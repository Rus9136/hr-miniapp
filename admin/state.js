// Admin Panel - State Module
// Централизованное управление состоянием

// Global admin state
const AdminState = {
    // Data cache
    employees: [],
    departments: [],
    positions: [],
    organizations: [],
    organizationsCache: null,

    // Schedules data
    schedulesData: [],
    scheduleRuleIndex: 1,
    currentScheduleCode: null,

    // Time tracking data
    timeEventsData: [],
    timeRecordsData: [],

    // Schedule assignment
    availableEmployees: [],
    selectedEmployeeIds: new Set(),

    // News
    currentEditingNewsId: null,

    // Charts
    revenueToPayrollChart: null,

    // Initialization flags
    initialized: new Set(),

    // Check if section is initialized
    isInitialized(section) {
        return this.initialized.has(section);
    },

    // Mark section as initialized
    setInitialized(section) {
        this.initialized.add(section);
    },

    // Reset initialization for section
    resetInitialized(section) {
        this.initialized.delete(section);
    },

    // Clear all data
    clearAll() {
        this.employees = [];
        this.departments = [];
        this.positions = [];
        this.organizations = [];
        this.organizationsCache = null;
        this.schedulesData = [];
        this.timeEventsData = [];
        this.timeRecordsData = [];
        this.availableEmployees = [];
        this.selectedEmployeeIds.clear();
        this.initialized.clear();
    }
};

// DOM elements cache
const AdminDOM = {
    adminScreen: null,
    menuItems: [],
    contentSections: [],

    // Initialize DOM references
    init() {
        this.adminScreen = document.getElementById('adminScreen');
        this.menuItems = document.querySelectorAll('.menu-item');
        this.contentSections = document.querySelectorAll('.content-section');
    },

    // Get element by ID with caching
    get(id) {
        return document.getElementById(id);
    }
};

// Event handlers storage (to avoid duplicates)
const AdminHandlers = {
    menuClickHandler: null,
    logoutHandler: null
};

// Export to window
window.AdminState = AdminState;
window.AdminDOM = AdminDOM;
window.AdminHandlers = AdminHandlers;

// Backward compatibility - export individual variables
// These will be deprecated in future versions
window.employeesData = AdminState.employees;
window.departmentsData = AdminState.departments;
window.positionsData = AdminState.positions;
window.organizationsData = AdminState.organizations;
