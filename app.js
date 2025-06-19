console.log('🚀 HR Mini App v9.0 - MOBILE COLORS FIXED - CACHE BUST: ' + new Date().getTime());

// API configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3030/api' 
    : 'https://madlen.space/api';
window.API_BASE_URL = API_BASE_URL; // Export for admin.js

// Platform adapter instance
let platformAdapter = null;
let currentPlatform = null;

// State management with logging
let _currentEmployee = null;
Object.defineProperty(window, 'currentEmployee', {
    get() {
        return _currentEmployee;
    },
    set(value) {
        console.log('🔄 currentEmployee changed:', {
            from: _currentEmployee ? _currentEmployee.fullName : 'null',
            to: value ? value.fullName : 'null',
            stack: new Error().stack.split('\n')[2]
        });
        
        // CRITICAL: Prevent unauthorized resets
        if (_currentEmployee && !value) {
            console.warn('🚨 WARNING: Attempting to reset authenticated user to null!');
            console.warn('🚨 Stack trace:', new Error().stack);
            
            // For now, prevent the reset (can be removed after debugging)
            // return;
        }
        
        _currentEmployee = value;
    }
});

// Initialize
window.currentEmployee = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let calendarData = [];
let timeEventsData = null;
let newsData = [];
let newsPage = 1;
let isLoadingNews = false;
let hasMoreNews = true;
let currentNewsId = null;

// Legacy platform detection (for backward compatibility)
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

// Platform initialization
async function initializePlatform() {
    try {
        // Detect platform
        if (typeof PlatformDetector !== 'undefined') {
            currentPlatform = PlatformDetector.detect();
            console.log(`🔍 Detected platform: ${currentPlatform}`);
            
            // Create appropriate adapter
            switch (currentPlatform) {
                case PlatformDetector.PLATFORMS.TELEGRAM:
                    platformAdapter = new TelegramAdapter();
                    break;
                case PlatformDetector.PLATFORMS.IOS:
                    platformAdapter = new IOSAdapter();
                    break;
                default:
                    platformAdapter = new WebAdapter();
            }
            
            // Initialize adapter
            await platformAdapter.init();
            console.log('✅ Platform adapter initialized');
            
            // Update legacy isInTelegram flag
            window.isInTelegram = currentPlatform === PlatformDetector.PLATFORMS.TELEGRAM;
        } else {
            console.log('⚠️ Platform detector not available, using legacy mode');
        }
    } catch (error) {
        console.error('❌ Platform initialization error:', error);
        // Fall back to legacy mode
    }
}

// Navigation functions for Telegram
function showScreen(screenName, screenElement) {
    console.log(`🔄 showScreen called: ${screenName} (current: ${currentScreen})`);
    
    // КРИТИЧЕСКАЯ ОТЛАДКА: Логируем переходы на menu
    if (screenName === 'menu' && currentScreen.name !== 'login') {
        console.warn('🔄 WARNING: Unexpected return to menu from:', currentScreen.name);
        console.warn('🔍 Stack trace:', new Error().stack);
    }
    
    // КРИТИЧЕСКАЯ ОТЛАДКА: Блокируем нежелательные переходы из admin
    if (currentScreen.name === 'admin' && screenName === 'login') {
        console.error('🚨 CRITICAL: Attempted to redirect admin to login! BLOCKED!');
        console.error('🚨 Stack trace:', new Error().stack);
        return; // БЛОКИРУЕМ переход
    }
    
    // CRITICAL: Prevent unauthorized access to protected screens (ИСКЛЮЧАЯ admin)
    if ((screenName === 'menu' || screenName === 'main' || screenName === 'news' || 
         screenName === 'salary' || screenName === 'vacation' || screenName === 'hr' || 
         screenName === 'settings' || screenName === 'departmentStats') && !window.currentEmployee) {
        console.log(`❌ BLOCKED: Attempted to access ${screenName} without authentication`);
        console.log('🔒 Redirecting to login screen');
        console.log('🔍 Debug info:', {
            screenName,
            currentEmployee: !!window.currentEmployee,
            currentEmployeeData: window.currentEmployee ? window.currentEmployee.fullName : 'null'
        });
        screenName = 'login';
        screenElement = loginScreen;
    }
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    // Show target screen
    screenElement.classList.add('active');
    screenElement.style.display = 'block';
    
    // Update current screen state properly
    // Only update previous if we're not going back
    if (screenName !== currentScreen.previous) {
        currentScreen.previous = currentScreen.name;
    }
    currentScreen.name = screenName;
    
    // Handle platform-specific navigation
    if (platformAdapter) {
        handlePlatformNavigation(screenName);
    } else if (isInTelegram) {
        // Legacy Telegram navigation
        handleTelegramNavigation(screenName);
    }
    
    console.log(`Navigated to: ${screenName} (previous: ${currentScreen.previous})`);
}

