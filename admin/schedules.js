// Admin Panel - Schedules Module
// Управление графиками работы и назначениями

// Local data storage
let schedulesData = [];
let organizationsDict = {}; // Dictionary: { bin: name }
let scheduleRuleIndex = 1;
let schedulesInitialized = false;
let currentScheduleCode = null;
let scheduleCardInitialized = false;
let scheduleAssignInitialized = false;
let availableEmployees = [];
let selectedEmployeeIds = new Set();

// Pagination state
let schedulesCurrentPage = 1;
let schedulesTotalPages = 1;
let schedulesPageSize = 50;
let schedulesTotal = 0;

// ==================== SCHEDULES LIST ====================

// Initialize schedules section
function initSchedulesSection() {
    console.log('initSchedulesSection called, initialized:', schedulesInitialized);

    if (schedulesInitialized) {
        loadSchedules();
        return;
    }

    setTimeout(() => {
        schedulesInitialized = true;
        loadSchedules();
    }, 200);
}

// Load schedules from 1C with pagination
async function loadSchedules(page = 1) {
    const tbody = document.getElementById('schedules-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="loading">Загрузка данных...</td></tr>';

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/schedules/1c/list?page=${page}&limit=${schedulesPageSize}`);
        if (!response.ok) throw new Error('Failed to load schedules');

        const data = await response.json();

        // Store organizations dictionary and schedules
        organizationsDict = data.organizations || {};
        schedulesData = data.schedules || [];

        // Update pagination state
        if (data.pagination) {
            schedulesCurrentPage = data.pagination.page;
            schedulesTotalPages = data.pagination.totalPages;
            schedulesTotal = data.pagination.total;
        }

        // Load organizations for filter (uses stored dictionary)
        await loadScheduleOrganizations();

        displaySchedules(schedulesData);

        // Update total count display
        const totalSpan = document.getElementById('schedules-total');
        if (totalSpan) {
            totalSpan.textContent = schedulesTotal;
        }

        // Render pagination controls
        renderSchedulesPagination();

        // Initialize search functionality
        initSchedulesSearch();
    } catch (error) {
        console.error('Error loading schedules:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display schedules from 1C
function displaySchedules(schedules) {
    const tbody = document.getElementById('schedules-tbody');
    const searchValue = document.getElementById('schedules-search')?.value.toLowerCase() || '';
    const orgFilter = document.getElementById('schedules-organization-filter')?.value || '';

    // Filter schedules based on search and organization
    const filteredSchedules = schedules.filter(schedule => {
        const matchesSearch = !searchValue || schedule.schedule_name.toLowerCase().includes(searchValue);
        let matchesOrg = true;
        if (orgFilter) {
            const orgBins = schedule.org_bins || [];
            matchesOrg = orgBins.includes(orgFilter);
        }
        return matchesSearch && matchesOrg;
    });

    // Update filtered count (show current page info)
    const totalSpan = document.getElementById('schedules-total');
    if (totalSpan) {
        if (searchValue || orgFilter) {
            totalSpan.innerHTML = `${filteredSchedules.length} <span style="color: #6c757d;">(из ${schedulesTotal})</span>`;
        } else {
            totalSpan.textContent = schedulesTotal;
        }
    }

    if (filteredSchedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = filteredSchedules.map(schedule => {
        const orgBins = schedule.org_bins || [];
        let orgDisplay = '';

        if (orgBins.length > 0) {
            // Get organization names from dictionary
            const orgs = orgBins.map(bin => ({
                organization_name: organizationsDict[bin] || 'Неизвестно',
                organization_bin: bin
            }));

            if (orgs.length === 1) {
                orgDisplay = `<small class="text-muted">${orgs[0].organization_name}<br><small>(${orgs[0].organization_bin})</small></small>`;
            } else if (orgs.length <= 3) {
                orgDisplay = orgs.map(org => `<div style="margin-bottom: 4px;"><small class="text-muted">${org.organization_name} <small>(${org.organization_bin})</small></small></div>`).join('');
            } else {
                orgDisplay = orgs.slice(0, 2).map(org => `<div style="margin-bottom: 4px;"><small class="text-muted">${org.organization_name} <small>(${org.organization_bin})</small></small></div>`).join('') +
                    `<div><small class="text-muted" style="font-style: italic;">и ещё ${orgs.length - 2} организаций</small></div>`;
            }
        } else {
            orgDisplay = '<small class="text-muted">Не указано</small>';
        }

        return `
            <tr>
                <td>${schedule.schedule_name}</td>
                <td>${orgDisplay}</td>
                <td>
                    <button class="btn btn--sm btn--primary" onclick="openScheduleCard('${schedule.schedule_code}')">Открыть</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Load organizations for schedules filter (uses organizationsDict)
async function loadScheduleOrganizations() {
    try {
        const select = document.getElementById('schedules-organization-filter');

        if (select) {
            // Clear and add default option
            select.innerHTML = '<option value="">Все организации</option>';

            // Use organizations from the dictionary (already loaded from API)
            const orgBins = Object.keys(organizationsDict).sort((a, b) => {
                return (organizationsDict[a] || '').localeCompare(organizationsDict[b] || '');
            });

            orgBins.forEach(bin => {
                const name = organizationsDict[bin];
                const option = document.createElement('option');
                option.value = bin;
                option.textContent = `${name} (${bin})`;
                select.appendChild(option);
            });

            // Only add change handler once
            if (!select.hasAttribute('data-initialized')) {
                select.setAttribute('data-initialized', 'true');
                select.addEventListener('change', () => {
                    displaySchedules(schedulesData);
                });
            }

            console.log('Schedule organizations filter populated with', orgBins.length, 'options');
        }
    } catch (error) {
        console.error('Error loading organizations for schedules filter:', error);
    }
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
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                displaySchedules(schedulesData);
            }
        });
    }
}

