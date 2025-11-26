// Admin Panel - Reports Module
// Все отчёты: опоздавшие, ФОТ, вне графика, переработки, выручка/ФОТ

// Initialization flags
let reportsInitialized = false;
let payrollReportInitialized = false;
let offScheduleReportInitialized = false;
let payrollOvertimeReportInitialized = false;
let revenueToPayrollReportInitialized = false;
let revenueToPayrollChart = null;

// ==================== LATE EMPLOYEES REPORT ====================

function initReportsSection() {
    if (reportsInitialized) return;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date-filter').value = today;

    loadOrganizationsForReports();
    loadDepartmentsForReports();

    document.getElementById('generate-report-btn').addEventListener('click', generateLateEmployeesReport);
    document.getElementById('clear-report-btn').addEventListener('click', clearReportFilters);
    document.getElementById('report-organization-filter').addEventListener('change', onReportOrganizationChange);

    reportsInitialized = true;
    clearReportTable();
}

async function loadOrganizationsForReports() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/reports/organizations`);
        if (!response.ok) throw new Error('Failed to load organizations');

        const result = await response.json();
        const organizations = result.data || [];

        const select = document.getElementById('report-organization-filter');
        if (select) {
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }

            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.organization;
                option.textContent = `${org.company_name || org.organization} (${org.organization})`;
                select.appendChild(option);
            });
        }
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
        if (select) {
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }

            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.id;
                option.textContent = dept.name;
                select.appendChild(option);
            });
        }
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
    const spinner = generateBtn.querySelector('.spinner');
    const btnText = generateBtn.querySelector('.btn-text');

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
    } catch (error) {
        console.error('Error generating late employees report:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc3545;">Ошибка формирования отчета</td></tr>';
        document.getElementById('report-total').textContent = '0';
    } finally {
        spinner.style.display = 'none';
        btnText.textContent = 'Сформировать отчет';
        generateBtn.disabled = false;
    }
}

function displayLateEmployeesReport(employees) {
    const tbody = document.getElementById('reports-tbody');

    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #28a745;">Опоздавших сотрудников не найдено</td></tr>';
        return;
    }

    tbody.innerHTML = employees.map(employee => {
        const statusClass = employee.status === 'late' ? 'status-late' : 'status-absent';
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

function clearReportTable() {
    const tbody = document.getElementById('reports-tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #6c757d;">Выберите дату и нажмите "Сформировать отчет"</td></tr>';
    document.getElementById('report-total').textContent = '0';
}

function clearReportFilters() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date-filter').value = today;
    document.getElementById('report-organization-filter').value = '';
    document.getElementById('report-department-filter').value = '';
    loadDepartmentsForReports();
    clearReportTable();
}

// ==================== PAYROLL REPORT ====================

async function initPayrollReportSection() {
    if (payrollReportInitialized) return;

    await loadPayrollOrganizations();
    await loadPayrollDepartments();

    const orgFilter = document.getElementById('payroll-organization-filter');
    const generateBtn = document.getElementById('generate-payroll-report-btn');
    const clearBtn = document.getElementById('clear-payroll-report-btn');

    if (orgFilter) {
        orgFilter.addEventListener('change', async (e) => {
            document.getElementById('payroll-department-filter').value = '';
            await loadPayrollDepartments(e.target.value || null);
        });
    }

    if (generateBtn) generateBtn.addEventListener('click', generatePayrollReport);
    if (clearBtn) clearBtn.addEventListener('click', clearPayrollReport);

    // Set default dates
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
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error('Failed to load organizations');

        const organizations = await response.json();
        const select = document.getElementById('payroll-organization-filter');

        if (select) {
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }

            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.object_bin;
                option.textContent = `${org.object_company} (${org.object_bin})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading payroll organizations:', error);
    }
}