function handlePlatformNavigation(screenName) {
    if (!platformAdapter) return;
    
    // Show/hide back button based on screen
    if (screenName === 'login' || screenName === 'menu') {
        platformAdapter.hideBackButton();
    } else {
        platformAdapter.showBackButton();
    }
    
    // Platform-specific restrictions
    if (currentPlatform === PlatformDetector.PLATFORMS.TELEGRAM && screenName === 'admin') {
        platformAdapter.showAlert('Админ-панель доступна только в веб-версии');
        goBackToPreviousScreen();
        return;
    }
    
    if (currentPlatform === PlatformDetector.PLATFORMS.IOS && screenName === 'admin') {
        platformAdapter.showAlert('Админ-панель доступна только в веб-версии');
        goBackToPreviousScreen();
        return;
    }
    
    // Haptic feedback on navigation
    platformAdapter.hapticFeedback('light');
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
        case 'settings':
            targetScreen = document.getElementById('settingsScreen');
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
    // Strict check - only for real Telegram environment
    if (!isInTelegram || !window.tgApp) {
        console.log('🔍 Not in Telegram environment, skipping Telegram auth');
        return false;
    }
    
    try {
        console.log('🔵 Attempting Telegram authentication...');
        let initData = window.tgApp.getInitData();
        
        // Don't use dev mode fallback in production-like environment
        if (!initData || initData.trim() === '') {
            console.log('❌ No Telegram initData available, cannot authenticate');
            return false;
        }
        
        console.log('Using initData:', initData.substring(0, 50) + '...');
        
        const response = await fetch(`${API_BASE_URL}/telegram/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });
        
        const result = await response.json();
        
        if (result.success && result.isLinked) {
            // Auto-login successful
            window.currentEmployee = result.employee;
            console.log('✅ Telegram auto-login successful:', window.currentEmployee.fullName);
            
            // IMPORTANT: Initialize navigation AFTER successful authentication
            initializeNavigation();
            
            document.getElementById('menuEmployeeName').textContent = window.currentEmployee.fullName;
            document.getElementById('employeeName').textContent = window.currentEmployee.fullName;
            
            showScreen('menu', menuScreen);
            
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
        <h1>Учет рабочего времени</h1>
        <p class="login-subtitle">Привет, ${telegramUser.first_name}!</p>
        <p class="login-subtitle">Введите ваш ИИН для привязки аккаунта Telegram</p>
        
        <form id="linkingForm" class="login-form">
            <div class="form-group">
                <label for="linkEmployeeId" class="form-label">ИИН</label>
                <input type="text" id="linkEmployeeId" class="form-control" placeholder="Например: 951026301078" required>
            </div>
            <button type="submit" class="btn btn--primary btn--full-width">Привязать аккаунт</button>
        </form>
        
        <div style="text-align: center; margin-top: 20px;">
            <button id="skipLinking" class="btn btn--outline">Ввести ИИН каждый раз</button>
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

// Link Telegram account with employee IIN
async function linkTelegramAccount(telegramUser) {
    const employeeIIN = document.getElementById('linkEmployeeId').value;
    
    // Validate that IIN is not empty
    if (!employeeIIN || employeeIIN.trim() === '') {
        const errorMsg = 'Пожалуйста, введите ваш ИИН';
        if (window.tgApp) {
            window.tgApp.showAlert(errorMsg);
        } else {
            alert(errorMsg);
        }
        return;
    }
    
    try {
        let initData = window.tgApp.getInitData();
        
        // Fallback to dev mode if no initData (for testing)
        if (!initData || initData.trim() === '') {
            console.log('No Telegram initData available, using dev mode for testing');
            initData = 'dev_mode';
        }
        
        console.log('Linking account with IIN:', employeeIIN);
        
        const response = await fetch(`${API_BASE_URL}/telegram/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, employeeIIN })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Linking successful - auto login
            window.currentEmployee = result.employee;
            console.log('✅ Telegram account linked and logged in:', window.currentEmployee.fullName);
            
            // IMPORTANT: Initialize navigation AFTER successful authentication
            initializeNavigation();
            
            document.getElementById('menuEmployeeName').textContent = window.currentEmployee.fullName;
            document.getElementById('employeeName').textContent = window.currentEmployee.fullName;
            
            showScreen('menu', menuScreen);
            
            if (window.tgApp) {
                window.tgApp.showAlert(`Аккаунт успешно привязан! Добро пожаловать, ${window.currentEmployee.fullName}`);
            }
            
            console.log('Account linked and logged in:', window.currentEmployee.fullName);
        } else {
            const errorMsg = result.error || 'Ошибка привязки аккаунта';
            console.error('Linking failed:', errorMsg);
            if (window.tgApp) {
                window.tgApp.showAlert(errorMsg);
            } else {
                alert(errorMsg);
            }
        }
    } catch (error) {
        console.error('Account linking error:', error);
        const errorMsg = `Ошибка подключения к серверу: ${error.message}`;
        if (window.tgApp) {
            window.tgApp.showAlert(errorMsg);
        } else {
            alert(errorMsg);
        }
    }
}