// ==================== SCHEDULE CARD ====================

// Open schedule card
function openScheduleCard(scheduleCode) {
    console.log('openScheduleCard called with scheduleCode:', scheduleCode);

    currentScheduleCode = scheduleCode;
    switchSection('schedule-card');

    setTimeout(() => {
        const titleElement = document.getElementById('schedule-card-title');
        if (titleElement) {
            if (scheduleCode) {
                titleElement.textContent = 'График работы из 1С';
                loadScheduleCard1C(scheduleCode);
            } else {
                titleElement.textContent = 'Ошибка загрузки графика';
            }
        }
    }, 200);
}

// Initialize schedule card section
function initScheduleCardSection() {
    if (scheduleCardInitialized) return;

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

    const applyTimesBtn = document.getElementById('apply-times-btn');
    if (applyTimesBtn) {
        applyTimesBtn.addEventListener('click', applyTimesToAllDays);
    }

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

        // Show organizations info - collapsible dropdown
        const orgInfoSection = document.getElementById('schedule-organization-info');
        const orgElement = document.getElementById('schedule-card-organization');
        if (orgInfoSection && orgElement) {
            const organizations = firstSchedule.organizations || [];

            if (organizations.length > 0) {
                const orgListItems = organizations.map(org => `
                    <div class="org-dropdown-item">
                        <span class="org-name">${org.organization_name || 'Название не указано'}</span>
                        ${org.organization_bin ? `<span class="org-bin">БИН: ${org.organization_bin}</span>` : ''}
                    </div>
                `).join('');
                
                const countText = organizations.length === 1 
                    ? '1 организация' 
                    : organizations.length < 5 
                        ? `${organizations.length} организации` 
                        : `${organizations.length} организаций`;
                
                orgElement.innerHTML = `
                    <details class="org-collapsible">
                        <summary class="org-collapsible-header">
                            <span class="org-count">${countText}</span>
                            <span class="org-toggle-icon">▼</span>
                        </summary>
                        <div class="org-collapsible-content">
                            ${orgListItems}
                        </div>
                    </details>
                `;
                orgInfoSection.style.display = 'block';
            } else if (firstSchedule.organization_name || firstSchedule.organization_bin) {
                orgElement.innerHTML = `
                    <details class="org-collapsible">
                        <summary class="org-collapsible-header">
                            <span class="org-count">1 организация</span>
                            <span class="org-toggle-icon">▼</span>
                        </summary>
                        <div class="org-collapsible-content">
                            <div class="org-dropdown-item">
                                <span class="org-name">${firstSchedule.organization_name || 'Название не указано'}</span>
                                ${firstSchedule.organization_bin ? `<span class="org-bin">БИН: ${firstSchedule.organization_bin}</span>` : ''}
                            </div>
                        </div>
                    </details>
                `;
                orgInfoSection.style.display = 'block';
            } else {
                orgElement.innerHTML = '<div class="org-empty">Информация об организациях недоступна</div>';
                orgInfoSection.style.display = 'block';
            }
        }

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
            checkInElement.readOnly = false;
        }
        if (checkOutElement) {
            checkOutElement.value = firstSchedule.work_end_time || '';
            checkOutElement.readOnly = false;
        }

        // Hide description section for 1C schedules
        const descriptionSection = document.getElementById('schedule-description-section');
        if (descriptionSection) {
            descriptionSection.style.display = 'none';
        }

        // Display work dates from 1C
        displayWorkDates1C(schedules);

        // Hide employee assignment section for 1C schedules
        const employeeSection = document.querySelector('.schedule-employees-section');
        if (employeeSection) {
            employeeSection.style.display = 'none';
        }

        // Hide save and add date buttons for 1C schedules
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
        }
    });

    displayWorkDates([]);
    displayAssignedEmployees([]);
}

