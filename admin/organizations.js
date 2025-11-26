/**
 * Модуль управления организациями
 * Секция: Организации
 */

// Локальное состояние
let organizationsData = [];
let organizationsSectionInitialized = false;

/**
 * Инициализация секции организаций
 */
function initOrganizationsSection() {
    if (organizationsSectionInitialized) {
        return;
    }

    // Загрузка данных
    loadOrganizationsFull();

    // Установка обработчиков
    setupOrganizationsEventHandlers();

    organizationsSectionInitialized = true;
}

/**
 * Установка обработчиков событий
 */
function setupOrganizationsEventHandlers() {
    // Поиск
    const searchInput = document.getElementById('organizations-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterOrganizations);
    }

    // Кнопка добавления
    const addBtn = document.getElementById('add-organization-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openOrganizationModal(null));
    }

    // Закрытие модального окна
    const closeBtn = document.getElementById('closeOrganizationModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeOrganizationModal);
    }

    // Кнопка отмены
    const cancelBtn = document.getElementById('cancelOrganizationBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeOrganizationModal);
    }

    // Кнопка сохранения
    const saveBtn = document.getElementById('saveOrganizationBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveOrganization);
    }

    // Закрытие по клику на overlay
    const modal = document.getElementById('organizationModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeOrganizationModal();
            }
        });
    }
}

/**
 * Загрузка полного списка организаций
 */
async function loadOrganizationsFull() {
    const tbody = document.getElementById('organizations-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading">Загрузка данных...</td></tr>';

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations/full`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки организаций');
        }

        const data = await response.json();

        if (data.success) {
            organizationsData = data.organizations || [];

            // Обновить глобальное состояние
            if (window.AdminState) {
                window.AdminState.organizationsFull = organizationsData;
            }

            displayOrganizations(organizationsData);

            // Обновить счётчик
            const totalEl = document.getElementById('organizations-total');
            if (totalEl) {
                totalEl.textContent = organizationsData.length;
            }
        } else {
            throw new Error(data.error || 'Ошибка загрузки');
        }
    } catch (error) {
        console.error('Error loading organizations:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

/**
 * Отображение организаций в таблице
 */
function displayOrganizations(organizations) {
    const tbody = document.getElementById('organizations-tbody');
    if (!tbody) return;

    if (!organizations || organizations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = organizations.map(org => {
        const iikoCount = org.iiko_department_ids ?
            (Array.isArray(org.iiko_department_ids) ? org.iiko_department_ids.length : 0) : 0;

        const statusClass = org.is_active ? 'status-active' : 'status-inactive';
        const statusText = org.is_active ? 'Активна' : 'Неактивна';
        const hasLinkedDepartments = parseInt(org.departments_count) > 0;

        return `
            <tr data-id="${org.id}">
                <td><code class="bin-code">${org.object_bin || '-'}</code></td>
                <td class="org-name">${org.object_company || '-'}</td>
                <td class="text-center">${iikoCount}</td>
                <td class="text-center">${org.departments_count || 0}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="actions-cell">
                    <div class="actions-buttons">
                        <button class="action-btn action-btn--edit edit-org-btn" data-id="${org.id}" title="Редактировать">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn action-btn--delete delete-org-btn" data-id="${org.id}" title="${hasLinkedDepartments ? 'Невозможно удалить: есть подразделения' : 'Удалить'}" ${hasLinkedDepartments ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Добавить обработчики для кнопок
    tbody.querySelectorAll('.edit-org-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            openOrganizationModal(id);
        });
    });

    tbody.querySelectorAll('.delete-org-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            deleteOrganization(id);
        });
    });
}

/**
 * Фильтрация организаций
 */
function filterOrganizations() {
    const searchTerm = (document.getElementById('organizations-search')?.value || '').toLowerCase().trim();

    if (!searchTerm) {
        displayOrganizations(organizationsData);
        return;
    }

    const filtered = organizationsData.filter(org => {
        const matchesBin = (org.object_bin || '').toLowerCase().includes(searchTerm);
        const matchesName = (org.object_company || '').toLowerCase().includes(searchTerm);
        return matchesBin || matchesName;
    });

    displayOrganizations(filtered);
}

/**
 * Открыть модальное окно для создания/редактирования
 */