async function loadPayrollDepartments(organizationBin = null) {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        if (!response.ok) throw new Error('Failed to load departments');

        const allDepartments = await response.json();
        const departments = organizationBin
            ? allDepartments.filter(dept => dept.object_bin === organizationBin)
            : allDepartments;

        const select = document.getElementById('payroll-department-filter');

        if (select) {
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }

            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.object_code;
                option.textContent = dept.object_name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading payroll departments:', error);
    }
}

async function generatePayrollReport() {
    const button = document.getElementById('generate-payroll-report-btn');
    const spinner = button?.querySelector('.spinner');
    const btnText = button?.querySelector('.btn-text');

    if (button) button.disabled = true;
    if (spinner) spinner.style.display = 'inline';
    if (btnText) btnText.style.display = 'none';

    const tbody = document.getElementById('payroll-report-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading">Формирование отчета...</td></tr>';

    try {
        const params = new URLSearchParams();
        const organization = document.getElementById('payroll-organization-filter')?.value;
        const department = document.getElementById('payroll-department-filter')?.value;
        const dateFrom = document.getElementById('payroll-date-from')?.value;
        const dateTo = document.getElementById('payroll-date-to')?.value;

        if (organization) params.append('organization', organization);
        if (department) params.append('department', department);
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);

        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/payroll/attendance?${params}`);
        if (!response.ok) throw new Error('Failed to generate payroll report');

        const result = await response.json();
        displayPayrollReport(result);
    } catch (error) {
        console.error('Error generating payroll report:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc3545;">Ошибка формирования отчета</td></tr>';
    } finally {
        if (button) button.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.display = 'inline';
    }
}

function displayPayrollReport(result) {
    const tbody = document.getElementById('payroll-report-tbody');
    const totalSpan = document.getElementById('payroll-report-total');
    const totalFotSpan = document.getElementById('payroll-report-total-fot');

    if (totalSpan) totalSpan.textContent = result.data?.length || 0;

    if (!result.data || result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет данных за выбранный период</td></tr>';
        if (totalFotSpan) totalFotSpan.textContent = '0 ₸';
        return;
    }

    let totalFot = 0;
    tbody.innerHTML = result.data.map(row => {
        totalFot += row.daily_fot || 0;
        return `
            <tr>
                <td>${formatDate(row.date)}</td>
                <td>${row.full_name}</td>
                <td>${row.table_number}</td>
                <td>${row.department_name || '-'}</td>
                <td>${formatNumber(row.monthly_payroll)} ₸</td>
                <td>${row.shifts_count || 0}</td>
                <td>${formatNumber(row.daily_fot)} ₸</td>
            </tr>
        `;
    }).join('');

    if (totalFotSpan) totalFotSpan.textContent = formatNumber(totalFot) + ' ₸';
}

function clearPayrollReport() {
    const tbody = document.getElementById('payroll-report-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Выберите параметры и нажмите "Сформировать отчет"</td></tr>';

    const totalSpan = document.getElementById('payroll-report-total');
    const totalFotSpan = document.getElementById('payroll-report-total-fot');
    if (totalSpan) totalSpan.textContent = '0';
    if (totalFotSpan) totalFotSpan.textContent = '0 ₸';
}

// ==================== OFF-SCHEDULE REPORT ====================

async function initOffScheduleReportSection() {
    if (!offScheduleReportInitialized) {
        await loadOffScheduleOrganizations();

        const generateBtn = document.getElementById('load-off-schedule-report-btn');
        const clearBtn = document.getElementById('clear-off-schedule-report-btn');

        if (generateBtn) generateBtn.addEventListener('click', loadOffScheduleReport);
        if (clearBtn) clearBtn.addEventListener('click', clearOffScheduleReport);

        offScheduleReportInitialized = true;
    }

    const dateInput = document.getElementById('off-schedule-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
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

// ==================== PAYROLL OVERTIME REPORT ====================

async function initPayrollOvertimeReportSection() {
    if (!payrollOvertimeReportInitialized) {
        await loadPayrollOvertimeOrganizations();

        const generateBtn = document.getElementById('load-overtime-report-btn');
        const clearBtn = document.getElementById('clear-overtime-report-btn');

        if (generateBtn) generateBtn.addEventListener('click', loadPayrollOvertimeReport);
        if (clearBtn) clearBtn.addEventListener('click', clearPayrollOvertimeReport);

        payrollOvertimeReportInitialized = true;
    }

    const dateInput = document.getElementById('overtime-date-filter');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
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

    // Update total count
    if (totalSpan) {
        totalSpan.textContent = data.departments?.length || 0;
    }

    // Check if no departments
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

    // Build report HTML
    let html = `
        <div class="overtime-report" style="margin-top: 20px;">
            <!-- Report Header -->
            <div class="report-header" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #495057;">Отчет за ${data.date}</h3>
                <p style="margin: 0; color: #6c757d;">Организация: ${data.organization}</p>
            </div>
    `;

    // Iterate through departments
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

        // Iterate through positions
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

        // Department summary row
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

    // Total summary block
    const totalDiffSign = data.totalSummary.difference > 0 ? '+' : '';
    const totalClass = data.totalSummary.difference > 0 ? 'overtime-cell' :
                      data.totalSummary.difference < 0 ? 'savings-cell' : 'neutral-cell';

    html += `
            <!-- Grand Total Summary -->
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
    console.log('✅ Payroll overtime report rendered successfully');
}

function clearPayrollOvertimeReport() {
    const container = document.getElementById('overtime-results-container');
    const dateInput = document.getElementById('overtime-date-filter');
    const orgFilter = document.getElementById('overtime-organization-filter');

    if (container) container.innerHTML = '<div class="table-container"><div id="overtime-report-placeholder" class="text-center" style="padding: 40px; color: #6c757d;">Выберите организацию и дату, затем нажмите "Сформировать отчет"</div></div>';
    if (orgFilter) orgFilter.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

// ==================== REVENUE TO PAYROLL REPORT ====================

async function initRevenueToPayrollReportSection() {
    if (!revenueToPayrollReportInitialized) {
        await loadRTPOrganizations();

        const generateBtn = document.getElementById('load-rtp-report-btn');
        const clearBtn = document.getElementById('clear-rtp-report-btn');

        if (generateBtn) generateBtn.addEventListener('click', loadRevenueToPayrollReport);
        if (clearBtn) clearBtn.addEventListener('click', clearRevenueToPayrollReport);

        revenueToPayrollReportInitialized = true;
    }

    // Set default dates
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const dateFrom = document.getElementById('rtp-date-from');
    const dateTo = document.getElementById('rtp-date-to');

    if (dateFrom) dateFrom.value = firstDay.toISOString().split('T')[0];
    if (dateTo) dateTo.value = today.toISOString().split('T')[0];
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
        const params = new URLSearchParams({
            organization: orgFilter.value,
            date_from: dateFrom?.value || '',
            date_to: dateTo?.value || ''
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

    // Используем days из ответа API
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

    // Показываем результаты, скрываем placeholder
    if (resultsContainer) resultsContainer.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';

    // Названия дней недели
    const weekDays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

    // Рендерим таблицу по дням
    if (tbody) {
        tbody.innerHTML = days.map(day => {
            const dateObj = new Date(day.date);
            const dayOfWeek = weekDays[dateObj.getDay()];
            const payroll = day.actual_payroll || day.payroll || 0;
            const coefficient = day.coefficient || 0;

            return `
                <tr>
                    <td>${formatDate(day.date)}</td>
                    <td>${dayOfWeek}</td>
                    <td>${formatNumber(day.revenue || 0)} ₸</td>
                    <td>${formatNumber(payroll)} ₸</td>
                    <td>${day.employees_count || 0}</td>
                    <td style="font-weight: bold; color: ${coefficient >= 1 ? '#28a745' : '#dc3545'}">
                        ${coefficient.toFixed(2)}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Обновляем footer с итогами
    const totalRevenue = document.getElementById('rtp-total-revenue');
    const totalPayroll = document.getElementById('rtp-total-payroll');
    const totalEmployees = document.getElementById('rtp-total-employees');
    const totalCoefficient = document.getElementById('rtp-total-coefficient');
    const avgCoefficient = document.getElementById('rtp-avg-coefficient');

    if (totalRevenue) totalRevenue.textContent = formatNumber(summary.total_revenue || 0) + ' ₸';
    if (totalPayroll) totalPayroll.textContent = formatNumber(summary.total_payroll || 0) + ' ₸';
    if (totalEmployees) totalEmployees.textContent = summary.total_employees || 0;
    if (totalCoefficient) totalCoefficient.textContent = (summary.avg_coefficient || 0).toFixed(2);
    if (avgCoefficient) avgCoefficient.textContent = (summary.avg_coefficient || 0).toFixed(2);

    // Рендерим график если Chart.js доступен
    if (typeof Chart !== 'undefined' && days.length > 0) {
        renderRTPChart(days);
    }
}

function renderRTPChart(days) {
    const canvas = document.getElementById('rtp-chart');
    if (!canvas) return;

    // Destroy existing chart
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
                    label: 'ФОТ',
                    data: days.map(d => d.actual_payroll || d.payroll || 0),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
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

function renderRTPTable(data) {
    const tbody = document.getElementById('rtp-table-body');
    if (!tbody) return;

    tbody.innerHTML = data.map(row => `
        <tr>
            <td>${formatDate(row.date)}</td>
            <td>${formatNumber(row.revenue)} ₸</td>
            <td>${formatNumber(row.payroll)} ₸</td>
            <td>${row.coefficient?.toFixed(2) || '-'}</td>
        </tr>
    `).join('');
}

function clearRevenueToPayrollReport() {
    const chartContainer = document.getElementById('rtp-chart-container');
    const tableContainer = document.getElementById('rtp-table-container');
    const summaryContainer = document.getElementById('rtp-summary');
    const orgFilter = document.getElementById('rtp-organization-filter');

    if (revenueToPayrollChart) {
        revenueToPayrollChart.destroy();
        revenueToPayrollChart = null;
    }

    if (chartContainer) chartContainer.innerHTML = '<canvas id="rtp-chart"></canvas>';
    if (tableContainer) {
        const tbody = document.getElementById('rtp-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Выберите параметры и нажмите "Сформировать отчет"</td></tr>';
    }
    if (summaryContainer) summaryContainer.innerHTML = '';
    if (orgFilter) orgFilter.value = '';
}

// Export to window for global access
window.initReportsSection = initReportsSection;
window.generateLateEmployeesReport = generateLateEmployeesReport;
window.displayLateEmployeesReport = displayLateEmployeesReport;
window.clearReportTable = clearReportTable;
window.clearReportFilters = clearReportFilters;
window.loadOrganizationsForReports = loadOrganizationsForReports;
window.loadDepartmentsForReports = loadDepartmentsForReports;
window.onReportOrganizationChange = onReportOrganizationChange;

window.initPayrollReportSection = initPayrollReportSection;
window.generatePayrollReport = generatePayrollReport;
window.displayPayrollReport = displayPayrollReport;
window.clearPayrollReport = clearPayrollReport;

window.initOffScheduleReportSection = initOffScheduleReportSection;
window.loadOffScheduleReport = loadOffScheduleReport;
window.displayOffScheduleReport = displayOffScheduleReport;
window.clearOffScheduleReport = clearOffScheduleReport;

window.initPayrollOvertimeReportSection = initPayrollOvertimeReportSection;
window.loadPayrollOvertimeReport = loadPayrollOvertimeReport;
window.renderPayrollOvertimeReport = renderPayrollOvertimeReport;
window.clearPayrollOvertimeReport = clearPayrollOvertimeReport;

window.initRevenueToPayrollReportSection = initRevenueToPayrollReportSection;
window.loadRevenueToPayrollReport = loadRevenueToPayrollReport;
window.renderRevenueToPayrollReport = renderRevenueToPayrollReport;
window.clearRevenueToPayrollReport = clearRevenueToPayrollReport;
