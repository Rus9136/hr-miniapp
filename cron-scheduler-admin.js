/**
 * CRON Scheduler Admin UI
 * Управление автоматической загрузкой табелей
 */

let cronSectionInitialized = false;
let cronStatusInterval = null;

/**
 * Инициализация секции CRON планировщика
 */
async function initCronSchedulerSection() {
    if (cronSectionInitialized) {
        refreshCronData();
        return;
    }

    console.log('Initializing CRON scheduler section...');

    // Event listeners
    const manualRunBtn = document.getElementById('cron-manual-run-btn');
    const filterStatus = document.getElementById('cron-filter-status');
    const filterOrg = document.getElementById('cron-filter-org');

    if (manualRunBtn) {
        manualRunBtn.addEventListener('click', handleManualRun);
    }

    if (filterStatus) {
        filterStatus.addEventListener('change', loadCronLogs);
    }

    if (filterOrg) {
        filterOrg.addEventListener('change', loadCronLogs);
    }

    // Load initial data
    await refreshCronData();

    // Auto-refresh статуса каждые 30 секунд
    if (cronStatusInterval) {
        clearInterval(cronStatusInterval);
    }

    cronStatusInterval = setInterval(() => {
        loadCronStatus();
    }, 30000);

    cronSectionInitialized = true;
}

/**
 * Обновить все данные CRON секции
 */
async function refreshCronData() {
    await Promise.all([
        loadCronStatus(),
        loadCronSummary(),
        loadCronLogs(),
        loadOrganizationsForFilter()
    ]);
}

/**
 * Загрузить статус планировщика
 */
async function loadCronStatus() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/cron/timesheet/status`);
        const status = await response.json();

        // Обновляем UI
        const enabledStatus = document.getElementById('cron-enabled-status');
        if (enabledStatus) {
            enabledStatus.textContent = status.enabled ? 'Включен' : 'Выключен';
            enabledStatus.className = `badge ${status.enabled ? 'enabled' : 'disabled'}`;
        }

        const scheduleEl = document.getElementById('cron-schedule');
        if (scheduleEl) {
            scheduleEl.textContent = parseCronSchedule(status.schedule);
        }

        const daysBackEl = document.getElementById('cron-days-back');
        if (daysBackEl) {
            daysBackEl.textContent = `${status.daysBack} дн. назад`;
        }

        const nextRunEl = document.getElementById('cron-next-run');
        if (nextRunEl) {
            nextRunEl.textContent = status.nextRunTime
                ? new Date(status.nextRunTime).toLocaleString('ru-RU')
                : '—';
        }

        const lastRunEl = document.getElementById('cron-last-run');
        if (lastRunEl) {
            lastRunEl.textContent = status.lastRunTime
                ? new Date(status.lastRunTime).toLocaleString('ru-RU')
                : '—';
        }

        const isRunningEl = document.getElementById('cron-is-running');
        if (isRunningEl) {
            isRunningEl.textContent = status.isRunning ? 'Да' : 'Нет';
            isRunningEl.className = `badge ${status.isRunning ? 'running' : 'info'}`;
        }

    } catch (error) {
        console.error('Error loading CRON status:', error);
    }
}

/**
 * Загрузить сводку по организациям
 */
async function loadCronSummary() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/cron/timesheet/logs/summary?days=7`);
        const data = await response.json();

        const tbody = document.getElementById('cron-summary-tbody');
        if (!tbody) return;

        if (!data.summary || data.summary.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">Нет данных за последние 7 дней</td></tr>';
            return;
        }

        tbody.innerHTML = data.summary.map(org => `
            <tr>
                <td>${org.organization_name || '—'}</td>
                <td>${org.organization_bin || '—'}</td>
                <td>${org.runs_count || 0}</td>
                <td class="success">${org.success_count || 0}</td>
                <td class="error">${org.error_count || 0}</td>
                <td>${org.total_events || 0}</td>
                <td>${org.total_records || 0}</td>
                <td>${org.last_run ? new Date(org.last_run).toLocaleString('ru-RU') : '—'}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading CRON summary:', error);
        const tbody = document.getElementById('cron-summary-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data error">Ошибка загрузки данных</td></tr>';
        }
    }
}

/**
 * Загрузить историю запусков
 */
async function loadCronLogs() {
    try {
        const filterStatus = document.getElementById('cron-filter-status')?.value || '';
        const filterOrg = document.getElementById('cron-filter-org')?.value || '';

        let url = `${ADMIN_API_BASE_URL}/admin/cron/timesheet/logs?limit=50`;
        if (filterStatus) url += `&status=${filterStatus}`;
        if (filterOrg) url += `&organization=${filterOrg}`;

        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('cron-logs-tbody');
        if (!tbody) return;

        if (!data.logs || data.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">Нет запусков</td></tr>';
            return;
        }

        tbody.innerHTML = data.logs.map(log => {
            const statusClass = log.status === 'success' ? 'success' :
                               log.status === 'error' ? 'error' :
                               log.status === 'running' ? 'warning' : '';

            return `
                <tr>
                    <td>${new Date(log.run_date).toLocaleString('ru-RU')}</td>
                    <td>${log.organization_name || '—'}</td>
                    <td>${log.date_from} — ${log.date_to}</td>
                    <td>${log.events_loaded || 0}</td>
                    <td>${log.records_processed || 0}</td>
                    <td><span class="badge ${statusClass}">${formatStatus(log.status)}</span></td>
                    <td>${log.duration_seconds || '—'}</td>
                    <td style="font-size: 12px; color: #dc3545;">
                        ${log.error_message ? log.error_message.substring(0, 100) : '—'}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading CRON logs:', error);
        const tbody = document.getElementById('cron-logs-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data error">Ошибка загрузки данных</td></tr>';
        }
    }
}