// Setup regular login form handler (avoid duplicate listeners)
function setupRegularLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm && !loginForm.hasAttribute('data-handler-attached')) {
        console.log('🔧 Setting up regular login form handler');
        loginForm.addEventListener('submit', handleRegularLogin);
        loginForm.setAttribute('data-handler-attached', 'true');
    }
}

// Show regular login form
function showRegularLoginForm() {
    const loginContent = document.querySelector('.login-content');
    loginContent.innerHTML = `
        <h1>Учет рабочего времени</h1>
        <p class="login-subtitle">Введите ваш ИИН</p>
        
        <form id="loginForm" class="login-form">
            <div class="form-group">
                <label for="employeeId" class="form-label">ИИН</label>
                <input type="text" id="employeeId" class="form-control" placeholder="Например: 951026301078" required>
            </div>
            <button type="submit" class="btn btn--primary btn--full-width">Войти</button>
        </form>
        
        <div id="loginError" class="login-error" style="display: none; color: #dc3545; text-align: center; margin-top: 15px; padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;"></div>
    `;
    
    // Re-attach login handler
    setupRegularLoginForm();
}

// Show login error message
function showLoginError(message) {
    const errorElement = document.getElementById('loginError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Hide login error message
function hideLoginError() {
    const errorElement = document.getElementById('loginError');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// Regular login functionality
async function handleRegularLogin(e) {
    e.preventDefault();
    
    console.log('🔐 handleRegularLogin called');
    
    // Hide any previous error
    hideLoginError();
    
    const iinValue = document.getElementById('employeeId').value;
    
    // CRITICAL: Validate input before processing
    if (!iinValue || iinValue.trim() === '') {
        console.log('❌ Empty IIN value, blocking login');
        showLoginError('Введите ИИН');
        return;
    }
    
    // Check if it's admin password
    if (iinValue === 'admin12qw') {
        // Admin login - keep the original flow
        console.log('Admin login detected');
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableNumber: 'admin12qw' })
            });
            
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Ошибка входа');
                return;
            }
            
            window.currentEmployee = await response.json();
            
            // Prevent admin access in Telegram
            if (isInTelegram) {
                window.tgApp.showAlert('Админ-панель доступна только в веб-версии приложения');
                return;
            }
            
            // Initialize navigation for admin
            initializeNavigation();
            
            // Switch to admin panel
            const adminScreen = document.getElementById('adminScreen');
            showScreen('admin', adminScreen);
            
            // Load admin data
            if (window.initAdminPanel) {
                window.initAdminPanel();
            }
            return;
        } catch (error) {
            console.error('Admin login error:', error);
            showLoginError('Ошибка подключения к серверу: ' + error.message);
            return;
        }
    }
    
    // Don't validate IIN format on client side - let server handle it
    
    console.log('Trying to login with IIN:', iinValue);
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ iin: iinValue })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const error = await response.json();
            showLoginError(error.error || 'Ошибка входа');
            return;
        }
        
        window.currentEmployee = await response.json();
        console.log('✅ Login successful! Current employee:', window.currentEmployee);
        
        // IMPORTANT: Initialize navigation AFTER successful authentication
        initializeNavigation();
        
        // Regular employee - show menu screen
        document.getElementById('menuEmployeeName').textContent = window.currentEmployee.fullName;
        document.getElementById('employeeName').textContent = window.currentEmployee.fullName;
        
        // Switch to menu screen
        showScreen('menu', menuScreen);
        
        console.log('✅ Navigation to menu completed');
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('Ошибка подключения к серверу: ' + error.message);
    }
}

