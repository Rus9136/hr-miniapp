// Admin Panel - Core Module
// Константы, утилиты, общие функции

// API Base URL
const ADMIN_API_BASE_URL = window.API_BASE_URL || (
    window.location.hostname === 'localhost'
        ? 'http://localhost:3030/api'
        : 'https://madlen.space/api'
);

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

// Format datetime (DD.MM.YYYY HH:MM)
function formatDateTime(datetime) {
    if (!datetime) return '-';
    const date = new Date(datetime);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format date (DD.MM.YYYY)
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format time (HH:MM)
function formatTime(datetime) {
    if (!datetime) return '-';
    const date = new Date(datetime);
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format number with thousands separator
function formatNumber(num) {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('ru-RU').format(num);
}

// Format currency (KZT)
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('ru-RU', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount) + ' ₸';
}

// Add search functionality to select element
function addSearchToSelect(selectId, threshold = 10) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Only add search if there are many options
    if (select.options.length < threshold) return;

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'select-search-wrapper';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Поиск...';
    searchInput.className = 'select-search-input';
    wrapper.insertBefore(searchInput, select);

    // Store original options
    const originalOptions = Array.from(select.options);

    // Filter on input
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        select.innerHTML = '';

        originalOptions.forEach(option => {
            if (option.text.toLowerCase().includes(query) || option.value === '') {
                select.appendChild(option.cloneNode(true));
            }
        });
    });
}

// Get day of week name
function getDayOfWeekName(dayNumber) {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return days[dayNumber] || '';
}

// Export to window for global access
window.ADMIN_API_BASE_URL = ADMIN_API_BASE_URL;
window.showNotification = showNotification;
window.formatDateTime = formatDateTime;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatNumber = formatNumber;
window.formatCurrency = formatCurrency;
window.addSearchToSelect = addSearchToSelect;
window.getDayOfWeekName = getDayOfWeekName;