// Add work date to schedule
function addWorkDate() {
    const tbody = document.getElementById('work-dates-tbody');

    if (tbody.querySelector('.new-date-row')) {
        return;
    }

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
    document.getElementById('temp-date-input').focus();

    document.getElementById('temp-date-input').addEventListener('change', function () {
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

    const tbody = document.getElementById('work-dates-tbody');
    const existingDates = Array.from(tbody.querySelectorAll('tr:not(.new-date-row)'))
        .map(row => row.querySelector('td')?.textContent)
        .filter(date => date && date !== 'Нет рабочих дней');

    if (existingDates.includes(formatDate(newDate))) {
        alert('Эта дата уже добавлена');
        return;
    }

    cancelAddDate();

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

    const name = document.getElementById('schedule-card-name').value.trim();
    const checkIn = document.getElementById('schedule-card-check-in').value;
    const checkOut = document.getElementById('schedule-card-check-out').value;

    if (!name || !checkIn || !checkOut) {
        alert('Заполните все обязательные поля');
        return;
    }

    const scheduleId = document.getElementById('schedule-card-id').value;
    const formData = {
        name: name,
        description: document.getElementById('schedule-card-description').value,
        check_in_time: checkIn,
        check_out_time: checkOut,
        dates: getWorkDatesFromTable()
    };

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
    if (displayDate.includes('.')) {
        const parts = displayDate.split('.');
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return displayDate;
}

// Validate schedule card
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

    if (!startTime || !endTime) {
        alert('Пожалуйста, заполните оба поля времени (вход и выход)');
        return;
    }

    if (!currentScheduleCode) {
        alert('Ошибка: не найден код графика');
        return;
    }

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
            loadScheduleCard1C(currentScheduleCode);
        } else {
            alert(`Ошибка: ${result.message || 'Неизвестная ошибка'}`);
        }

    } catch (error) {
        console.error('Error applying times:', error);
        alert('Ошибка при применении времени: ' + error.message);
    }
}

// ==================== SCHEDULE ASSIGNMENT ====================