// Initialize the application
async function initApp() {
    // Debug info
    console.log('🚀 App initialization:', {
        platform: currentPlatform,
        isInTelegram,
        hasAdapter: !!platformAdapter,
        hasWindow: !!window,
        hasTgApp: !!window.tgApp,
        userAgent: navigator.userAgent.substring(0, 100),
        location: window.location.href
    });
    
    // Platform-specific initialization
    if (platformAdapter && currentPlatform) {
        console.log(`${currentPlatform} platform detected, trying authentication...`);
        
        // Add platform-specific class to body
        document.body.classList.add(`platform-${currentPlatform}`);
        
        // Platform-specific UI adjustments
        if (currentPlatform === PlatformDetector.PLATFORMS.TELEGRAM || 
            currentPlatform === PlatformDetector.PLATFORMS.IOS) {
            // Show settings card for mobile platforms
            const settingsCard = document.querySelector('.menu-card[data-section="settings"]');
            if (settingsCard) {
                settingsCard.style.display = 'flex';
            }
        }
        
        // Try platform-specific authentication  
        let authSuccess = false;
        
        if (currentPlatform === PlatformDetector.PLATFORMS.TELEGRAM) {
            console.log('🔵 Trying Telegram authentication...');
            authSuccess = await tryTelegramAuth();
        } else if (currentPlatform === PlatformDetector.PLATFORMS.IOS) {
            console.log('🍎 Trying iOS authentication...');
            authSuccess = await tryIOSAuth();
        } else {
            console.log('🌐 Web platform - setting up manual login');
            // For web platform, just setup the login form (if not already done)
            setupRegularLoginForm();
            authSuccess = false; // Don't auto-login for web
        }
        
        if (!authSuccess && currentPlatform !== PlatformDetector.PLATFORMS.WEB) {
            console.log('Platform auth failed, showing regular login form');
            showRegularLoginForm();
        }
    } else if (isInTelegram) {
        // Legacy Telegram mode
        console.log('Telegram mode detected (legacy), trying authentication...');
        document.body.classList.add('in-telegram');
        const settingsCard = document.querySelector('.menu-card[data-section="settings"]');
        if (settingsCard) {
            settingsCard.style.display = 'flex';
        }
        const authSuccess = await tryTelegramAuth();
        if (!authSuccess) {
            console.log('Telegram auth failed, showing regular login form');
            showRegularLoginForm();
        }
    } else {
        console.log('Web browser mode, setting up regular login');
        // Web browser - attach regular login handler
        setupRegularLoginForm();
    }
}

