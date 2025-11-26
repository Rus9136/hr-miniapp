// Admin Panel - Departments Module
// Управление подразделениями

// Local reference to departments data
let departmentsData = [];

// Load departments
async function loadDepartments() {
    const tbody = document.getElementById('departments-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка данных</td></tr>';

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        if (!response.ok) throw new Error('Failed to load departments');

        departmentsData = await response.json();
        // Update global state
        if (window.AdminState) {
            window.AdminState.departments = departmentsData;
        }
        displayDepartments(departmentsData);
        document.getElementById('departments-total').textContent = departmentsData.length;
    } catch (error) {
        console.error('Error loading departments:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display departments in table
function displayDepartments(departments) {
    const tbody = document.getElementById('departments-tbody');

    if (departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = departments.map(dept => `
        <tr>
            <td>${dept.object_code}</td>
            <td>${dept.object_name}</td>
            <td>${dept.object_company || '-'}</td>
            <td>${dept.object_bin || '-'}</td>
            <td>${dept.hall_area ? dept.hall_area : '-'}</td>
            <td>
                <button class="btn btn--sm btn--outline edit-department-btn"
                        data-department-id="${dept.id}"
                        title="Редактировать подразделение">
                    ✏️
                </button>
            </td>
        </tr>
    `).join('');

    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-department-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Department edit button clicked');
            const departmentId = e.target.dataset.departmentId;
            console.log('Department ID from button:', departmentId);

            if (departmentId) {
                openDepartmentModal(departmentId);
            } else {
                console.error('No department ID found on button');
                alert('Ошибка: не удалось определить ID подразделения');
            }
        });
    });
}

// Filter departments by search term and organization
function filterDepartments() {
    const searchTerm = document.getElementById('departments-search').value || '';
    const selectedBin = document.getElementById('departments-company-filter').value || '';

    const filtered = departmentsData.filter(dept => {
        const matchesSearch = dept.object_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dept.object_code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBin = !selectedBin || dept.object_bin === selectedBin;
        return matchesSearch && matchesBin;
    });

    displayDepartments(filtered);
    document.getElementById('departments-total').textContent = filtered.length;
}

// Open department modal for editing
function openDepartmentModal(departmentId) {
    try {
        console.log('Opening department modal for ID:', departmentId);

        // Validate data availability
        if (!departmentsData || departmentsData.length === 0) {
            console.error('No departments data available');
            alert('Ошибка: данные подразделений не загружены. Попробуйте обновить страницу.');
            return;
        }

        // Find department by ID
        const department = departmentsData.find(dept => dept.id == departmentId);
        if (!department) {
            console.error('Department not found:', departmentId);
            alert(`Ошибка: подразделение с ID ${departmentId} не найдено.`);
            return;
        }

        console.log('Found department:', department);

        // Fill form fields with current department data
        document.getElementById('departmentId').value = department.id;
        document.getElementById('departmentCode').value = department.object_code || '';
        document.getElementById('departmentName').value = department.object_name || '';
        document.getElementById('departmentCompany').value = department.object_company || '';
        document.getElementById('departmentBin').value = department.object_bin || '';
        document.getElementById('departmentIikoId').value = department.id_iiko || '';
        document.getElementById('departmentHallArea').value = department.hall_area || '';
        document.getElementById('departmentKitchenArea').value = department.kitchen_area || '';
        document.getElementById('departmentSeatsCount').value = department.seats_count || '';
        document.getElementById('departmentTradePoint').value = department.trade_point || '';

        // Clear status message
        const statusDiv = document.getElementById('departmentFormStatus');
        statusDiv.style.display = 'none';
        statusDiv.className = 'status-message';

        // Show modal
        const modal = document.getElementById('departmentModal');
        modal.classList.add('active');

        // Re-initialize event handlers
        initDepartmentModal();

    } catch (error) {
        console.error('Error opening department modal:', error);
        alert('Ошибка при открытии модального окна: ' + error.message);
    }
}

// Close department modal
function closeDepartmentModal() {
    try {
        console.log('Closing department modal...');
        const modal = document.getElementById('departmentModal');
        if (modal) {
            modal.classList.remove('active');
            console.log('Department modal closed');
        }
    } catch (error) {
        console.error('Error closing department modal:', error);
    }
}