/**
 * Загрузить организации для фильтра
 */
async function loadOrganizationsForFilter() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        const organizations = await response.json();

        const select = document.getElementById('cron-filter-org');
        if (!select) return;

        // Очищаем текущие опции (кроме первой)
        while (select.options.length > 1) {
            select.remove(1);
        }

        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.object_bin;
            option.textContent = `${org.object_company} (${org.object_bin})`;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading organizations for filter:', error);
    }
}

/**
 * Ручной запуск загрузки
 */
async function handleManualRun(e) {
    e.preventDefault();

    const button = e.currentTarget;
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');

    // Проверяем, не выполняется ли уже загрузка
    const statusEl = document.getElementById('cron-is-running');
    if (statusEl && statusEl.textContent === 'Да') {
        alert('Загрузка уже выполняется. Дождитесь завершения.');
        return;
    }

    if (!confirm('Запустить загрузку табелей для всех организаций?\n\nЭто может занять несколько минут.')) {
        return;
    }

    button.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/cron/timesheet/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            alert('Загрузка запущена в фоновом режиме.\n\nОтслеживайте прогресс в разделе "История запусков".');

            // Обновляем данные
            setTimeout(() => {
                refreshCronData();
            }, 2000);
        } else {
            alert('Ошибка: ' + result.error);
        }

    } catch (error) {
        console.error('Error running manual CRON:', error);
        alert('Ошибка запуска: ' + error.message);
    } finally {
        button.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

/**
 * Парсинг CRON выражения в читаемый формат
 */
function parseCronSchedule(cronExpr) {
    if (!cronExpr) return '—';

    // Простой парсер для "0 9,21 * * *"
    const parts = cronExpr.split(' ');
    if (parts.length < 5) return cronExpr;

    const hours = parts[1];

    if (hours.includes(',')) {
        const hoursList = hours.split(',').join(', ');
        return `Каждый день в ${hoursList}:00`;
    } else if (hours.includes('/')) {
        const interval = hours.split('/')[1];
        return `Каждые ${interval} часов`;
    } else if (hours.includes('*')) {
        return 'Каждый час';
    } else {
        return `Каждый день в ${hours}:00`;
    }
}

/**
 * Форматирование статуса
 */
function formatStatus(status) {
    const statusMap = {
        'success': 'Успешно',
        'error': 'Ошибка',
        'running': 'Выполняется',
        'partial': 'Частично'
    };

    return statusMap[status] || status;
}

// Очистка интервала при выходе из секции
window.addEventListener('beforeunload', () => {
    if (cronStatusInterval) {
        clearInterval(cronStatusInterval);
    }
});
