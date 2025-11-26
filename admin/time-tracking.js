// Admin Panel - Time Tracking Module
// Управление событиями времени (входы/выходы)

// Local data storage
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

    // Set default dates
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    document.getElementById('events-date-from').value = firstDay.toISOString().split('T')[0];
    document.getElementById('events-date-to').value = today.toISOString().split('T')[0];

    // Load organizations and departments for filters
    loadOrganizationsForTimeEvents();
    loadDepartmentsForTimeEventsFilter();

    // Event listeners
    document.getElementById('events-filter-btn').addEventListener('click', loadTimeEvents);
    document.getElementById('events-clear-btn').addEventListener('click', clearEventsFilter);

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
    const eventType = document.getElementById('events-type-filter').value;
    const dateFrom = document.getElementById('events-date-from').value;
    const dateTo = document.getElementById('events-date-to').value;

    if (organization) params.append('organization', organization);
    if (department) params.append('department', department);
    if (eventType) params.append('eventType', eventType);
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Нет данных</td></tr>';
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
                <td>${event.position_name || '-'}</td>
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
    document.getElementById('events-type-filter').value = '';

    // Reset to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    document.getElementById('events-date-from').value = firstDay.toISOString().split('T')[0];
    document.getElementById('events-date-to').value = today.toISOString().split('T')[0];

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

// Export to window for global access
window.initTimeEventsSection = initTimeEventsSection;
window.loadTimeEvents = loadTimeEvents;
window.displayTimeEvents = displayTimeEvents;
window.clearEventsFilter = clearEventsFilter;
window.clearAllTimeEvents = clearAllTimeEvents;
window.loadOrganizationsForTimeEvents = loadOrganizationsForTimeEvents;
window.loadDepartmentsForTimeEventsFilter = loadDepartmentsForTimeEventsFilter;
window.onTimeEventsOrganizationChange = onTimeEventsOrganizationChange;
