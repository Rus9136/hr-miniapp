// Admin Panel - Employees Module
// Управление сотрудниками

// Local reference to employees data
let employeesData = [];

// Load employees
async function loadEmployees() {
    console.log('loadEmployees called');
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) {
        console.error('employees-tbody not found!');
        return;
    }
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка данных...</td></tr>';

    try {
        console.log('Fetching employees from:', `${ADMIN_API_BASE_URL}/admin/employees`);
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/employees`);
        if (!response.ok) throw new Error('Failed to load employees');

        employeesData = await response.json();
        // Update global state
        if (window.AdminState) {
            window.AdminState.employees = employeesData;
        }
        console.log('Loaded employees:', employeesData.length);
        displayEmployees(employeesData);
        document.getElementById('employees-total').textContent = employeesData.length;
    } catch (error) {
        console.error('Error loading employees:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display employees in table
function displayEmployees(employees) {
    const tbody = document.getElementById('employees-tbody');

    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = employees.map(emp => `
        <tr>
            <td>${emp.table_number}</td>
            <td>${emp.full_name}</td>
            <td>${emp.department_name || '-'}</td>
            <td>${emp.position_name || '-'}</td>
            <td>${emp.current_schedule || '-'}</td>
            <td>${emp.iin || ''}</td>
            <td>
                <button class="btn btn--sm btn--outline edit-employee-btn"
                        data-table-number="${emp.table_number}"
                        title="Редактировать сотрудника">
                    ✏️
                </button>
            </td>
        </tr>
    `).join('');

    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-employee-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log('Edit button clicked');
            const tableNumber = e.target.dataset.tableNumber;
            console.log('Table number from button:', tableNumber);

            if (tableNumber) {
                openEmployeeModal(tableNumber);
            } else {
                console.error('No table number found on button');
                alert('Ошибка: не удалось определить табельный номер сотрудника');
            }
        });
    });
}

// Filter employees by search term and organization
function filterEmployees() {
    const searchTerm = document.getElementById('employees-search').value || '';
    const selectedBin = document.getElementById('employees-company-filter').value || '';

    const filtered = employeesData.filter(emp => {
        const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.table_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBin = !selectedBin || emp.object_bin === selectedBin;
        return matchesSearch && matchesBin;
    });

    displayEmployees(filtered);
    document.getElementById('employees-total').textContent = filtered.length;
}

// Open employee modal for editing
function openEmployeeModal(tableNumber) {
    try {
        console.log('Opening employee modal for:', tableNumber);
        console.log('Current employeesData length:', employeesData ? employeesData.length : 0);

        if (!employeesData || employeesData.length === 0) {
            console.error('No employees data available');
            alert('Ошибка: данные сотрудников не загружены. Попробуйте обновить страницу.');
            return;
        }

        const employee = employeesData.find(emp => emp.table_number === tableNumber);
        if (!employee) {
            console.error('Employee not found:', tableNumber);
            console.log('Available employees:', employeesData.map(emp => emp.table_number));
            alert(`Ошибка: сотрудник с табельным номером ${tableNumber} не найден.`);
            return;
        }

        console.log('Found employee:', employee);

        // Fill form fields
        document.getElementById('employeeTableNumber').value = employee.table_number;
        document.getElementById('employeeTableNumberDisplay').value = employee.table_number;
        document.getElementById('employeeFullName').value = employee.full_name || '';
        document.getElementById('employeeIIN').value = employee.iin || '';
        document.getElementById('employeePayroll').value = employee.payroll || '';
        document.getElementById('employeeDepartment').value = employee.department_name || '-';
        document.getElementById('employeePosition').value = employee.position_name || '-';
        document.getElementById('employeeSchedule').value = employee.current_schedule || '-';
        document.getElementById('employeeStatus').value = employee.status || '-';
        document.getElementById('employeeBIN').value = employee.object_bin || '-';
        document.getElementById('employeeCode').value = employee.object_code || '-';

        // Clear status message
        const statusDiv = document.getElementById('employeeFormStatus');
        statusDiv.style.display = 'none';
        statusDiv.className = 'status-message';

        // Show modal
        const modal = document.getElementById('employeeModal');
        if (!modal) {
            console.error('Employee modal not found in DOM');
            alert('Ошибка: модальное окно не найдено. Попробуйте обновить страницу.');
            return;
        }

        console.log('Showing modal...');
        modal.classList.add('active');

        // Re-initialize event handlers
        console.log('Re-initializing modal event handlers...');
        initEmployeeModal();

    } catch (error) {
        console.error('Error opening employee modal:', error);
        alert('Ошибка при открытии модального окна: ' + error.message);
    }
}

// Close employee modal
function closeEmployeeModal() {
    try {
        console.log('Closing employee modal...');
        const modal = document.getElementById('employeeModal');
        if (modal) {
            modal.classList.remove('active');
        }

        const form = document.getElementById('employeeForm');
        if (form) {
            form.reset();
        }

        // Hide status message
        const statusDiv = document.getElementById('employeeFormStatus');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }

        console.log('Employee modal closed successfully');
    } catch (error) {
        console.error('Error closing employee modal:', error);
    }
}

// Save employee data
async function saveEmployee(formData) {
    const tableNumber = formData.get('table_number');
    const fullName = formData.get('full_name');
    const iin = formData.get('iin');
    const payroll = formData.get('payroll');

    // Validate required fields
    if (!tableNumber || !fullName) {
        throw new Error('Табельный номер и ФИО обязательны для заполнения');
    }

    // Validate IIN format if provided
    if (iin && !/^\d{12}$/.test(iin)) {
        throw new Error('ИИН должен состоять из 12 цифр');
    }

    // Validate payroll if provided
    if (payroll && (isNaN(payroll) || parseFloat(payroll) < 0)) {
        throw new Error('ФОТ должен быть положительным числом');
    }

    // Prepare data for API call
    const updateData = [{
        table_number: tableNumber
    }];

    // Add fields that can be updated
    if (iin) updateData[0].iin = iin;
    if (payroll) updateData[0].payroll = parseFloat(payroll);
    if (fullName) updateData[0].full_name = fullName;

    console.log('Sending API request with data:', updateData);

    // Call API to update employee
    const response = await fetch(`${ADMIN_API_BASE_URL}/admin/employees/update-iin`, {
        method: 'POST',
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
        console.error('API error:', errorMessage);
        throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Ошибка при сохранении данных');
    }

    if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join('; '));
    }

    return result;
}

// Show status message in employee form
function showEmployeeFormStatus(message, isError = false) {
    const statusDiv = document.getElementById('employeeFormStatus');
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

// Initialize employee modal event handlers
function initEmployeeModal() {
    const modal = document.getElementById('employeeModal');
    const closeBtn = document.getElementById('closeEmployeeModal');
    const cancelBtn = document.getElementById('cancelEmployeeBtn');
    const form = document.getElementById('employeeForm');

    console.log('Initializing employee modal...');
    console.log('Modal found:', !!modal);
    console.log('Close button found:', !!closeBtn);
    console.log('Cancel button found:', !!cancelBtn);
    console.log('Form found:', !!form);

    // Remove existing event listeners to prevent duplicates
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeEmployeeModal);
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Close button clicked');
            closeEmployeeModal();
        });
    }

    if (cancelBtn) {
        cancelBtn.removeEventListener('click', closeEmployeeModal);
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cancel button clicked');
            closeEmployeeModal();
        });
    }

    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked');
                closeEmployeeModal();
            }
        });
    }

    // Save button handler
    const saveBtn = document.getElementById('saveEmployeeBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log('Save button clicked');

            const submitBtn = saveBtn;
            const btnText = submitBtn.querySelector('.btn-text');
            const spinner = submitBtn.querySelector('.spinner');

            // Show loading state
            submitBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline';

            try {
                // Get form data manually
                const tableNumber = document.getElementById('employeeTableNumber').value;
                const fullName = document.getElementById('employeeFullName').value;
                const iin = document.getElementById('employeeIIN').value;
                const payroll = document.getElementById('employeePayroll').value;

                console.log('Form data:', { tableNumber, fullName, iin, payroll });

                // Create FormData manually
                const formData = new FormData();
                formData.set('table_number', tableNumber);
                formData.set('full_name', fullName);
                formData.set('iin', iin);
                formData.set('payroll', payroll);

                const result = await saveEmployee(formData);
                console.log('Save result:', result);

                showEmployeeFormStatus('Данные сотрудника успешно сохранены', false);

                // Reload employees data
                console.log('Reloading employees...');
                await loadEmployees();

                // Close modal after delay
                setTimeout(() => {
                    closeEmployeeModal();
                }, 1500);

            } catch (error) {
                console.error('Error saving employee:', error);
                showEmployeeFormStatus(error.message, true);
            } finally {
                submitBtn.disabled = false;
                if (btnText) btnText.style.display = 'inline';
                if (spinner) spinner.style.display = 'none';
            }
        });
    }
}

// Export to window for global access
window.loadEmployees = loadEmployees;
window.displayEmployees = displayEmployees;
window.filterEmployees = filterEmployees;
window.openEmployeeModal = openEmployeeModal;
window.closeEmployeeModal = closeEmployeeModal;
window.saveEmployee = saveEmployee;
window.showEmployeeFormStatus = showEmployeeFormStatus;
window.initEmployeeModal = initEmployeeModal;

// Backward compatibility
window.employeesData = employeesData;