// Try iOS authentication
async function tryIOSAuth() {
    console.log('🍎 Attempting iOS authentication...');
    
    if (!platformAdapter) {
        console.log('No iOS adapter available');
        return false;
    }
    
    try {
        // Get user data from iOS app
        const userData = await platformAdapter.getUserData();
        console.log('iOS user data:', userData);
        
        if (!userData || !userData.iin) {
            console.log('No iOS user data or IIN available');
            return false;
        }
        
        // Try to authenticate with IIN
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                iin: userData.iin,
                platform: 'ios',
                iosToken: userData.token || null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ iOS authentication successful');
            window.currentEmployee = result.employee;
            
            // IMPORTANT: Initialize navigation AFTER successful authentication
            initializeNavigation();
            
            // Update UI
            document.getElementById('menuEmployeeName').textContent = window.currentEmployee.fullName;
            document.getElementById('employeeName').textContent = window.currentEmployee.fullName;
            
            // Navigate to menu
            showScreen('menu', menuScreen);
            
            // Show welcome message
            platformAdapter.showAlert(`Добро пожаловать, ${window.currentEmployee.fullName}!`);
            
            return true;
        } else {
            console.log('iOS authentication failed:', result.error);
            return false;
        }
    } catch (error) {
        console.error('iOS authentication error:', error);
        return false;
    }
}

// Initialize app when DOM is ready (combined with existing DOMContentLoaded)

// Updated navigation functions

// Navigation will be initialized after DOM loads

// Logout functionality for all logout buttons
function logout() {
    console.log('💪 Logout initiated');
    
    // Clear user data
    window.currentEmployee = null;
    
    // Remove navigation handlers to prevent unauthorized access
    document.removeEventListener('click', handleBackNavigation);
    
    // Clear form
    const employeeIdField = document.getElementById('employeeId');
    if (employeeIdField) {
        employeeIdField.value = '';
    }
    
    // Show login screen
    console.log('🚪 LOGOUT: Redirecting to login after logout');
    showScreen('login', loginScreen);
    
    console.log('💪 Logout completed');
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
    
    // Initialize back navigation for department stats screen
    initializeBackNavigation();
    
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
    
    if (!window.currentEmployee) {
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
        
        // Show time based on status
        if (day.status !== 'weekend') {
            const formatTime = (time) => time ? time.substring(0, 5) : '';
            let timeToShow = '';
            
            // For present status, show actual entry/exit time
            if (day.status === 'present' && (day.checkIn || day.checkOut)) {
                // Format ISO timestamp to HH:MM
                const formatTimestamp = (timestamp) => {
                    if (!timestamp) return '';
                    try {
                        return new Date(timestamp).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Almaty'
                        });
                    } catch (error) {
                        return '';
                    }
                };
                
                const entryTime = formatTimestamp(day.checkIn) || '';
                const exitTime = formatTimestamp(day.checkOut) || '—';
                timeToShow = `${entryTime}-${exitTime}`;
            }
            // For planned status or when no actual times, show schedule
            else if (day.scheduleStartTime && day.scheduleEndTime) {
                timeToShow = `${formatTime(day.scheduleStartTime)}-${formatTime(day.scheduleEndTime)}`;
            }
            
            if (timeToShow) {
                dayContent += `
                    <div class="day-schedule" style="font-size: 0.7em; color: #666; margin-top: 2px;">
                        ${timeToShow}
                    </div>
                `;
            }
        }
        
        const statusText = getStatusText(day.status);
        dayContent += `<div class="day-status">${statusText}</div>`;
        
        // Removed debug logging and indicators - status display is now working correctly
        
        dayElement.innerHTML = dayContent;
        
        dayElement.addEventListener('click', () => showDayDetails(day));
        calendar.appendChild(dayElement);
    });
}