// Initialize department modal event handlers
function initDepartmentModal() {
    const modal = document.getElementById('departmentModal');
    const closeBtn = document.getElementById('closeDepartmentModal');
    const cancelBtn = document.getElementById('cancelDepartmentBtn');
    const form = document.getElementById('departmentForm');

    console.log('Initializing department modal...');

    // Remove existing event listeners to prevent duplicates
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeDepartmentModal);
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Close button clicked');
            closeDepartmentModal();
        });
    }

    if (cancelBtn) {
        cancelBtn.removeEventListener('click', closeDepartmentModal);
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cancel button clicked');
            closeDepartmentModal();
        });
    }

    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked');
                closeDepartmentModal();
            }
        });
    }

    // Save button handler
    const saveBtn = document.getElementById('saveDepartmentBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log('Save department button clicked');

            const submitBtn = saveBtn;
            const btnText = submitBtn.querySelector('.btn-text');
            const spinner = submitBtn.querySelector('.spinner');

            // Show loading state
            submitBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline';

            try {
                // Get form data
                const departmentId = document.getElementById('departmentId').value;
                const iikoId = document.getElementById('departmentIikoId').value;
                const hallArea = document.getElementById('departmentHallArea').value;
                const kitchenArea = document.getElementById('departmentKitchenArea').value;
                const seatsCount = document.getElementById('departmentSeatsCount').value;
                const tradePoint = document.getElementById('departmentTradePoint').value;

                console.log('Saving department data:', { departmentId, iikoId, hallArea, kitchenArea, seatsCount, tradePoint });

                const result = await saveDepartment(departmentId, iikoId, hallArea, kitchenArea, seatsCount, tradePoint);
                console.log('Save result:', result);

                showDepartmentFormStatus('Данные подразделения успешно сохранены', false);

                // Reload departments data
                await loadDepartments();

                // Close modal after delay
                setTimeout(() => {
                    closeDepartmentModal();
                }, 1500);

            } catch (error) {
                console.error('Error saving department:', error);
                showDepartmentFormStatus(error.message, true);
            } finally {
                submitBtn.disabled = false;
                if (btnText) btnText.style.display = 'inline';
                if (spinner) spinner.style.display = 'none';
            }
        });
    }
}

// Save department data
async function saveDepartment(departmentId, iikoId, hallArea, kitchenArea, seatsCount, tradePoint) {
    console.log('saveDepartment called with:', { departmentId, iikoId, hallArea, kitchenArea, seatsCount, tradePoint });

    // Validate required fields
    if (!departmentId) {
        throw new Error('ID подразделения обязателен');
    }

    // Client-side validation
    if (hallArea && hallArea !== '') {
        const hallAreaNum = parseFloat(hallArea);
        if (isNaN(hallAreaNum) || hallAreaNum <= 0) {
            throw new Error('Площадь зала должна быть положительным числом');
        }
    }

    if (kitchenArea && kitchenArea !== '') {
        const kitchenAreaNum = parseFloat(kitchenArea);
        if (isNaN(kitchenAreaNum) || kitchenAreaNum <= 0) {
            throw new Error('Площадь кухни должна быть положительным числом');
        }
    }

    if (seatsCount && seatsCount !== '') {
        const seatsNum = parseInt(seatsCount);
        if (isNaN(seatsNum) || seatsNum < 0) {
            throw new Error('Количество посадочных мест должно быть неотрицательным целым числом');
        }
    }

    // Prepare data for API call
    const updateData = {
        id_iiko: iikoId || null,
        hall_area: hallArea && hallArea !== '' ? parseFloat(hallArea) : null,
        kitchen_area: kitchenArea && kitchenArea !== '' ? parseFloat(kitchenArea) : null,
        seats_count: seatsCount && seatsCount !== '' ? parseInt(seatsCount) : null,
        trade_point: tradePoint !== undefined ? tradePoint : null
    };

    console.log('Sending API request with data:', updateData);

    // Call API to update department
    const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments/${departmentId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
        let errorMessage = 'Ошибка при сохранении данных';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) {
            errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Ошибка при сохранении данных');
    }

    return result;
}

// Show status message in department form
function showDepartmentFormStatus(message, isError = false) {
    const statusDiv = document.getElementById('departmentFormStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${isError ? 'error' : 'success'}`;
        statusDiv.style.display = 'block';

        // Auto-hide success messages after 3 seconds
        if (!isError) {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }
}

// Export to window for global access
window.loadDepartments = loadDepartments;
window.displayDepartments = displayDepartments;
window.filterDepartments = filterDepartments;
window.openDepartmentModal = openDepartmentModal;
window.closeDepartmentModal = closeDepartmentModal;
window.initDepartmentModal = initDepartmentModal;
window.saveDepartment = saveDepartment;
window.showDepartmentFormStatus = showDepartmentFormStatus;

// Backward compatibility
window.departmentsData = departmentsData;
