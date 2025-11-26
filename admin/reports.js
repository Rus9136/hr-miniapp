// Admin Panel - Reports Module (Unified with Tabs)
// Все отчёты: входы/выходы, опоздания, вне графика, перелимит ФОТ, выручка к ФОТ

// ==================== INITIALIZATION FLAGS ====================
let reportsTabsInitialized = false;
let timeEventsTabInitialized = false;
let lateEmployeesTabInitialized = false;
let offScheduleTabInitialized = false;
let payrollOvertimeTabInitialized = false;
let revenueToPayrollTabInitialized = false;

// ==================== DATA STORAGE ====================
let adminTimeEventsData = [];
let revenueToPayrollChart = null;

// ==================== MAIN REPORTS SECTION INIT ====================

function initReportsSection() {
    console.log('initReportsSection called');
    
    if (!reportsTabsInitialized) {
        // Setup tab switching
        setupReportsTabs();
        reportsTabsInitialized = true;
    }
    
    // Initialize the first (active) tab
    initTimeEventsTab();
}

// Setup tab switching logic
function setupReportsTabs() {
    const tabButtons = document.querySelectorAll('.reports-tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tab;
            switchReportsTab(tabId);
        });
    });
}

// Switch between report tabs
function switchReportsTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // Update button states
    document.querySelectorAll('.reports-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    // Update pane visibility
    document.querySelectorAll('.reports-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });
    
    // Initialize tab content (lazy loading)
    switch (tabId) {
        case 'time-events':
            initTimeEventsTab();
            break;
        case 'late-employees':
            initLateEmployeesTab();
            break;
        case 'off-schedule':
            initOffScheduleTab();
            break;
        case 'payroll-overtime':
            initPayrollOvertimeTab();
            break;
        case 'revenue-payroll':
            initRevenueToPayrollTab();
            break;
    }
}

// ==================== TAB: TIME EVENTS (Входы/выходы) ====================

function initTimeEventsTab() {
    if (timeEventsTabInitialized) {
        loadTimeEvents();
        return;
    }

    // Set default dates
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const dateFrom = document.getElementById('events-date-from');
    const dateTo = document.getElementById('events-date-to');
    
    if (dateFrom) dateFrom.value = firstDay.toISOString().split('T')[0];
    if (dateTo) dateTo.value = today.toISOString().split('T')[0];

    // Load organizations and departments for filters
    loadOrganizationsForTimeEvents();
    loadDepartmentsForTimeEventsFilter();

    // Event listeners
    const filterBtn = document.getElementById('events-filter-btn');
    const clearBtn = document.getElementById('events-clear-btn');
    const orgFilter = document.getElementById('events-organization-filter');

    if (filterBtn) filterBtn.addEventListener('click', loadTimeEvents);
    if (clearBtn) clearBtn.addEventListener('click', clearEventsFilter);
    if (orgFilter) orgFilter.addEventListener('change', onTimeEventsOrganizationChange);

    timeEventsTabInitialized = true;

    // Load initial data
    loadTimeEvents();
}

async function loadOrganizationsForTimeEvents() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error(`Failed to load organizations: ${response.status}`);

        const organizations = await response.json();
        const select = document.getElementById('events-organization-filter');
        
        if (!select) return;

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
        console.error('Error loading organizations for time events:', error);
    }
}

function onTimeEventsOrganizationChange() {
    const organizationBin = document.getElementById('events-organization-filter').value;
    document.getElementById('events-department-filter').value = '';
    loadDepartmentsForTimeEventsFilter(organizationBin || null);
}

async function loadDepartmentsForTimeEventsFilter(organizationBin = null) {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        if (!response.ok) throw new Error('Failed to load departments');

        const allDepartments = await response.json();
        const departments = organizationBin
            ? allDepartments.filter(dept => dept.object_bin === organizationBin)
            : allDepartments;

        const departmentFilter = document.getElementById('events-department-filter');
        if (!departmentFilter) return;

        while (departmentFilter.children.length > 1) {
            departmentFilter.removeChild(departmentFilter.lastChild);
        }

        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.object_code;
            option.textContent = dept.object_name;
            departmentFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading departments for time events filter:', error);
    }
}

