// Admin Panel - Upload Module
// Синхронизация данных и загрузка табелей

// Track if upload section has been initialized
let uploadSectionInitialized = false;

// Initialize upload section
function initUploadSection() {
    if (uploadSectionInitialized) return;

    // Load organizations for dropdown
    loadOrganizationsForUpload();

    // Load CRON status info
    loadCronStatusForUploadSection();

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

        // If too many organizations (>200), add search input
        if (organizations.length > 200) {
            console.warn('Large number of organizations detected. Consider using searchable dropdown.');

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Поиск организации...';
            searchInput.className = 'form-control mb-2';
            searchInput.id = 'upload-org-search';

            select.parentNode.insertBefore(searchInput, select);

            // Save all options
            const allOptions = Array.from(select.options);

            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();

                // Clear select except first option
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }

                // Add matching options
                const filteredOptions = allOptions.slice(1).filter(option =>
                    option.textContent.toLowerCase().includes(query)
                );

                // Show max 100 results
                filteredOptions.slice(0, 100).forEach(option => {
                    select.appendChild(option.cloneNode(true));
                });

                console.log(`Filtered to ${Math.min(filteredOptions.length, 100)} organizations`);
            });
        }

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
                switch (type) {
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

// Load CRON status for upload section
async function loadCronStatusForUploadSection() {
    try {
        // Load CRON scheduler status
        const statusResponse = await fetch(`${ADMIN_API_BASE_URL}/admin/cron/timesheet/status`);
        if (!statusResponse.ok) {
            console.warn('Failed to load CRON status');
            return;
        }
        const status = await statusResponse.json();

        // Update UI elements
        const lastRunElement = document.getElementById('cron-last-run');
        const nextRunElement = document.getElementById('cron-next-run');
        const statusBadgeElement = document.getElementById('cron-status-badge');

        // Format last run time
        if (status.lastRun) {
            const lastRunDate = new Date(status.lastRun);
            lastRunElement.textContent = formatDateTime(lastRunDate);
        } else {
            lastRunElement.textContent = 'Еще не запускался';
        }

        // Format next run time
        if (status.nextRun) {
            const nextRunDate = new Date(status.nextRun);
            nextRunElement.textContent = formatDateTime(nextRunDate);
        } else {
            nextRunElement.textContent = '—';
        }

        // Update status badge
        if (status.isRunning) {
            statusBadgeElement.textContent = 'Выполняется...';
            statusBadgeElement.className = 'badge running';
            statusBadgeElement.style.background = '#fff3cd';
            statusBadgeElement.style.color = '#856404';
        } else if (status.enabled) {
            statusBadgeElement.textContent = 'Активен';
            statusBadgeElement.className = 'badge enabled';
            statusBadgeElement.style.background = '#d4edda';
            statusBadgeElement.style.color = '#155724';
        } else {
            statusBadgeElement.textContent = 'Отключен';
            statusBadgeElement.className = 'badge disabled';
            statusBadgeElement.style.background = '#f8d7da';
            statusBadgeElement.style.color = '#721c24';
        }

        // Load summary to get total events count
        const summaryResponse = await fetch(`${ADMIN_API_BASE_URL}/admin/cron/timesheet/logs/summary?days=7`);
        if (summaryResponse.ok) {
            const summary = await summaryResponse.json();
            const totalEvents = summary.reduce((sum, org) => sum + (org.total_events_loaded || 0), 0);
            const eventsCountElement = document.getElementById('cron-events-count');
            if (eventsCountElement) {
                eventsCountElement.textContent = totalEvents.toLocaleString('ru-RU') + ' (за последние 7 дней)';
            }
        }

    } catch (error) {
        console.error('Error loading CRON status for upload section:', error);
    }
}

// Export to window for global access
window.initUploadSection = initUploadSection;
window.loadOrganizationsForUpload = loadOrganizationsForUpload;
window.syncData = syncData;
window.handleTimesheetUpload = handleTimesheetUpload;
window.pollLoadingProgress = pollLoadingProgress;
window.updateProgressDisplay = updateProgressDisplay;
window.loadCronStatusForUploadSection = loadCronStatusForUploadSection;
