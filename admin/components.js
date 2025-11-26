// Admin Panel - Components Module
// Переиспользуемые UI компоненты

// Searchable Dropdown Component
class SearchableDropdown {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.options = {
            placeholder: options.placeholder || 'Выберите...',
            searchPlaceholder: options.searchPlaceholder || 'Поиск...',
            noResultsText: options.noResultsText || 'Ничего не найдено',
            loadingText: options.loadingText || 'Загрузка...',
            maxItems: options.maxItems || 1000,
            ...options
        };

        this.data = [];
        this.filteredData = [];
        this.selectedValue = null;
        this.selectedText = '';
        this.isOpen = false;
        this.isLoading = false;

        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="searchable-dropdown">
                <input type="text" readonly placeholder="${this.options.placeholder}" />
                <div class="dropdown-arrow">▼</div>
                <div class="dropdown-list">
                    <div class="dropdown-loading">${this.options.loadingText}</div>
                </div>
            </div>
        `;

        this.dropdown = this.container.querySelector('.searchable-dropdown');
        this.input = this.container.querySelector('input');
        this.arrow = this.container.querySelector('.dropdown-arrow');
        this.list = this.container.querySelector('.dropdown-list');

        this.bindEvents();
    }

    bindEvents() {
        // Toggle dropdown
        this.input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Search functionality
        this.input.addEventListener('input', () => {
            this.filter();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.close();
        });

        // Prevent closing when clicking inside dropdown
        this.dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (this.isLoading) return;

        this.isOpen = true;
        this.dropdown.classList.add('open');
        this.input.removeAttribute('readonly');
        this.input.placeholder = this.options.searchPlaceholder;
        this.input.focus();

        this.filter();
    }

    close() {
        this.isOpen = false;
        this.dropdown.classList.remove('open');
        this.input.setAttribute('readonly', 'true');
        this.input.placeholder = this.selectedText || this.options.placeholder;
        this.input.value = this.selectedText;
    }

    filter() {
        const query = this.input.value.toLowerCase();
        this.filteredData = this.data.filter(item =>
            item.text.toLowerCase().includes(query)
        );

        this.renderItems();
    }

    renderItems() {
        if (this.filteredData.length === 0) {
            this.list.innerHTML = `<div class="dropdown-item no-results">${this.options.noResultsText}</div>`;
            return;
        }

        const itemsToShow = this.filteredData.slice(0, this.options.maxItems);
        this.list.innerHTML = itemsToShow.map(item =>
            `<div class="dropdown-item" data-value="${item.value}">${item.text}</div>`
        ).join('');

        // Bind click events for items
        this.list.querySelectorAll('.dropdown-item[data-value]').forEach(item => {
            item.addEventListener('click', () => {
                this.select(item.dataset.value, item.textContent);
            });
        });
    }

    select(value, text) {
        this.selectedValue = value;
        this.selectedText = text;
        this.input.value = text;
        this.close();

        // Trigger change event
        this.container.dispatchEvent(new CustomEvent('change', {
            detail: { value, text }
        }));
    }

    setData(data) {
        this.data = data.map(item => ({
            value: item.value,
            text: item.text
        }));
        this.filteredData = [...this.data];

        if (this.isOpen) {
            this.renderItems();
        }

        this.isLoading = false;
    }

    setLoading(loading = true) {
        this.isLoading = loading;
        if (loading) {
            this.list.innerHTML = `<div class="dropdown-loading">${this.options.loadingText}</div>`;
        }
    }

    getValue() {
        return this.selectedValue;
    }

    getText() {
        return this.selectedText;
    }

    clear() {
        this.selectedValue = null;
        this.selectedText = '';
        this.input.value = '';
        this.input.placeholder = this.options.placeholder;
    }
}

// Organization Dropdown Manager - manages organization dropdowns with caching
class OrganizationDropdownManager {
    static cache = null;
    static loading = false;
    static dropdowns = new Map();

    static async getOrganizations() {
        if (this.cache) {
            return this.cache;
        }

        if (this.loading) {
            // Wait for current loading to complete
            return new Promise((resolve) => {
                const checkCache = () => {
                    if (this.cache) {
                        resolve(this.cache);
                    } else {
                        setTimeout(checkCache, 100);
                    }
                };
                checkCache();
            });
        }

        this.loading = true;

        try {
            console.log('Loading organizations...');
            const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const organizations = await response.json();

            this.cache = organizations.map(org => ({
                value: org.object_bin,
                text: `${org.object_company} (${org.object_bin})`
            }));

            console.log('Organizations cached:', this.cache.length);
            return this.cache;

        } catch (error) {
            console.error('Error loading organizations:', error);
            throw error;
        } finally {
            this.loading = false;
        }
    }

    static async createDropdown(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return null;
        }

        const dropdown = new SearchableDropdown(container, {
            placeholder: 'Выберите организацию...',
            searchPlaceholder: 'Поиск по названию или БИН...',
            maxItems: 500,
            ...options
        });

        // Show loading state
        dropdown.setLoading(true);

        try {
            const organizations = await this.getOrganizations();
            dropdown.setData(organizations);
            this.dropdowns.set(containerId, dropdown);

            console.log(`Organization dropdown created for ${containerId} with ${organizations.length} items`);
            return dropdown;

        } catch (error) {
            console.error(`Failed to create organization dropdown for ${containerId}:`, error);
            dropdown.setData([{
                value: '',
                text: 'Ошибка загрузки организаций'
            }]);
            return dropdown;
        }
    }

    static getDropdown(containerId) {
        return this.dropdowns.get(containerId);
    }

    static clearCache() {
        this.cache = null;
        console.log('Organizations cache cleared');
    }
}

// Export to window
window.SearchableDropdown = SearchableDropdown;
window.OrganizationDropdownManager = OrganizationDropdownManager;
