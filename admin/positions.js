// Admin Panel - Positions Module
// Управление должностями

// Local reference to positions data
let positionsData = [];

// Load positions
async function loadPositions() {
    const tbody = document.getElementById('positions-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="loading">Загрузка данных</td></tr>';

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/positions`);
        if (!response.ok) throw new Error('Failed to load positions');

        positionsData = await response.json();
        // Update global state
        if (window.AdminState) {
            window.AdminState.positions = positionsData;
        }
        displayPositions(positionsData);
        document.getElementById('positions-total').textContent = positionsData.length;
    } catch (error) {
        console.error('Error loading positions:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>';
    }
}

// Display positions in table
function displayPositions(positions) {
    const tbody = document.getElementById('positions-tbody');

    if (positions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = positions.map(pos => `
        <tr>
            <td>${pos.staff_position_code}</td>
            <td>${pos.staff_position_name}</td>
            <td>${pos.object_bin || '-'}</td>
        </tr>
    `).join('');
}

// Filter positions by search term
function filterPositions(searchTerm) {
    if (!searchTerm) {
        searchTerm = document.getElementById('positions-search').value || '';
    }

    const filtered = positionsData.filter(pos =>
        pos.staff_position_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.staff_position_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    displayPositions(filtered);
    document.getElementById('positions-total').textContent = filtered.length;
}

// Export to window for global access
window.loadPositions = loadPositions;
window.displayPositions = displayPositions;
window.filterPositions = filterPositions;

// Backward compatibility
window.positionsData = positionsData;