// Get status text
function getStatusText(status) {
    const statusMap = {
        // Основные статусы
        'present': 'Присутствие',
        'absent': 'Отсутствие', 
        'planned': 'График',
        'weekend': 'Выходной',
        
        // Детальные статусы
        'on_time': 'Присутствие',
        'late': 'Опоздание',
        'early_leave': 'Ранний уход',
        'no_exit': 'Нет выхода',
        
        // Ночные смены
        'night_shift_on_time': 'Ночная смена',
        'night_shift_late': 'Ночная опоздание',
        'night_shift_auto': 'Ночная авто',
        'night_shift_early_leave': 'Ночная рано',
        
        // Дополнительные
        'weekend_worked': 'Работа в выходной',
        'no_schedule_worked': 'Без графика',
        
        // Возможные варианты, которые могут приходить
        'attendance': 'Присутствие',
        'work': 'Присутствие',  
        'working': 'Присутствие',
        'schedule': 'График',
        'scheduled': 'График'
    };
    
    return statusMap[status] || status;
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
    if (!window.currentEmployee) return;
    
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
    
    if (!window.currentEmployee) {
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
            'present': { text: 'Присутствие', class: 'present' },
            'on_time': { text: 'Вовремя', class: 'on-time' },
            'late': { text: 'Опоздание', class: 'late' },
            'absent': { text: 'Отсутствие', class: 'absent' },
            'weekend': { text: 'Выходной', class: 'weekend' },
            'weekend_worked': { text: 'Работа в выходной', class: 'weekend-worked' },
            'no_schedule_worked': { text: 'Без графика', class: 'no-schedule' },
            'early_leave': { text: 'Ранний уход', class: 'early-leave' },
            'no_exit': { text: 'Нет выхода', class: 'no-exit' },
            'planned': { text: 'Запланировано', class: 'planned' },
            'night_shift_on_time': { text: 'Ночная смена', class: 'night-shift' },
            'night_shift_late': { text: 'Ночная смена (опоздание)', class: 'night-shift-late' },
            'night_shift_auto': { text: 'Ночная смена (авто)', class: 'night-shift-auto' }
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
    // Initialize platform adapter first
    await initializePlatform();
    
    // Export functions to window for compatibility
    window.platformAdapter = platformAdapter;
    window.currentPlatform = currentPlatform;
    // ИСПРАВЛЕНО: Переименовали чтобы не конфликтовать с локальным handleBackNavigation
    window.handleTelegramBackNavigation = () => {
        // CRITICAL FIX: Same logic as platform handlers
        if (currentScreen.name === 'departmentStats') {
            showScreen('main', mainScreen);
        } else {
            goBackToPreviousScreen();
        }
    };
    
    // Set up all modals to close on outside click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // DO NOT initialize navigation yet - wait for authentication
    // Navigation will be initialized after successful login
    
    // Setup news scroll handler
    setupNewsScroll();
    
    // Setup platform back button handler
    if (platformAdapter) {
        const handleBackButton = () => {
            console.log('Platform back button pressed, current:', currentScreen.name, 'previous:', currentScreen.previous);
            
            // CRITICAL FIX: Only handle actual back button presses, not automatic navigation
            // The previous logic was causing automatic returns to menu during normal navigation
            
            // For department stats, go to main
            if (currentScreen.name === 'departmentStats') {
                showScreen('main', mainScreen);
            } 
            // For all other screens, go back to previous screen
            else {
                goBackToPreviousScreen();
            }
        };
        
        // Set up back button handler for platform
        platformAdapter.onBackButtonClick(handleBackButton);
        
        // Also listen for legacy Telegram event
        if (isInTelegram) {
            window.addEventListener('telegram-back-button', handleBackButton);
        }
    } else if (isInTelegram) {
        // Legacy Telegram handler
        window.addEventListener('telegram-back-button', () => {
            console.log('Telegram back button pressed, current:', currentScreen.name, 'previous:', currentScreen.previous);
            
            // CRITICAL FIX: Same fix as above - only handle actual back button presses
            if (currentScreen.name === 'departmentStats') {
                showScreen('main', mainScreen);
            } else {
                goBackToPreviousScreen();
            }
        });
    }
    
    // Setup initial login form if it exists
    setupRegularLoginForm();
    
    // Setup global back navigation handler (once only)
    document.addEventListener('click', handleBackNavigation);
    console.log('🔙 Global back navigation handler installed');
    
    // Initialize the application (Telegram auth or regular login)
    await initApp();
    
    // CRITICAL: Ensure we always start on login screen if not authenticated
    if (!window.currentEmployee) {
        console.log('🔒 No authenticated user - ensuring login screen is shown');
        console.log('🚪 INIT: Redirecting to login - no user authenticated');
        showScreen('login', loginScreen);
    }
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
        const newsUrl = `${API_BASE_URL}/news?page=${newsPage}&limit=10`;
        console.log('🗞️ Loading news from:', newsUrl);
        
        const response = await fetch(newsUrl);
        
        console.log('🗞️ News response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('🗞️ News API error:', response.status, errorText);
            throw new Error(`Failed to load news: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('🗞️ Loaded news data:', data);
        
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
    console.log('🗞️ Rendering news, newsData length:', newsData.length);
    const newsContainer = document.querySelector('.news-container');
    
    if (!newsContainer) {
        console.error('🗞️ News container not found!');
        return;
    }
    
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
    attachNewsEventListeners();
}

// Separate function to attach event listeners to news buttons
function attachNewsEventListeners() {
    console.log('🗞️ Attaching event listeners to news buttons');
    const buttons = document.querySelectorAll('.news-read-more');
    console.log('🗞️ Found', buttons.length, 'news buttons');
    
    buttons.forEach((btn, index) => {
        // Remove any existing listeners first
        btn.replaceWith(btn.cloneNode(true));
        const newBtn = document.querySelectorAll('.news-read-more')[index];
        
        newBtn.addEventListener('click', (e) => {
            const newsId = e.target.dataset.id;
            console.log('🗞️ News button clicked, ID:', newsId);
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
        const newsDetailUrl = `${API_BASE_URL}/news/${newsId}`;
        console.log('🗞️ Loading news details from:', newsDetailUrl);
        
        const response = await fetch(newsDetailUrl);
        
        console.log('🗞️ News details response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('🗞️ News details API error:', response.status, errorText);
            throw new Error(`Failed to load news details: ${response.status} - ${errorText}`);
        }
        
        const news = await response.json();
        console.log('🗞️ Loaded news details:', news);
        
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
            // ИСПРАВЛЕНО: Убираем дублирующий вызов initializeBackNavigation
            // Reset news state and reload completely to ensure event listeners are reattached
            newsPage = 1;
            newsData = [];
            hasMoreNews = true;
            isLoadingNews = false;
            loadNews(true);  // Force full reload with reset=true
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
            // Reset news state for next time
            newsPage = 1;
            newsData = [];
            hasMoreNews = true;
            isLoadingNews = false;
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

// Initialize navigation handlers (only after authentication)
function initializeNavigation() {
    console.log('🔐 Initializing navigation handlers (user authenticated):', !!currentEmployee);
    
    // Only initialize if user is authenticated
    if (!window.currentEmployee) {
        console.log('❌ Cannot initialize navigation - user not authenticated');
        return;
    }
    
    // Menu navigation
    document.querySelectorAll('.menu-card').forEach(card => {
        // Remove any existing listeners first
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        
        newCard.addEventListener('click', async () => {
            // Double-check authentication before any navigation
            if (!window.currentEmployee) {
                console.log('❌ Navigation blocked - user not authenticated');
                console.log('🚪 MENU: Redirecting to login - user not authenticated');
                showScreen('login', loginScreen);
                return;
            }
            
            const section = newCard.dataset.section;
            console.log('🎯 Menu navigation to:', section);
            
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
                    // ИСПРАВЛЕНО: Убираем дублирующий вызов initializeBackNavigation
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
                case 'settings':
                    const settingsScreen = document.getElementById('settingsScreen');
                    showScreen('settings', settingsScreen);
                    await loadSettingsData();
                    break;
            }
        });
    });

    // Back navigation (only for web browser)
    initializeBackNavigation();
}

// Initialize back navigation handlers (safe for multiple calls)
function initializeBackNavigation() {
    console.log('🔙 Initializing back navigation for', isInTelegram ? 'Telegram' : 'Web');
    
    // Only initialize if user is authenticated  
    if (!window.currentEmployee) {
        console.log('🔙 Back navigation not initialized - user not authenticated');
        return;
    }
    
    // CRITICAL FIX: Don't re-attach global click handlers during navigation
    // This was causing conflicts during async operations
    console.log('🔙 Back navigation handlers already initialized globally');
}

// Delegated event handler for back navigation
function handleBackNavigation(e) {
    const btn = e.target.closest('.btn-back, .breadcrumb-item[data-back]');
    if (!btn || !btn.dataset.back) return; // ВАЖНО: Возвращаемся если это не back кнопка
    
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Отключаем для админ-панели
    if (currentScreen.name === 'admin') {
        console.log('🛡️ Back navigation disabled for admin panel');
        return;
    }
    
    // Check authentication before allowing back navigation
    if (!window.currentEmployee) {
        console.log('❌ Back navigation blocked - user not authenticated');
        console.log('🚪 BACK: Redirecting to login - user not authenticated');
        e.preventDefault();
        showScreen('login', loginScreen);
        return;
    }
    
    e.preventDefault();
    const target = btn.dataset.back;
    console.log('🔙 Back button clicked, target:', target);
    
    if (target === 'menu') {
        showScreen('menu', menuScreen);
        // No need to reinitialize navigation here as it's already delegated
    } else if (target === 'main') {
        showScreen('main', mainScreen);
        // ИСПРАВЛЕНО: Убираем дублирующий вызов initializeBackNavigation
    }
}

// Load settings data
async function loadSettingsData() {
    if (!isInTelegram || !currentEmployee) {
        return;
    }
    
    // Update employee info in settings
    document.getElementById('linkedEmployee').textContent = window.currentEmployee.fullName;
    document.getElementById('linkedIIN').textContent = currentEmployee.iin || 'Не указан';
    
    // Setup unlink button
    const unlinkBtn = document.getElementById('unlinkAccountBtn');
    if (unlinkBtn) {
        // Remove existing listeners
        unlinkBtn.replaceWith(unlinkBtn.cloneNode(true));
        const newUnlinkBtn = document.getElementById('unlinkAccountBtn');
        
        newUnlinkBtn.addEventListener('click', async () => {
            await unlinkTelegramAccount();
        });
    }
}

// Unlink Telegram account
async function unlinkTelegramAccount() {
    if (!isInTelegram || !window.tgApp) {
        return;
    }
    
    // Show confirmation
    const confirmed = await new Promise((resolve) => {
        if (window.tgApp.showConfirm) {
            window.tgApp.showConfirm('Вы уверены, что хотите отвязать аккаунт?', resolve);
        } else {
            // Fallback for older Telegram versions
            window.tgApp.showAlert('Подтвердите отвязку аккаунта в следующем диалоге');
            resolve(confirm('Вы уверены, что хотите отвязать аккаунт?'));
        }
    });
    
    if (!confirmed) {
        return;
    }
    
    try {
        let initData = window.tgApp.getInitData();
        
        // Fallback to dev mode if no initData
        if (!initData || initData.trim() === '') {
            initData = 'dev_mode';
        }
        
        console.log('Unlinking Telegram account...');
        
        const response = await fetch(`${API_BASE_URL}/telegram/unlink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success message
            window.tgApp.showAlert('Аккаунт успешно отвязан! Вы будете перенаправлены на экран входа.');
            
            // Clear current employee data
            window.currentEmployee = null;
            
            // Redirect to login screen after a short delay
            setTimeout(() => {
                showRegularLoginForm();
                console.log('🚪 UNLINK: Redirecting to login after account unlink');
                showScreen('login', loginScreen);
            }, 2000);
            
        } else {
            const errorMsg = result.error || 'Ошибка отвязки аккаунта';
            console.error('Unlink failed:', errorMsg);
            window.tgApp.showAlert(errorMsg);
        }
    } catch (error) {
        console.error('Account unlinking error:', error);
        const errorMsg = `Ошибка подключения к серверу: ${error.message}`;
        window.tgApp.showAlert(errorMsg);
    }
}