function openOrganizationModal(orgId) {
    const modal = document.getElementById('organizationModal');
    const modalTitle = document.getElementById('organizationModalTitle');
    const binInput = document.getElementById('org-bin');
    const nameInput = document.getElementById('org-name');
    const iikoInput = document.getElementById('org-iiko-ids');
    const activeCheckbox = document.getElementById('org-is-active');
    const orgIdInput = document.getElementById('org-id');

    if (!modal) return;

    // Сброс формы
    if (binInput) binInput.value = '';
    if (nameInput) nameInput.value = '';
    if (iikoInput) iikoInput.value = '';
    if (activeCheckbox) activeCheckbox.checked = true;
    if (orgIdInput) orgIdInput.value = '';

    if (orgId) {
        // Редактирование существующей
        const org = organizationsData.find(o => o.id == orgId);
        if (!org) {
            showNotification('Организация не найдена', 'error');
            return;
        }

        modalTitle.textContent = 'Редактирование организации';
        orgIdInput.value = org.id;
        binInput.value = org.object_bin || '';
        binInput.disabled = true; // БИН нельзя менять
        nameInput.value = org.object_company || '';
        activeCheckbox.checked = org.is_active !== false;

        // ID IIKO - по одному на строку
        if (org.iiko_department_ids && Array.isArray(org.iiko_department_ids)) {
            iikoInput.value = org.iiko_department_ids.join('\n');
        } else {
            iikoInput.value = '';
        }
    } else {
        // Создание новой
        modalTitle.textContent = 'Новая организация';
        binInput.disabled = false;
    }

    modal.classList.add('active');
}

/**
 * Закрыть модальное окно
 */
function closeOrganizationModal() {
    const modal = document.getElementById('organizationModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Сохранение организации (создание или обновление)
 */
async function saveOrganization() {
    const orgId = document.getElementById('org-id')?.value;
    const binInput = document.getElementById('org-bin');
    const nameInput = document.getElementById('org-name');
    const iikoInput = document.getElementById('org-iiko-ids');
    const activeCheckbox = document.getElementById('org-is-active');
    const saveBtn = document.getElementById('saveOrganizationBtn');

    const object_bin = binInput?.value?.trim();
    const object_company = nameInput?.value?.trim();
    const is_active = activeCheckbox?.checked !== false;

    // Валидация
    if (!object_bin) {
        showNotification('БИН организации обязателен', 'error');
        binInput?.focus();
        return;
    }

    if (!object_company) {
        showNotification('Название организации обязательно', 'error');
        nameInput?.focus();
        return;
    }

    // Парсинг ID IIKO из textarea (по одному на строку)
    const iikoText = iikoInput?.value || '';
    const iiko_department_ids = iikoText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // Валидация UUID формата
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const uuid of iiko_department_ids) {
        if (!uuidRegex.test(uuid)) {
            showNotification(`Некорректный UUID: ${uuid}`, 'error');
            iikoInput?.focus();
            return;
        }
    }

    // Блокировка кнопки
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
    }

    try {
        let url, method;
        const body = {
            object_company,
            iiko_department_ids,
            is_active
        };

        if (orgId) {
            // Обновление
            url = `${ADMIN_API_BASE_URL}/admin/organizations/${orgId}`;
            method = 'PUT';
        } else {
            // Создание
            url = `${ADMIN_API_BASE_URL}/admin/organizations`;
            method = 'POST';
            body.object_bin = object_bin;
        }

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.success) {
            showNotification(data.message || 'Сохранено успешно', 'success');
            closeOrganizationModal();
            await loadOrganizationsFull();
        } else {
            showNotification(data.error || 'Ошибка сохранения', 'error');
        }
    } catch (error) {
        console.error('Error saving organization:', error);
        showNotification('Ошибка сохранения: ' + error.message, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
        }
    }
}

/**
 * Удаление организации
 */
async function deleteOrganization(orgId) {
    const org = organizationsData.find(o => o.id == orgId);
    if (!org) {
        showNotification('Организация не найдена', 'error');
        return;
    }

    // Проверка на привязанные подразделения
    if (parseInt(org.departments_count) > 0) {
        showNotification(`Невозможно удалить. К организации привязано ${org.departments_count} подразделений`, 'error');
        return;
    }

    if (!confirm(`Удалить организацию "${org.object_company}" (БИН: ${org.object_bin})?`)) {
        return;
    }

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations/${orgId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Организация удалена', 'success');
            await loadOrganizationsFull();
        } else {
            showNotification(data.error || 'Ошибка удаления', 'error');
        }
    } catch (error) {
        console.error('Error deleting organization:', error);
        showNotification('Ошибка удаления: ' + error.message, 'error');
    }
}

// Экспорт функций
window.initOrganizationsSection = initOrganizationsSection;
window.loadOrganizationsFull = loadOrganizationsFull;
window.filterOrganizations = filterOrganizations;
window.openOrganizationModal = openOrganizationModal;
window.closeOrganizationModal = closeOrganizationModal;
window.saveOrganization = saveOrganization;
window.deleteOrganization = deleteOrganization;