async function loadTimeEvents() {
    const tbody = document.getElementById('time-events-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Загрузка данных...</td></tr>';

    const params = new URLSearchParams();
    const organization = document.getElementById('events-organization-filter')?.value;
    const department = document.getElementById('events-department-filter')?.value;
    const eventType = document.getElementById('events-type-filter')?.value;
    const dateFrom = document.getElementById('events-date-from')?.value;
    const dateTo = document.getElementById('events-date-to')?.value;

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
        
        const totalEl = document.getElementById('events-total');
        if (totalEl) totalEl.textContent = adminTimeEventsData.length;
    } catch (error) {
        console.error('Error loading time events:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

function displayTimeEvents(events) {
    const tbody = document.getElementById('time-events-tbody');
    if (!tbody) return;

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

function clearEventsFilter() {
    const orgFilter = document.getElementById('events-organization-filter');
    const deptFilter = document.getElementById('events-department-filter');
    const typeFilter = document.getElementById('events-type-filter');
    
    if (orgFilter) orgFilter.value = '';
    if (deptFilter) deptFilter.value = '';
    if (typeFilter) typeFilter.value = '';

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const dateFrom = document.getElementById('events-date-from');
    const dateTo = document.getElementById('events-date-to');
    
    if (dateFrom) dateFrom.value = firstDay.toISOString().split('T')[0];
    if (dateTo) dateTo.value = today.toISOString().split('T')[0];

    loadDepartmentsForTimeEventsFilter();
    loadTimeEvents();
}

// ==================== TAB: LATE EMPLOYEES (Опоздания) ====================

function initLateEmployeesTab() {
    if (lateEmployeesTabInitialized) return;

    const today = new Date().toISOString().split('T')[0];
    const dateFilter = document.getElementById('report-date-filter');
    if (dateFilter) dateFilter.value = today;

    loadOrganizationsForReports();
    loadDepartmentsForReports();

    const generateBtn = document.getElementById('generate-report-btn');
    const clearBtn = document.getElementById('clear-report-btn');
    const orgFilter = document.getElementById('report-organization-filter');

    if (generateBtn) generateBtn.addEventListener('click', generateLateEmployeesReport);
    if (clearBtn) clearBtn.addEventListener('click', clearReportFilters);
    if (orgFilter) orgFilter.addEventListener('change', onReportOrganizationChange);

    lateEmployeesTabInitialized = true;
    clearReportTable();
}

async function loadOrganizationsForReports() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/organizations`);
        if (!response.ok) throw new Error('Failed to load organizations');

        const result = await response.json();
        const organizations = result.data || [];

        const select = document.getElementById('report-organization-filter');
        if (!select) return;

        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.organization;
            option.textContent = `${org.company_name || org.organization} (${org.organization})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading organizations for reports:', error);
    }
}

async function loadDepartmentsForReports(organization = null) {
    try {
        const params = new URLSearchParams();
        if (organization && organization.trim() !== '') {
            params.append('organization', organization);
        }

        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/departments?${params}`);
        if (!response.ok) throw new Error('Failed to load departments');

        const result = await response.json();
        const departments = result.data || [];

        const select = document.getElementById('report-department-filter');
        if (!select) return;

        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading departments for reports:', error);
    }
}

function onReportOrganizationChange() {
    const organization = document.getElementById('report-organization-filter').value;
    document.getElementById('report-department-filter').value = '';
    loadDepartmentsForReports(organization || null);
}

async function generateLateEmployeesReport() {
    const generateBtn = document.getElementById('generate-report-btn');
    const spinner = generateBtn?.querySelector('.spinner');
    const btnText = generateBtn?.querySelector('.btn-text');

    if (spinner) spinner.style.display = 'inline';
    if (btnText) btnText.textContent = 'Формирование отчета...';
    if (generateBtn) generateBtn.disabled = true;

    const tbody = document.getElementById('reports-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading">Формирование отчета...</td></tr>';

    const params = new URLSearchParams();
    const date = document.getElementById('report-date-filter')?.value;
    const organization = document.getElementById('report-organization-filter')?.value;
    const department = document.getElementById('report-department-filter')?.value;

    if (date) params.append('date', date);
    if (organization) params.append('organization', organization);
    if (department) params.append('department', department);

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/late-employees?${params}`);
        if (!response.ok) throw new Error('Failed to generate late employees report');

        const result = await response.json();
        displayLateEmployeesReport(result.data);
        
        const totalEl = document.getElementById('report-total');
        if (totalEl) totalEl.textContent = result.total_count;
    } catch (error) {
        console.error('Error generating late employees report:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc3545;">Ошибка формирования отчета</td></tr>';
        const totalEl = document.getElementById('report-total');
        if (totalEl) totalEl.textContent = '0';
    } finally {
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.textContent = 'Сформировать отчет';
        if (generateBtn) generateBtn.disabled = false;
    }
}

function displayLateEmployeesReport(employees) {
    const tbody = document.getElementById('reports-tbody');
    if (!tbody) return;

    if (!employees || employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #28a745;">Опоздавших сотрудников не найдено</td></tr>';
        return;
    }

    tbody.innerHTML = employees.map(employee => {
        const statusClass = employee.status === 'late' ? 'status-late' : 'status-absent';
        const offScheduleBadge = employee.is_off_schedule
            ? '<span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Вне графика</span>'
            : '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">По графику</span>';
        return `
            <tr>
                <td>${employee.employee_name}</td>
                <td>${employee.department_name}</td>
                <td>${employee.schedule_name || '-'}</td>
                <td>${employee.schedule_start_time || '-'}</td>
                <td>${employee.actual_entry_time}</td>
                <td><span class="${statusClass}">${employee.late_time_formatted}</span></td>
                <td>${offScheduleBadge}</td>
            </tr>
        `;
    }).join('');
}

function clearReportTable() {
    const tbody = document.getElementById('reports-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #6c757d;">Выберите дату и нажмите "Сформировать отчет"</td></tr>';
    
    const totalEl = document.getElementById('report-total');
    if (totalEl) totalEl.textContent = '0';
}

function clearReportFilters() {
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = document.getElementById('report-date-filter');
    const orgFilter = document.getElementById('report-organization-filter');
    const deptFilter = document.getElementById('report-department-filter');
    
    if (dateFilter) dateFilter.value = today;
    if (orgFilter) orgFilter.value = '';
    if (deptFilter) deptFilter.value = '';
    
    loadDepartmentsForReports();
    clearReportTable();
}

// ==================== TAB: OFF-SCHEDULE (Вне графика) ====================

function initOffScheduleTab() {
    if (offScheduleTabInitialized) return;

    loadOffScheduleOrganizations();

    const generateBtn = document.getElementById('load-off-schedule-report-btn');
    const clearBtn = document.getElementById('clear-off-schedule-report-btn');

    if (generateBtn) generateBtn.addEventListener('click', loadOffScheduleReport);
    if (clearBtn) clearBtn.addEventListener('click', clearOffScheduleReport);

    const dateInput = document.getElementById('off-schedule-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    offScheduleTabInitialized = true;
}

async function loadOffScheduleOrganizations() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error('Failed to load organizations');

        const organizations = await response.json();
        const orgFilter = document.getElementById('off-schedule-organization-filter');

        if (orgFilter) {
            orgFilter.innerHTML = '<option value="">Все организации</option>';
            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.object_company;
                option.textContent = org.object_company;
                orgFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading organizations for off-schedule:', error);
    }
}

async function loadOffScheduleReport() {
    const dateInput = document.getElementById('off-schedule-date');
    const orgFilter = document.getElementById('off-schedule-organization-filter');
    const generateBtn = document.getElementById('load-off-schedule-report-btn');
    const spinner = generateBtn?.querySelector('.spinner');
    const btnText = generateBtn?.querySelector('.btn-text');

    if (!dateInput?.value) {
        alert('Пожалуйста, выберите дату для отчета');
        return;
    }

    if (generateBtn) generateBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline';
    if (btnText) btnText.style.display = 'none';

    try {
        const params = new URLSearchParams({ date: dateInput.value });
        if (orgFilter?.value) params.append('organization', orgFilter.value);

        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/off-schedule-attendance?${params}`);
        if (!response.ok) throw new Error('Failed to load report');

        const result = await response.json();
        displayOffScheduleReport(result);
    } catch (error) {
        console.error('Error loading off-schedule report:', error);
        alert('Ошибка при загрузке отчета: ' + error.message);
    } finally {
        if (generateBtn) generateBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.display = 'inline';
    }
}

function displayOffScheduleReport(result) {
    const tbody = document.getElementById('off-schedule-report-body');
    const totalSpan = document.getElementById('off-schedule-total');

    if (totalSpan) totalSpan.textContent = result.totalCount || 0;
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!result.records || result.records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #28a745;">Никто не пришел в выходной день</td></tr>';
        return;
    }

    result.records.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.date}</td>
            <td>${record.employeeName}</td>
            <td>${record.positionName}</td>
            <td>${record.organizationName}</td>
            <td>${record.departmentName}</td>
            <td>${record.scheduleName}</td>
            <td><span style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px;">${record.scheduleType}</span></td>
            <td>${record.entryTime}</td>
        `;
        tbody.appendChild(row);
    });
}

function clearOffScheduleReport() {
    const tbody = document.getElementById('off-schedule-report-body');
    const totalSpan = document.getElementById('off-schedule-total');
    const dateInput = document.getElementById('off-schedule-date');
    const orgFilter = document.getElementById('off-schedule-organization-filter');

    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Выберите дату и нажмите "Сформировать отчет"</td></tr>';
    if (totalSpan) totalSpan.textContent = '0';
    if (orgFilter) orgFilter.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

// ==================== TAB: PAYROLL OVERTIME (Перелимит ФОТ) ====================

function initPayrollOvertimeTab() {
    if (payrollOvertimeTabInitialized) return;

    loadPayrollOvertimeOrganizations();

    const generateBtn = document.getElementById('load-overtime-report-btn');
    const clearBtn = document.getElementById('clear-overtime-report-btn');

    if (generateBtn) generateBtn.addEventListener('click', loadPayrollOvertimeReport);
    if (clearBtn) clearBtn.addEventListener('click', clearPayrollOvertimeReport);

    const dateInput = document.getElementById('overtime-date-filter');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    payrollOvertimeTabInitialized = true;
}

async function loadPayrollOvertimeOrganizations() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error('Failed to load organizations');

        const organizations = await response.json();
        const select = document.getElementById('overtime-organization-filter');

        if (select) {
            select.innerHTML = '<option value="">Все организации</option>';
            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.object_bin;
                option.textContent = `${org.object_company} (${org.object_bin})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading overtime organizations:', error);
    }
}

async function loadPayrollOvertimeReport() {
    const dateInput = document.getElementById('overtime-date-filter');
    const orgFilter = document.getElementById('overtime-organization-filter');
    const generateBtn = document.getElementById('load-overtime-report-btn');
    const spinner = generateBtn?.querySelector('.spinner');
    const btnText = generateBtn?.querySelector('.btn-text');

    if (!dateInput?.value) {
        alert('Пожалуйста, выберите дату');
        return;
    }

    if (generateBtn) generateBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline';
    if (btnText) btnText.style.display = 'none';

    try {
        const params = new URLSearchParams({ date: dateInput.value });
        if (orgFilter?.value) params.append('organization', orgFilter.value);

        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/payroll-overtime?${params}`);
        if (!response.ok) throw new Error('Failed to load report');

        const result = await response.json();
        renderPayrollOvertimeReport(result);
    } catch (error) {
        console.error('Error loading overtime report:', error);
        alert('Ошибка при загрузке отчета: ' + error.message);
    } finally {
        if (generateBtn) generateBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.display = 'inline';
    }
}

function renderPayrollOvertimeReport(data) {
    const container = document.getElementById('overtime-results-container');
    const totalSpan = document.getElementById('overtime-departments-total');

    if (!container) {
        console.error('Overtime results container not found');
        return;
    }

    if (totalSpan) {
        totalSpan.textContent = data.departments?.length || 0;
    }

    if (!data.departments || data.departments.length === 0) {
        container.innerHTML = `
            <div class="table-container">
                <div class="text-center" style="padding: 40px; color: #6c757d;">
                    📋 Нет данных для отображения. Возможно, на выбранную дату нет плановых или фактических данных.
                </div>
            </div>
        `;
        return;
    }

    let html = `
        <div class="overtime-report" style="margin-top: 20px;">
            <div class="report-header" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #495057;">Отчет за ${data.date}</h3>
                <p style="margin: 0; color: #6c757d;">Организация: ${data.organization}</p>
            </div>
    `;

    data.departments.forEach(dept => {
        const summaryClass = dept.summary.difference > 0 ? 'overtime-cell' :
                           dept.summary.difference < 0 ? 'savings-cell' : 'neutral-cell';

        html += `
            <div class="department-block" style="margin-bottom: 30px;">
                <h4 style="background: #007bff; color: white; padding: 10px; border-radius: 4px; margin: 0 0 10px 0;">
                    📂 ${dept.departmentName}
                </h4>
                <table class="admin-table overtime-table">
                    <thead>
                        <tr>
                            <th rowspan="2" style="vertical-align: middle;">Должность</th>
                            <th colspan="2" style="text-align: center; background: #e7f3ff;">План (по графику)</th>
                            <th colspan="2" style="text-align: center; background: #fff3cd;">Факт (реально вышли)</th>
                            <th rowspan="2" style="vertical-align: middle;">Разница ФОТ (₸)</th>
                        </tr>
                        <tr>
                            <th style="background: #e7f3ff;">Кол-во</th>
                            <th style="background: #e7f3ff;">ФОТ (₸)</th>
                            <th style="background: #fff3cd;">Кол-во</th>
                            <th style="background: #fff3cd;">ФОТ (₸)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        dept.positions.forEach(pos => {
            const diffClass = pos.difference > 0 ? 'overtime-cell' :
                            pos.difference < 0 ? 'savings-cell' : 'neutral-cell';
            const diffSign = pos.difference > 0 ? '+' : '';

            html += `
                <tr>
                    <td>${pos.positionName}</td>
                    <td style="text-align: center;">${pos.planned.count}</td>
                    <td style="text-align: right;">${formatNumber(pos.planned.payroll)}</td>
                    <td style="text-align: center;">${pos.actual.count}</td>
                    <td style="text-align: right;">${formatNumber(pos.actual.payroll)}</td>
                    <td class="${diffClass}" style="text-align: right; font-weight: 600;">
                        ${diffSign}${formatNumber(pos.difference)}
                    </td>
                </tr>
            `;
        });

        const summaryDiffSign = dept.summary.difference > 0 ? '+' : '';
        html += `
                    </tbody>
                    <tfoot>
                        <tr class="summary-row">
                            <td><strong>ИТОГО ПО ПОДРАЗДЕЛЕНИЮ:</strong></td>
                            <td style="text-align: center;"><strong>${dept.summary.plannedCount}</strong></td>
                            <td style="text-align: right;"><strong>${formatNumber(dept.summary.plannedPayroll)}</strong></td>
                            <td style="text-align: center;"><strong>${dept.summary.actualCount}</strong></td>
                            <td style="text-align: right;"><strong>${formatNumber(dept.summary.actualPayroll)}</strong></td>
                            <td class="${summaryClass}" style="text-align: right; font-weight: 700; font-size: 16px;">
                                ${summaryDiffSign}${formatNumber(dept.summary.difference)}
                                ${dept.summary.differencePercent !== 0 ? `<br><small>(${summaryDiffSign}${dept.summary.differencePercent}%)</small>` : ''}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    const totalDiffSign = data.totalSummary.difference > 0 ? '+' : '';
    const totalClass = data.totalSummary.difference > 0 ? 'overtime-cell' :
                      data.totalSummary.difference < 0 ? 'savings-cell' : 'neutral-cell';

    html += `
            <div class="total-summary" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px;">
                <h3 style="margin: 0 0 15px 0;">Общий итог по организации</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                    <div style="padding: 15px; background: white; border-radius: 4px; border-left: 4px solid #007bff;">
                        <div style="font-size: 14px; color: #6c757d; margin-bottom: 5px;">Плановый ФОТ</div>
                        <div style="font-size: 24px; font-weight: 700; color: #007bff;">${formatNumber(data.totalSummary.plannedPayroll)}₸</div>
                    </div>
                    <div style="padding: 15px; background: white; border-radius: 4px; border-left: 4px solid #ffc107;">
                        <div style="font-size: 14px; color: #6c757d; margin-bottom: 5px;">Фактический ФОТ</div>
                        <div style="font-size: 24px; font-weight: 700; color: #ffc107;">${formatNumber(data.totalSummary.actualPayroll)}₸</div>
                    </div>
                    <div class="${totalClass}" style="padding: 15px; border-radius: 4px; border-left: 4px solid ${data.totalSummary.difference > 0 ? '#dc3545' : data.totalSummary.difference < 0 ? '#28a745' : '#6c757d'};">
                        <div style="font-size: 14px; margin-bottom: 5px;">${data.totalSummary.difference > 0 ? 'Перелимит' : data.totalSummary.difference < 0 ? 'Экономия' : 'Без изменений'}</div>
                        <div style="font-size: 24px; font-weight: 700;">
                            ${totalDiffSign}${formatNumber(data.totalSummary.difference)}₸
                            ${data.totalSummary.differencePercent !== 0 ? `<div style="font-size: 16px; margin-top: 5px;">(${totalDiffSign}${data.totalSummary.differencePercent}%)</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function clearPayrollOvertimeReport() {
    const container = document.getElementById('overtime-results-container');
    const dateInput = document.getElementById('overtime-date-filter');
    const orgFilter = document.getElementById('overtime-organization-filter');

    if (container) container.innerHTML = '<div class="table-container"><div id="overtime-report-placeholder" class="text-center" style="padding: 40px; color: #6c757d;">Выберите организацию и дату, затем нажмите "Сформировать отчет"</div></div>';
    if (orgFilter) orgFilter.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

// ==================== TAB: REVENUE TO PAYROLL (Выручка к ФОТ) ====================

function initRevenueToPayrollTab() {
    if (revenueToPayrollTabInitialized) return;

    loadRTPOrganizations();

    const generateBtn = document.getElementById('load-rtp-report-btn');
    const clearBtn = document.getElementById('clear-rtp-report-btn');

    if (generateBtn) generateBtn.addEventListener('click', loadRevenueToPayrollReport);
    if (clearBtn) clearBtn.addEventListener('click', clearRevenueToPayrollReport);

    // Set default dates
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const dateFrom = document.getElementById('rtp-date-from');
    const dateTo = document.getElementById('rtp-date-to');

    if (dateFrom) dateFrom.value = firstDay.toISOString().split('T')[0];
    if (dateTo) dateTo.value = today.toISOString().split('T')[0];

    revenueToPayrollTabInitialized = true;
}

async function loadRTPOrganizations() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error('Failed to load organizations');

        const organizations = await response.json();
        const select = document.getElementById('rtp-organization-filter');

        if (select) {
            select.innerHTML = '<option value="">Выберите организацию</option>';
            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.object_bin;
                option.textContent = `${org.object_company} (${org.object_bin})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading RTP organizations:', error);
    }
}

async function loadRevenueToPayrollReport() {
    const orgFilter = document.getElementById('rtp-organization-filter');
    const dateFrom = document.getElementById('rtp-date-from');
    const dateTo = document.getElementById('rtp-date-to');
    const bonusPercentInput = document.getElementById('rtp-bonus-percent');
    const generateBtn = document.getElementById('load-rtp-report-btn');
    const spinner = generateBtn?.querySelector('.spinner');
    const btnText = generateBtn?.querySelector('.btn-text');

    if (!orgFilter?.value) {
        alert('Пожалуйста, выберите организацию');
        return;
    }

    if (generateBtn) generateBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline';
    if (btnText) btnText.style.display = 'none';

    try {
        const bonusPercent = parseFloat(bonusPercentInput?.value) || 4;

        const params = new URLSearchParams({
            organization: orgFilter.value,
            date_from: dateFrom?.value || '',
            date_to: dateTo?.value || '',
            bonus_percent: bonusPercent
        });

        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/revenue-to-payroll?${params}`);
        if (!response.ok) throw new Error('Failed to load report');

        const result = await response.json();
        renderRevenueToPayrollReport(result);
    } catch (error) {
        console.error('Error loading RTP report:', error);
        alert('Ошибка при загрузке отчета: ' + error.message);
    } finally {
        if (generateBtn) generateBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.display = 'inline';
    }
}

function renderRevenueToPayrollReport(data) {
    const resultsContainer = document.getElementById('rtp-results-container');
    const placeholder = document.getElementById('rtp-report-placeholder');
    const tbody = document.getElementById('rtp-report-body');

    const days = data.days || [];
    const summary = data.summary || {};

    if (days.length === 0) {
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (placeholder) {
            placeholder.style.display = 'block';
            placeholder.innerHTML = `<p>${data.message || 'Нет данных за выбранный период'}</p>`;
        }
        return;
    }

    if (resultsContainer) resultsContainer.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';

    const weekDays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

    if (tbody) {
        tbody.innerHTML = days.map(day => {
            const dateObj = new Date(day.date);
            const dayOfWeek = weekDays[dateObj.getDay()];
            const payroll = day.actual_payroll || 0;
            const bonus = day.bonus || 0;
            const totalPayroll = day.total_payroll || payroll;
            const coefficient = day.coefficient || 0;

            return `
                <tr>
                    <td>${formatDate(day.date)}</td>
                    <td>${dayOfWeek}</td>
                    <td>${formatNumber(day.revenue || 0)} ₸</td>
                    <td>${formatNumber(payroll)} ₸</td>
                    <td style="color: #17a2b8;">${formatNumber(bonus)} ₸</td>
                    <td style="font-weight: 600; color: #6f42c1;">${formatNumber(totalPayroll)} ₸</td>
                    <td>${day.employees_count || 0}</td>
                    <td style="font-weight: bold; color: ${coefficient >= 1 ? '#28a745' : '#dc3545'}">
                        ${coefficient.toFixed(2)}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update footer totals
    const totalRevenueEl = document.getElementById('rtp-total-revenue');
    const totalPayrollEl = document.getElementById('rtp-total-payroll');
    const totalBonusEl = document.getElementById('rtp-total-bonus');
    const grandTotalPayrollEl = document.getElementById('rtp-grand-total-payroll');
    const totalEmployeesEl = document.getElementById('rtp-total-employees');
    const totalCoefficientEl = document.getElementById('rtp-total-coefficient');
    const avgCoefficientEl = document.getElementById('rtp-avg-coefficient');

    if (totalRevenueEl) totalRevenueEl.textContent = formatNumber(summary.total_revenue || 0) + ' ₸';
    if (totalPayrollEl) totalPayrollEl.textContent = formatNumber(summary.total_payroll || 0) + ' ₸';
    if (totalBonusEl) totalBonusEl.textContent = formatNumber(summary.total_bonus || 0) + ' ₸';
    if (grandTotalPayrollEl) grandTotalPayrollEl.textContent = formatNumber(summary.grand_total_payroll || 0) + ' ₸';
    if (totalEmployeesEl) totalEmployeesEl.textContent = summary.total_employees || 0;
    if (totalCoefficientEl) totalCoefficientEl.textContent = (summary.avg_coefficient || 0).toFixed(2);
    if (avgCoefficientEl) avgCoefficientEl.textContent = (summary.avg_coefficient || 0).toFixed(2);

    // Render chart if Chart.js available
    if (typeof Chart !== 'undefined' && days.length > 0) {
        renderRTPChart(days);
    }
}

function renderRTPChart(days) {
    const canvas = document.getElementById('rtp-chart');
    if (!canvas) return;

    if (revenueToPayrollChart) {
        revenueToPayrollChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    revenueToPayrollChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days.map(d => formatDate(d.date)),
            datasets: [
                {
                    label: 'Выручка',
                    data: days.map(d => d.revenue || 0),
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'ФОТ + Бонус',
                    data: days.map(d => d.total_payroll || d.actual_payroll || 0),
                    borderColor: '#6f42c1',
                    backgroundColor: 'rgba(111, 66, 193, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            const dataIndex = context[0].dataIndex;
                            const day = days[dataIndex];
                            const bonus = day.bonus || 0;
                            return [
                                '',
                                '■ Бонус: ' + formatNumber(bonus) + ' ₸'
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value) + ' ₸';
                        }
                    }
                }
            }
        }
    });
}

function clearRevenueToPayrollReport() {
    const resultsContainer = document.getElementById('rtp-results-container');
    const placeholder = document.getElementById('rtp-report-placeholder');
    const orgFilter = document.getElementById('rtp-organization-filter');
    const bonusPercentInput = document.getElementById('rtp-bonus-percent');

    if (revenueToPayrollChart) {
        revenueToPayrollChart.destroy();
        revenueToPayrollChart = null;
    }

    if (resultsContainer) resultsContainer.style.display = 'none';
    if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.textContent = 'Выберите организацию и период, затем нажмите "Сформировать отчет"';
    }
    if (orgFilter) orgFilter.value = '';
    if (bonusPercentInput) bonusPercentInput.value = '4';

    // Reset dates
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateFrom = document.getElementById('rtp-date-from');
    const dateTo = document.getElementById('rtp-date-to');
    if (dateFrom) dateFrom.value = firstDay.toISOString().split('T')[0];
    if (dateTo) dateTo.value = today.toISOString().split('T')[0];
}

// ==================== EXPORTS ====================

// Main section init
window.initReportsSection = initReportsSection;
window.switchReportsTab = switchReportsTab;

// Time Events tab
window.initTimeEventsTab = initTimeEventsTab;
window.loadTimeEvents = loadTimeEvents;
window.displayTimeEvents = displayTimeEvents;
window.clearEventsFilter = clearEventsFilter;
window.loadOrganizationsForTimeEvents = loadOrganizationsForTimeEvents;
window.loadDepartmentsForTimeEventsFilter = loadDepartmentsForTimeEventsFilter;
window.onTimeEventsOrganizationChange = onTimeEventsOrganizationChange;

// Late Employees tab
window.initLateEmployeesTab = initLateEmployeesTab;
window.generateLateEmployeesReport = generateLateEmployeesReport;
window.displayLateEmployeesReport = displayLateEmployeesReport;
window.clearReportTable = clearReportTable;
window.clearReportFilters = clearReportFilters;
window.loadOrganizationsForReports = loadOrganizationsForReports;
window.loadDepartmentsForReports = loadDepartmentsForReports;
window.onReportOrganizationChange = onReportOrganizationChange;

// Off-Schedule tab
window.initOffScheduleTab = initOffScheduleTab;
window.loadOffScheduleReport = loadOffScheduleReport;
window.displayOffScheduleReport = displayOffScheduleReport;
window.clearOffScheduleReport = clearOffScheduleReport;

// Payroll Overtime tab
window.initPayrollOvertimeTab = initPayrollOvertimeTab;
window.loadPayrollOvertimeReport = loadPayrollOvertimeReport;
window.renderPayrollOvertimeReport = renderPayrollOvertimeReport;
window.clearPayrollOvertimeReport = clearPayrollOvertimeReport;

// Revenue to Payroll tab
window.initRevenueToPayrollTab = initRevenueToPayrollTab;
window.loadRevenueToPayrollReport = loadRevenueToPayrollReport;
window.renderRevenueToPayrollReport = renderRevenueToPayrollReport;
window.clearRevenueToPayrollReport = clearRevenueToPayrollReport;