// Initialize schedule assignment section
function initScheduleAssignSection() {
    if (scheduleAssignInitialized) {
        loadAssignmentData();
        return;
    }

    document.getElementById('assign-template-select').addEventListener('change', handleTemplateSelect);
    document.getElementById('assign-organization-filter').addEventListener('change', handleAssignOrganizationChange);
    document.getElementById('assign-filter-btn').addEventListener('click', loadAvailableEmployees);
    document.getElementById('assign-header-checkbox').addEventListener('change', handleSelectAllEmployees);
    document.getElementById('assign-select-all').addEventListener('change', handleSelectAllEmployees);
    document.getElementById('assign-submit-btn').addEventListener('click', handleScheduleAssignment);

    document.getElementById('assign-start-date').value = new Date().toISOString().split('T')[0];

    scheduleAssignInitialized = true;
    loadAssignmentData();
}

// Load assignment data
async function loadAssignmentData() {
    loadScheduleTemplates();
    loadAssignOrganizations();
    loadAssignDepartments();
    loadAssignPositions();
}

// Load schedule templates for dropdown
async function loadScheduleTemplates() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/schedules/templates`);
        if (!response.ok) throw new Error('Failed to load templates');

        const templates = await response.json();
        const select = document.getElementById('assign-template-select');

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

    document.getElementById('assign-header-checkbox').checked = isChecked;
    document.getElementById('assign-select-all').checked = isChecked;

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

            selectedEmployeeIds.clear();
            document.getElementById('assign-header-checkbox').checked = false;
            document.getElementById('assign-select-all').checked = false;

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

// ==================== PAGINATION ====================

// Render pagination controls
function renderSchedulesPagination() {
    const container = document.getElementById('schedules-pagination');
    if (!container) return;

    // If only one page, hide pagination
    if (schedulesTotalPages <= 1) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    const prevBtn = container.querySelector('#schedules-prev');
    const nextBtn = container.querySelector('#schedules-next');
    const pageInfo = container.querySelector('#schedules-page-info');

    if (pageInfo) {
        pageInfo.textContent = `Страница ${schedulesCurrentPage} из ${schedulesTotalPages}`;
    }

    if (prevBtn) {
        prevBtn.disabled = schedulesCurrentPage <= 1;
        prevBtn.onclick = () => goToSchedulesPage(schedulesCurrentPage - 1);
    }

    if (nextBtn) {
        nextBtn.disabled = schedulesCurrentPage >= schedulesTotalPages;
        nextBtn.onclick = () => goToSchedulesPage(schedulesCurrentPage + 1);
    }
}

// Go to specific page
function goToSchedulesPage(page) {
    if (page < 1 || page > schedulesTotalPages) return;
    loadSchedules(page);
}

// Export to window for global access
window.initSchedulesSection = initSchedulesSection;
window.loadSchedules = loadSchedules;
window.displaySchedules = displaySchedules;
window.renderSchedulesPagination = renderSchedulesPagination;
window.goToSchedulesPage = goToSchedulesPage;
window.openScheduleCard = openScheduleCard;
window.initScheduleCardSection = initScheduleCardSection;
window.loadScheduleCard1C = loadScheduleCard1C;
window.displayWorkDates1C = displayWorkDates1C;
window.clearScheduleCard = clearScheduleCard;
window.addWorkDate = addWorkDate;
window.confirmAddDate = confirmAddDate;
window.cancelAddDate = cancelAddDate;
window.removeWorkDate = removeWorkDate;
window.saveScheduleCard = saveScheduleCard;
window.displayWorkDates = displayWorkDates;
window.displayAssignedEmployees = displayAssignedEmployees;
window.validateScheduleCard = validateScheduleCard;
window.applyTimesToAllDays = applyTimesToAllDays;
window.initScheduleAssignSection = initScheduleAssignSection;
window.loadAvailableEmployees = loadAvailableEmployees;
window.displayAvailableEmployees = displayAvailableEmployees;
window.handleEmployeeSelection = handleEmployeeSelection;
window.handleSelectAllEmployees = handleSelectAllEmployees;
window.updateSelectedCount = updateSelectedCount;
window.updateAssignButtonState = updateAssignButtonState;
window.handleScheduleAssignment = handleScheduleAssignment;
