// AI Recommendations Frontend Logic

let currentAnalysisId = null;
let agentPrompts = {};
let analysisHistory = [];

// Initialize AI Recommendations section
async function initAIRecommendationSection() {
    console.log('🤖 Initializing AI Recommendation section...');
    
    // Load organizations and departments for filters
    await loadAIOrganizations();
    await loadAIDepartments();
    
    // Set default dates (last 7 days)
    setDefaultDates();
    
    // Set up event handlers
    setupAIEventHandlers();
    
    // Load history, prompts and providers
    await loadAIHistory();
    await loadAIPrompts();
    await loadAIProviders();
    
    console.log('✅ AI Recommendation section initialized');
}

// Load organizations for AI-recommendations filter
async function loadAIOrganizations() {
    console.log('=== loadAIOrganizations called ===');
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/organizations`);
        if (!response.ok) throw new Error(`Failed to load organizations: ${response.status}`);
        
        const organizations = await response.json();
        const select = document.getElementById('ai-organization-filter');
        
        if (select) {
            // Clear existing options except the first one
            select.innerHTML = '<option value="">Все организации</option>';
            
            // Add organizations
            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.object_bin;
                option.textContent = `${org.object_company} (${org.object_bin})`;
                select.appendChild(option);
            });
            
            console.log(`📊 Loaded ${organizations.length} organizations for AI`);
        }
    } catch (error) {
        console.error('❌ Error loading AI organizations:', error);
        showNotification('Ошибка загрузки организаций', 'error');
    }
}

// Load departments for AI section with optional organization filter
async function loadAIDepartments(organizationBin = null) {
    console.log('=== loadAIDepartments called ===', 'organizationBin:', organizationBin);
    try {
        const params = new URLSearchParams();
        if (organizationBin && organizationBin.trim() !== '') {
            params.append('organization', organizationBin);
            console.log('Adding organization filter:', organizationBin);
        }
        
        const url = `${ADMIN_API_BASE_URL}/admin/departments?${params}`;
        console.log('Fetching departments from:', url);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load departments: ${response.status}`);
        
        const data = await response.json();
        
        const departmentFilter = document.getElementById('ai-department-filter');
        if (!departmentFilter) return;
        
        // Clear existing options
        departmentFilter.innerHTML = '<option value="">Выберите подразделение</option>';
        
        // Handle both array format and object format
        const departments = Array.isArray(data) ? data : (data.success && data.data ? data.data : []);
        
        if (departments && departments.length > 0) {
            // Filter by organization on client side if needed (for extra safety)
            const filteredDepartments = organizationBin 
                ? departments.filter(dept => dept.object_bin === organizationBin)
                : departments;
                
            filteredDepartments.forEach(dept => {
                if (dept.id_iiko) { // Only departments with id_iiko
                    const option = document.createElement('option');
                    option.value = dept.id_iiko;
                    option.textContent = `${dept.object_name} (${dept.object_company})`;
                    option.setAttribute('data-department-name', dept.object_name);
                    option.setAttribute('data-company', dept.object_company);
                    option.setAttribute('data-organization-bin', dept.object_bin);
                    departmentFilter.appendChild(option);
                }
            });
            
            console.log(`📊 Loaded ${filteredDepartments.length} departments for AI (${filteredDepartments.filter(d => d.id_iiko).length} with id_iiko)`);
        } else {
            console.warn('⚠️ No departments loaded or invalid format');
        }
    } catch (error) {
        console.error('❌ Error loading AI departments:', error);
        showNotification('Ошибка загрузки подразделений', 'error');
    }
}

// Set default dates (last 7 days)
function setDefaultDates() {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const dateFromInput = document.getElementById('ai-date-from');
    const dateToInput = document.getElementById('ai-date-to');
    
    if (dateFromInput) {
        dateFromInput.value = weekAgo.toISOString().split('T')[0];
    }
    
    if (dateToInput) {
        dateToInput.value = today.toISOString().split('T')[0];
    }
}

// Handle organization change for cascading department filter in AI section
function onAIOrganizationChange() {
    const organization = document.getElementById('ai-organization-filter').value;
    console.log('AI organization changed to:', organization);
    
    // Clear department selection
    const departmentSelect = document.getElementById('ai-department-filter');
    if (departmentSelect) {
        departmentSelect.value = '';
    }
    
    // Reload departments filtered by organization
    loadAIDepartments(organization);
}

// Setup event handlers
function setupAIEventHandlers() {
    const processBtn = document.getElementById('ai-process-btn');
    const refreshHistoryBtn = document.getElementById('ai-refresh-history');
    const showPromptsBtn = document.getElementById('ai-show-prompts');
    const orgFilter = document.getElementById('ai-organization-filter');
    const historyDropdown = document.getElementById('ai-history-dropdown');
    
    if (processBtn) {
        processBtn.addEventListener('click', runAIAnalysis);
    }
    
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', loadAIHistory);
    }
    
    if (showPromptsBtn) {
        showPromptsBtn.addEventListener('click', showPromptsModal);
    }
    
    // Organization filter change event for cascading departments
    if (orgFilter) {
        orgFilter.addEventListener('change', onAIOrganizationChange);
    }
    
    // History dropdown change event
    if (historyDropdown) {
        historyDropdown.addEventListener('change', onHistoryDropdownChange);
    }
}

// Run AI Analysis
async function runAIAnalysis() {
    const departmentFilter = document.getElementById('ai-department-filter');
    const dateFromInput = document.getElementById('ai-date-from');
    const dateToInput = document.getElementById('ai-date-to');
    const reviewsCountInput = document.getElementById('ai-reviews-count');
    const providerSelect = document.getElementById('ai-provider-select');
    const processBtn = document.getElementById('ai-process-btn');
    const btnText = processBtn?.querySelector('.btn-text');
    const spinner = processBtn?.querySelector('.spinner');
    
    // Validation
    if (!departmentFilter?.value) {
        showNotification('Выберите подразделение', 'error');
        return;
    }
    
    if (!dateFromInput?.value || !dateToInput?.value) {
        showNotification('Выберите период анализа', 'error');
        return;
    }
    
    const startDate = new Date(dateFromInput.value);
    const endDate = new Date(dateToInput.value);
    
    if (startDate >= endDate) {
        showNotification('Дата начала должна быть раньше даты конца', 'error');
        return;
    }
    
    if ((endDate - startDate) / (1000 * 60 * 60 * 24) > 30) {
        showNotification('Максимальный период анализа - 30 дней', 'error');
        return;
    }
    
    // Show loading state
    if (processBtn) processBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline';
    if (btnText) btnText.textContent = 'Анализ выполняется...';
    
    // Hide placeholder and show progress
    hideAIPlaceholder();
    showAnalysisProgress();
    
    try {
        const selectedProvider = providerSelect?.value || 'claude';
        
        const requestData = {
            department_id: departmentFilter.value,
            date_start: dateFromInput.value,
            date_end: dateToInput.value,
            reviews_count: parseInt(reviewsCountInput?.value || '50'),
            provider: selectedProvider
        };
        
        console.log('🚀 Starting AI analysis:', requestData);
        
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData),
            signal: AbortSignal.timeout(300000) // 5 минут таймаут для совместимости с OpenAI
        });
        
        let result;
        try {
            const responseText = await response.text();
            console.log('📊 Raw response:', responseText.substring(0, 200) + '...');
            
            // Check if response is HTML (error page)
            if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
                if (response.status === 504) {
                    // 504 timeout - анализ может все еще выполняться на backend
                    throw new Error(`Таймаут запроса (504). Анализ может выполняться в фоновом режиме. Проверьте историю анализов через 1-2 минуты.`);
                } else {
                    throw new Error(`Сервер вернул HTML вместо JSON. Статус: ${response.status}. Возможно, произошел таймаут или внутренняя ошибка сервера.`);
                }
            }
            
            result = JSON.parse(responseText);
            console.log('📊 AI analysis result:', result);
        } catch (parseError) {
            if (parseError.message.includes('HTML')) {
                throw parseError; // Re-throw our custom HTML error
            }
            throw new Error(`Ошибка парсинга ответа сервера: ${parseError.message}`);
        }
        
        if (result.success) {
            currentAnalysisId = result.data.analysis_id;
            
            // Update progress to completed
            updateProgressStep('completed', 'Анализ завершен успешно!');
            
            // Display results
            displayAnalysisResults(result.data);
            
            // Add provider information to results
            if (result.data.provider) {
                setTimeout(() => {
                    const resultsContainer = document.getElementById('ai-results-container');
                    addProviderInfoToResults(result.data.provider, resultsContainer);
                }, 100);
            }
            
            // Refresh history
            await loadAIHistory();
            
            showNotification('AI-анализ завершен успешно!', 'success');
        } else {
            throw new Error(result.error || 'Неизвестная ошибка анализа');
        }
        
    } catch (error) {
        console.error('❌ AI analysis error:', error);
        
        if (error.name === 'TimeoutError' || error.message.includes('signal timed out') || error.message.includes('504') || error.message.includes('Таймаут')) {
            updateProgressStep('warning', `⏰ Превышен таймаут клиента (5 мин). Анализ может продолжаться на сервере...`);
            showNotification(`OpenAI анализ занимает больше времени. Проверьте результаты через 1-2 минуты в истории анализов.`, 'warning');
            
            // Запускаем проверку результатов каждые 15 секунд, до 8 попыток (2 минуты)
            let checkAttempts = 0;
            const maxAttempts = 8;
            
            const checkForResults = async () => {
                checkAttempts++;
                console.log(`⏱️ Попытка ${checkAttempts}/${maxAttempts}: Проверка результатов анализа...`);
                
                try {
                    await loadAIHistory();
                    
                    // Проверяем, есть ли новый анализ за последние 2 минуты
                    const historyContainer = document.querySelector('.ai-history-container');
                    const latestAnalysis = historyContainer?.querySelector('.ai-history-item');
                    
                    if (latestAnalysis) {
                        const analysisTime = latestAnalysis.getAttribute('data-created-at');
                        const analysisDate = new Date(analysisTime);
                        const now = new Date();
                        const timeDiff = (now - analysisDate) / 1000; // в секундах
                        
                        if (timeDiff < 600) { // Анализ создан менее 10 минут назад
                            const analysisId = latestAnalysis.getAttribute('data-analysis-id');
                            console.log('✅ Найден свежий анализ, загружаем результаты...', analysisId);
                            
                            // Загружаем и отображаем результаты
                            await displayAnalysisById(analysisId);
                            updateProgressStep('completed', 'Анализ завершен успешно!');
                            showNotification('AI-анализ завершен! Результаты отображены.', 'success');
                            return; // Прекращаем проверки
                        }
                    }
                    
                    // Если результаты не найдены и это не последняя попытка
                    if (checkAttempts < maxAttempts) {
                        updateProgressStep('warning', `Проверка результатов... (${checkAttempts}/${maxAttempts})`);
                        setTimeout(checkForResults, 15000); // Повторить через 15 секунд
                    } else {
                        updateProgressStep('error', 'Таймаут: анализ не завершен. Проверьте историю позже.');
                        showNotification('Анализ займет больше времени. Проверьте историю анализов через несколько минут.', 'info');
                    }
                } catch (checkError) {
                    console.error('❌ Ошибка при проверке результатов:', checkError);
                    if (checkAttempts < maxAttempts) {
                        setTimeout(checkForResults, 10000);
                    }
                }
            };
            
            // Начинаем проверку через 15 секунд после таймаута
            setTimeout(checkForResults, 15000);
        } else {
            updateProgressStep('error', `Ошибка: ${error.message}`);
            showNotification(`Ошибка анализа: ${error.message}`, 'error');
        }
    } finally {
        // Reset button state
        if (processBtn) processBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.textContent = '🤖 Запустить анализ';
    }
}

// Hide AI placeholder
function hideAIPlaceholder() {
    const placeholder = document.getElementById('ai-placeholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }
}

// Show analysis progress
function showAnalysisProgress() {
    const placeholder = document.getElementById('ai-placeholder');
    const resultsContainer = document.getElementById('ai-results-container');
    const mainContent = document.querySelector('.ai-main-content');
    
    // Hide placeholder
    if (placeholder) placeholder.style.display = 'none';
    
    // Show progress in results container or create progress element
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
    
    // Create or update progress element
    let progressEl = document.getElementById('ai-progress');
    if (!progressEl) {
        progressEl = document.createElement('div');
        progressEl.id = 'ai-progress';
        progressEl.className = 'ai-progress';
        if (mainContent) {
            mainContent.insertBefore(progressEl, mainContent.firstChild);
        }
    }
    
    progressEl.style.display = 'block';
    progressEl.innerHTML = `
        <div class="ai-progress-card">
            <div class="ai-progress-header">
                <span class="ai-progress-spinner"></span>
                <h3>Выполняется мультиагентный анализ</h3>
            </div>
            <ul class="ai-progress-steps">
                <li class="ai-progress-step active" id="step-data">
                    <span class="ai-step-icon">📊</span>
                    <span>Получение данных от MCP API...</span>
                </li>
                <li class="ai-progress-step" id="step-agents">
                    <span class="ai-step-icon">🤖</span>
                    <span>Запуск 6 AI-агентов...</span>
                </li>
                <li class="ai-progress-step" id="step-analysis">
                    <span class="ai-step-icon">📈</span>
                    <span>Анализ и формирование рекомендаций...</span>
                </li>
                <li class="ai-progress-step" id="step-complete">
                    <span class="ai-step-icon">✅</span>
                    <span>Сохранение результатов...</span>
                </li>
            </ul>
        </div>
    `;
    
    // Simulate progress steps
    setTimeout(() => updateProgressStep('step-data', 'completed'), 1000);
    setTimeout(() => updateProgressStep('step-agents', 'active'), 2000);
    setTimeout(() => updateProgressStep('step-analysis', 'active'), 5000);
    setTimeout(() => updateProgressStep('step-complete', 'active'), 8000);
}

// Update progress step
function updateProgressStep(stepId, status) {
    const step = document.getElementById(stepId);
    if (!step) return;
    
    // Remove existing status classes
    step.classList.remove('active', 'completed', 'error');
    
    if (status === 'completed') {
        step.classList.add('completed');
        const icon = step.querySelector('.step-icon');
        if (icon) icon.textContent = '✅';
    } else if (status === 'error') {
        step.classList.add('error');
        const icon = step.querySelector('.step-icon');
        if (icon) icon.textContent = '❌';
    } else if (status === 'active') {
        step.classList.add('active');
    }
    
    // If it's a custom message for completed/error
    if (typeof status === 'string' && (stepId === 'completed' || stepId === 'error')) {
        const progressContainer = document.querySelector('.ai-analysis-progress');
        if (progressContainer) {
            const statusClass = stepId === 'error' ? 'error' : 'success';
            progressContainer.innerHTML = `
                <div class="progress-header">
                    <span class="progress-icon">${stepId === 'error' ? '❌' : '✅'}</span>
                    <h3 class="progress-title">${status}</h3>
                </div>
            `;
            progressContainer.className = `ai-analysis-progress ${statusClass}`;
        }
    }
}

// Load and display analysis by ID
async function displayAnalysisById(analysisId) {
    console.log('🔍 Loading analysis by ID:', analysisId);
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/analysis/${analysisId}`);
        if (!response.ok) {
            throw new Error(`Failed to load analysis: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success && result.data) {
            console.log('✅ Analysis loaded successfully:', result.data);
            displayAnalysisResults(result.data);
            return true;
        } else {
            throw new Error(result.error || 'Failed to load analysis data');
        }
    } catch (error) {
        console.error('❌ Error loading analysis by ID:', error);
        showNotification(`Ошибка загрузки анализа: ${error.message}`, 'error');
        return false;
    }
}

// Display analysis results with horizontal agent tabs
function displayAnalysisResults(analysisData) {
    console.log('🎯 displayAnalysisResults called with:', analysisData);
    
    const resultsContainer = document.getElementById('ai-results-container');
    const placeholder = document.getElementById('ai-placeholder');
    const progressEl = document.getElementById('ai-progress');
    const summaryContainer = document.getElementById('ai-analysis-summary');
    const tabsNav = document.getElementById('ai-agents-tabs-nav');
    const tabsContent = document.getElementById('ai-agents-tabs-content');
    
    if (!resultsContainer) {
        console.error('❌ ai-results-container not found!');
        return;
    }
    
    console.log('✅ Results container found, displaying...');
    
    // Hide placeholder and progress, show results
    if (placeholder) placeholder.style.display = 'none';
    if (progressEl) progressEl.style.display = 'none';
    resultsContainer.style.display = 'block';
    
    // Get organization and department info
    const departmentFilter = document.getElementById('ai-department-filter');
    const selectedOption = departmentFilter?.querySelector(`option[value="${analysisData.department_id}"]`);
    let departmentName = selectedOption?.getAttribute('data-department-name') || selectedOption?.textContent;
    
    if (!departmentName || departmentName === 'Неизвестно') {
        departmentName = analysisData.department_name || analysisData.department_id || 'Неизвестно';
    }
    
    // Получаем название организации
    let organizationName = analysisData.organization_name || '';
    if (!organizationName && selectedOption) {
        organizationName = selectedOption.getAttribute('data-company') || '';
    }
    
    console.log('🏢 Organization:', organizationName, 'Department:', departmentName);
    
    // Calculate days
    const daysAnalyzed = Math.max(1, Math.round(
        (Date.parse(analysisData.period.end) - Date.parse(analysisData.period.start)) / (1000 * 60 * 60 * 24)
    ));
    
    // Format dates - extract only YYYY-MM-DD part
    const formatDateOnly = (dateStr) => {
        if (!dateStr) return '';
        return dateStr.split('T')[0];
    };
    
    const periodStart = formatDateOnly(analysisData.period.start);
    const periodEnd = formatDateOnly(analysisData.period.end);
    
    // Render summary - показываем организацию в заголовке
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="ai-summary-header">
                <div class="ai-summary-title">
                    <span class="ai-summary-icon">📊</span>
                    <div>
                        <h3>Результаты анализа</h3>
                        <p class="ai-summary-subtitle">${organizationName || departmentName}</p>
                    </div>
                </div>
                <div class="ai-summary-meta">
                    <span class="ai-summary-period">${periodStart} — ${periodEnd}</span>
                    <span class="ai-summary-badge">${daysAnalyzed} дн.</span>
                </div>
            </div>
            <div class="ai-summary-stats">
                <div class="ai-summary-stat">
                    <span class="ai-summary-stat-value">${Object.keys(analysisData.agent_results).length}</span>
                    <span class="ai-summary-stat-label">агентов</span>
                </div>
            </div>
        `;
    }
    
    // Generate tabs navigation and content
    if (tabsNav && tabsContent) {
        const { tabsNavHTML, tabsContentHTML } = generateAgentTabsHTML(analysisData.agent_results);
        tabsNav.innerHTML = tabsNavHTML;
        tabsContent.innerHTML = tabsContentHTML;
        
        // Setup tab switching
        setupAgentTabsSwitching();
    }
    
    // Setup webhook functionality
    setupWebhookSender(analysisData);
    
    // Setup PDF export functionality
    setupPDFExport(analysisData, departmentName);
}

// Agent configuration
const AGENT_CONFIG = {
    SalesAnalysisAgent: { icon: '📈', title: 'Продажи', fullTitle: 'Аналитик продаж', description: 'Анализ прогнозов и динамики продаж' },
    PayrollAnalysisAgent: { icon: '💰', title: 'Затраты', fullTitle: 'Аналитик затрат', description: 'Анализ ФОТ и эффективности персонала' },
    StaffingAgent: { icon: '👥', title: 'Смены', fullTitle: 'Оптимизация смен', description: 'Распределение персонала по часам' },
    ReputationAgent: { icon: '⭐', title: 'Репутация', fullTitle: 'Анализ репутации', description: 'Отзывы клиентов и проблемы сервиса' },
    OptimizationAgent: { icon: '🎯', title: 'Оптимизация', fullTitle: 'Консультант оптимизации', description: 'Конкретные шаги улучшения' },
    NarrativeAgent: { icon: '📊', title: 'Итоги', fullTitle: 'Бизнес-консультант', description: 'Итоговый отчет для управляющего' }
};

// Define agent order for consistent display
const AGENT_ORDER = [
    'SalesAnalysisAgent',
    'PayrollAnalysisAgent', 
    'StaffingAgent',
    'ReputationAgent',
    'OptimizationAgent',
    'NarrativeAgent'
];

// Generate horizontal agent tabs HTML
function generateAgentTabsHTML(agentResults) {
    let tabsNavHTML = '';
    let tabsContentHTML = '';
    let isFirst = true;
    
    // Use defined order, filtering to only include agents with results
    const orderedAgents = AGENT_ORDER.filter(name => agentResults.hasOwnProperty(name));
    // Add any agents not in the predefined order
    Object.keys(agentResults).forEach(name => {
        if (!orderedAgents.includes(name)) {
            orderedAgents.push(name);
        }
    });
    
    orderedAgents.forEach(agentName => {
        const result = agentResults[agentName];
        const config = AGENT_CONFIG[agentName] || { icon: '🤖', title: agentName, fullTitle: agentName, description: 'AI агент' };
        const isError = result.error || false;
        const resultText = isError ? result.message || 'Ошибка выполнения агента' : result;
        const activeClass = isFirst ? 'active' : '';
        
        // Tab button
        tabsNavHTML += `
            <button class="ai-agent-tab ${activeClass} ${isError ? 'error' : ''}" 
                    data-agent="${agentName}" 
                    title="${config.fullTitle}">
                <span class="ai-agent-tab-icon">${config.icon}</span>
                <span class="ai-agent-tab-title">${config.title}</span>
            </button>
        `;
        
        // Tab content
        tabsContentHTML += `
            <div class="ai-agent-pane ${activeClass}" data-agent="${agentName}">
                <div class="ai-agent-pane-header">
                    <div class="ai-agent-pane-title">
                        <span class="ai-agent-pane-icon">${config.icon}</span>
                        <div>
                            <h4>${config.fullTitle}</h4>
                            <p>${config.description}</p>
                        </div>
                    </div>
                    <div class="ai-agent-pane-tabs">
                        <button class="ai-pane-tab active" data-tab="result" data-agent="${agentName}">
                            Результат
                        </button>
                        <button class="ai-pane-tab" data-tab="prompt" data-agent="${agentName}">
                            Промпт
                        </button>
                    </div>
                </div>
                <div class="ai-agent-pane-content">
                    <div class="ai-pane-panel active" data-tab="result" data-agent="${agentName}">
                        <div class="ai-result-text ${isError ? 'error' : ''}">${resultText}</div>
                    </div>
                    <div class="ai-pane-panel" data-tab="prompt" data-agent="${agentName}">
                        <div class="ai-prompt-content">
                            <div class="ai-prompt-loading">
                                <span class="spinner"></span>
                                Загрузка промпта...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        isFirst = false;
    });
    
    return { tabsNavHTML, tabsContentHTML };
}

// Setup agent tabs switching
function setupAgentTabsSwitching() {
    // Main agent tabs switching
    document.querySelectorAll('.ai-agent-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const agentName = tab.dataset.agent;
            
            // Update tab buttons
            document.querySelectorAll('.ai-agent-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update panes
            document.querySelectorAll('.ai-agent-pane').forEach(pane => {
                pane.classList.toggle('active', pane.dataset.agent === agentName);
            });
        });
    });
    
    // Inner tabs (Result/Prompt) switching
    document.querySelectorAll('.ai-pane-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const agentName = tab.dataset.agent;
            const tabType = tab.dataset.tab;
            const pane = tab.closest('.ai-agent-pane');
            
            // Update tab buttons within this pane
            pane.querySelectorAll('.ai-pane-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update panels within this pane
            pane.querySelectorAll('.ai-pane-panel').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.tab === tabType);
            });
            
            // Load prompt data if needed
            if (tabType === 'prompt' && currentAnalysisId) {
                loadAgentPromptNew(agentName, currentAnalysisId, pane);
            }
        });
    });
}

// Load agent prompt for new tab structure
async function loadAgentPromptNew(agentName, analysisId, pane) {
    const promptContent = pane.querySelector('.ai-prompt-content');
    if (!promptContent) return;
    
    // Check if already loaded
    if (promptContent.querySelector('.ai-prompt-details')) {
        return;
    }
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/prompts/${analysisId}`);
        const data = await response.json();
        
        if (data.success) {
            const agents = data.data.agents || [];
            const agent = agents.find(a => a.name === agentName);
            
            if (agent && agent.prompt) {
                const prompt = agent.prompt;
                const requestTime = new Date(prompt.request_timestamp).toLocaleString('ru-RU');
                const responseTime = prompt.response_timestamp ? new Date(prompt.response_timestamp).toLocaleString('ru-RU') : 'Не завершен';
                
                promptContent.innerHTML = `
                    <div class="ai-prompt-details">
                        <div class="ai-prompt-meta">
                            <div class="ai-prompt-meta-item">
                                <strong>Провайдер:</strong> ${prompt.provider.toUpperCase()}
                            </div>
                            <div class="ai-prompt-meta-item">
                                <strong>Время:</strong> ${requestTime}
                            </div>
                            ${prompt.response_time_seconds ? `
                                <div class="ai-prompt-meta-item">
                                    <strong>Выполнение:</strong> ${Math.round(prompt.response_time_seconds * 100) / 100} сек
                                </div>
                            ` : ''}
                            <div class="ai-prompt-meta-item">
                                <span class="ai-prompt-status ${prompt.success ? 'success' : 'error'}">
                                    ${prompt.success ? '✅ Успешно' : '❌ Ошибка'}
                                </span>
                            </div>
                        </div>
                        
                        <div class="ai-prompt-section">
                            <div class="ai-prompt-section-header">
                                <h5>Отправленный промпт</h5>
                                <button class="ai-copy-btn" data-prompt="${encodeURIComponent(prompt.full_prompt)}">
                                    📋 Копировать
                                </button>
                            </div>
                            <pre class="ai-prompt-text">${prompt.full_prompt}</pre>
                        </div>
                        
                        ${prompt.system_prompt ? `
                            <div class="ai-prompt-section">
                                <div class="ai-prompt-section-header">
                                    <h5>Системный промпт</h5>
                                    <button class="ai-copy-btn" data-prompt="${encodeURIComponent(prompt.system_prompt)}">
                                        📋 Копировать
                                    </button>
                                </div>
                                <pre class="ai-prompt-text ai-prompt-text--system">${prompt.system_prompt}</pre>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                // Setup copy buttons
                setupCopyButtonsNew(promptContent);
            } else {
                promptContent.innerHTML = `
                    <div class="ai-prompt-error">
                        <span>⚠️</span>
                        <p>Промпт для агента не найден</p>
                    </div>
                `;
            }
        } else {
            throw new Error(data.error || 'Ошибка загрузки');
        }
    } catch (error) {
        console.error('❌ Error loading agent prompt:', error);
        promptContent.innerHTML = `
            <div class="ai-prompt-error">
                <span>❌</span>
                <p>Ошибка загрузки: ${error.message}</p>
            </div>
        `;
    }
}

// Setup copy buttons for new structure
function setupCopyButtonsNew(container) {
    container.querySelectorAll('.ai-copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const promptText = decodeURIComponent(button.dataset.prompt);
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(promptText).then(() => {
                    showNotification('Промпт скопирован', 'success');
                    button.textContent = '✅ Скопировано';
                    setTimeout(() => { button.textContent = '📋 Копировать'; }, 2000);
                }).catch(() => {
                    showNotification('Ошибка копирования', 'error');
                });
            }
        });
    });
}

// Setup webhook sender
function setupWebhookSender(analysisData) {
    const sendBtn = document.getElementById('webhook-send-btn');
    const urlInput = document.getElementById('webhook-url');
    const statusDiv = document.getElementById('webhook-status');
    
    if (sendBtn && urlInput) {
        sendBtn.addEventListener('click', async () => {
            const webhookUrl = urlInput.value.trim();
            
            if (!webhookUrl) {
                showWebhookStatus('Укажите URL webhook', 'error');
                return;
            }
            
            if (!webhookUrl.startsWith('http')) {
                showWebhookStatus('URL должен начинаться с http:// или https://', 'error');
                return;
            }
            
            sendBtn.disabled = true;
            sendBtn.textContent = 'Отправляется...';
            
            try {
                const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-webhook-proxy`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        webhook_url: webhookUrl,
                        analysis_data: analysisData
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showWebhookStatus('Данные успешно отправлены на webhook', 'success');
                } else {
                    showWebhookStatus(result.error || 'Ошибка отправки на webhook', 'error');
                }
                
            } catch (error) {
                console.error('Webhook send error:', error);
                showWebhookStatus(`Ошибка отправки: ${error.message}`, 'error');
            } finally {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Отправить';
            }
        });
    }
    
    function showWebhookStatus(message, type) {
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `webhook-status ${type}`;
        }
    }
}

// Setup PDF export functionality
function setupPDFExport(analysisData, departmentName) {
    const exportBtn = document.getElementById('export-pdf-btn');
    const statusDiv = document.getElementById('export-status');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="btn-icon">⏳</span> Генерация PDF...';
            
            try {
                await generatePDFReport(analysisData, departmentName);
                showExportStatus('PDF успешно скачан', 'success');
            } catch (error) {
                console.error('❌ PDF export error:', error);
                showExportStatus(`Ошибка генерации PDF: ${error.message}`, 'error');
            } finally {
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<span class="btn-icon">📄</span> Скачать PDF';
            }
        });
    }
    
    function showExportStatus(message, type) {
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `export-status ${type}`;
            
            // Auto-hide success message after 3 seconds
            if (type === 'success') {
                setTimeout(() => {
                    statusDiv.textContent = '';
                    statusDiv.className = 'export-status';
                }, 3000);
            }
        }
    }
}

// Load jsPDF if not available
async function ensureJsPDFLoaded() {
    // Check if jsPDF is already loaded in any format
    if (typeof window.jsPDF !== 'undefined' || 
        typeof window.jspdf !== 'undefined' ||
        (window.jsPDF && typeof window.jsPDF.jsPDF === 'function')) {
        console.log('✅ jsPDF already available:', {
            'typeof window.jsPDF': typeof window.jsPDF,
            'typeof window.jspdf': typeof window.jspdf
        });
        return true;
    }
    
    console.log('📄 jsPDF not found, attempting to load...');
    
    const cdnUrls = [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.5.3/jspdf.min.js'
    ];
    
    for (let i = 0; i < cdnUrls.length; i++) {
        const url = cdnUrls[i];
        console.log(`📄 Trying to load jsPDF from: ${url}`);
        
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.onload = () => {
                    console.log(`✅ jsPDF script loaded from ${url}`);
                    // Wait a bit for the library to initialize
                    setTimeout(() => {
                        console.log('📄 Checking jsPDF availability:', {
                            'typeof window.jsPDF': typeof window.jsPDF,
                            'window.jsPDF': window.jsPDF,
                            'typeof window.jspdf': typeof window.jspdf,
                            'window.jspdf': window.jspdf,
                            'jsPDF on window': 'jsPDF' in window,
                            'jspdf on window': 'jspdf' in window
                        });
                        
                        // jsPDF может быть доступен в разных форматах
                        if (typeof window.jsPDF !== 'undefined' || 
                            typeof window.jspdf !== 'undefined' || 
                            (window.jsPDF && typeof window.jsPDF.jsPDF === 'function')) {
                            resolve(true);
                        } else {
                            reject(new Error(`jsPDF загружен с ${url}, но не инициализирован`));
                        }
                    }, 300);
                };
                script.onerror = () => {
                    console.error(`❌ Failed to load jsPDF from ${url}`);
                    reject(new Error(`Не удалось загрузить jsPDF с ${url}`));
                };
                document.head.appendChild(script);
            });
            
            // If we get here, jsPDF was loaded successfully
            return true;
            
        } catch (error) {
            console.warn(`⚠️ Failed to load from ${url}:`, error.message);
            if (i === cdnUrls.length - 1) {
                // This was the last URL, throw the error
                throw new Error(`Не удалось загрузить jsPDF ни с одного CDN. Последняя ошибка: ${error.message}`);
            }
            // Continue to next CDN
        }
    }
}

// Simple PDF generation fallback (if jsPDF fails)
function generateSimplePDFText(analysisData, departmentName) {
    const timestamp = new Date().toLocaleString('ru-RU');
    let content = `AI-рекомендации для подразделения: ${departmentName}\n\n`;
    content += `Дата создания: ${timestamp}\n\n`;
    
    if (analysisData.agent_results) {
        Object.entries(analysisData.agent_results).forEach(([agentName, result]) => {
            content += `=== ${agentName} ===\n`;
            content += typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            content += '\n\n';
        });
    }
    
    // Create downloadable text file
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI-рекомендации_${departmentName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Generate PDF report
async function generatePDFReport(analysisData, departmentName) {
    console.log('📄 Starting PDF generation...');
    
    // Detailed environment check
    console.log('📄 Environment check:', {
        'typeof window.jsPDF': typeof window.jsPDF,
        'window.jsPDF': window.jsPDF,
        'typeof window.jspdf': typeof window.jspdf,
        'window.jspdf': window.jspdf,
        'navigator.userAgent': navigator.userAgent,
        'location.hostname': location.hostname
    });
    
    // Try simpler approach first - check if jsPDF is already available
    let jsPDFConstructor = null;
    
    // Check all possible jsPDF locations
    if (typeof window.jsPDF === 'function') {
        jsPDFConstructor = window.jsPDF;
        console.log('📄 Found jsPDF as direct function');
    } else if (window.jsPDF && typeof window.jsPDF.jsPDF === 'function') {
        jsPDFConstructor = window.jsPDF.jsPDF;
        console.log('📄 Found jsPDF.jsPDF (UMD)');
    } else if (window.jsPDF && window.jsPDF.default && typeof window.jsPDF.default === 'function') {
        jsPDFConstructor = window.jsPDF.default;
        console.log('📄 Found jsPDF.default');
    } else if (typeof window.jspdf === 'function') {
        jsPDFConstructor = window.jspdf;
        console.log('📄 Found jspdf (lowercase)');
    }
    
    // If not found, try to load it
    if (!jsPDFConstructor) {
        console.log('📄 jsPDF not found, attempting to load...');
        try {
            await ensureJsPDFLoaded();
            
            // Re-check after loading
            if (typeof window.jsPDF === 'function') {
                jsPDFConstructor = window.jsPDF;
            } else if (window.jsPDF && typeof window.jsPDF.jsPDF === 'function') {
                jsPDFConstructor = window.jsPDF.jsPDF;
            } else if (window.jsPDF && window.jsPDF.default && typeof window.jsPDF.default === 'function') {
                jsPDFConstructor = window.jsPDF.default;
            } else if (typeof window.jspdf === 'function') {
                jsPDFConstructor = window.jspdf;
            }
        } catch (loadError) {
            console.error('❌ Failed to load jsPDF:', loadError);
            // Fallback to text file
            console.log('📄 Falling back to text file download...');
            generateSimplePDFText(analysisData, departmentName);
            return;
        }
    }
    
    if (!jsPDFConstructor) {
        console.error('❌ jsPDF still not available after loading');
        // Fallback to text file
        console.log('📄 Falling back to text file download...');
        generateSimplePDFText(analysisData, departmentName);
        return;
    }
    
    try {
        console.log('📄 Creating jsPDF instance...');
        const doc = new jsPDFConstructor();
    
    // Set font for Cyrillic support
    doc.setFont('helvetica');
    
    let yPosition = 20;
    const lineHeight = 7;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AI-рекомендации для подразделения', margin, yPosition);
    yPosition += lineHeight * 2;
    
    // Department and period info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Подразделение: ${departmentName}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Период анализа: ${analysisData.period.start} — ${analysisData.period.end}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Дата создания: ${new Date(analysisData.created_at).toLocaleString('ru-RU')}`, margin, yPosition);
    yPosition += lineHeight * 2;
    
    // Agent configurations for titles
    const agentConfig = {
        SalesAnalysisAgent: { icon: '📈', title: 'Аналитик продаж', description: 'Анализ прогнозов и динамики продаж' },
        PayrollAnalysisAgent: { icon: '💰', title: 'Аналитик затрат', description: 'Анализ ФОТ и эффективности персонала' },
        StaffingAgent: { icon: '👥', title: 'Оптимизация смен', description: 'Распределение персонала по часам' },
        ReputationAgent: { icon: '⭐', title: 'Анализ репутации', description: 'Отзывы клиентов и проблемы сервиса' },
        OptimizationAgent: { icon: '🎯', title: 'Консультант оптимизации', description: 'Конкретные шаги улучшения' },
        NarrativeAgent: { icon: '📊', title: 'Бизнес-консультант', description: 'Итоговый отчет для управляющего' }
    };
    
    // Agent results
    Object.entries(analysisData.agent_results).forEach(([agentName, result]) => {
        const config = agentConfig[agentName] || { icon: '🤖', title: agentName, description: 'AI агент' };
        
        // Check if we need a new page
        if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
        }
        
        // Agent title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${config.icon} ${config.title}`, margin, yPosition);
        yPosition += lineHeight;
        
        // Agent description
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(config.description, margin, yPosition);
        yPosition += lineHeight + 2;
        
        // Agent result text
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const resultText = result.error ? `Ошибка: ${result.message}` : result;
        const lines = doc.splitTextToSize(resultText, maxWidth);
        
        // Check if result fits on current page
        if (yPosition + lines.length * lineHeight > 280) {
            doc.addPage();
            yPosition = 20;
        }
        
        doc.text(lines, margin, yPosition);
        yPosition += lines.length * lineHeight + 10;
    });
    
    // Footer with generation info
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Сгенерировано AI-системой ${new Date().toLocaleString('ru-RU')} | Страница ${i} из ${pageCount}`,
            margin,
            doc.internal.pageSize.height - 10
        );
    }
    
        // Generate filename
        const fileName = `AI-рекомендации_${departmentName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        // Save PDF
        doc.save(fileName);
        console.log('✅ PDF saved successfully:', fileName);
        
    } catch (pdfError) {
        console.error('❌ PDF generation error:', pdfError);
        // Fallback to text file
        console.log('📄 Falling back to text file download due to PDF error...');
        generateSimplePDFText(analysisData, departmentName);
        throw new Error(`PDF generation failed, downloaded as text file instead: ${pdfError.message}`);
    }
}

// Setup agent collapse functionality and tabs
function setupAgentCollapse() {
    document.querySelectorAll('.agent-result-header').forEach(header => {
        header.addEventListener('click', () => {
            const agentResult = header.closest('.ai-agent-result');
            agentResult.classList.toggle('collapsed');
        });
    });
    
    // Setup tab functionality
    setupAgentTabs();
}

// Setup agent tabs functionality
function setupAgentTabs() {
    document.querySelectorAll('.agent-tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent collapse toggle
            const agentName = button.dataset.agent;
            const tabType = button.dataset.tab;
            
            // Update tab buttons
            const agentContainer = button.closest('.ai-agent-result');
            agentContainer.querySelectorAll('.agent-tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // Update tab panels
            agentContainer.querySelectorAll('.agent-tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            const targetPanel = agentContainer.querySelector(`.agent-tab-panel[data-tab="${tabType}"]`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
            
            // Load prompt data if needed
            if (tabType === 'prompt' && currentAnalysisId) {
                loadAgentPrompt(agentName, currentAnalysisId);
            }
        });
    });
}

// Load agent prompt data
async function loadAgentPrompt(agentName, analysisId) {
    const promptContent = document.querySelector(`.agent-tab-panel[data-tab="prompt"][data-agent="${agentName}"] .agent-prompt-content`);
    
    if (!promptContent) return;
    
    // Check if already loaded
    if (promptContent.querySelector('.prompt-details')) {
        return;
    }
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/prompts/${analysisId}`);
        const data = await response.json();
        
        if (data.success) {
            // Проверяем, что agents существует и является массивом
            const agents = data.data.agents || [];
            console.log('🔍 Available agents:', agents.map(a => a.name || 'unnamed'));
            console.log('🔍 Looking for agent:', agentName);
            
            const agent = agents.find(a => a.name === agentName);
            
            if (agent && agent.prompt) {
                const prompt = agent.prompt;
                const requestTime = new Date(prompt.request_timestamp).toLocaleString('ru-RU');
                const responseTime = prompt.response_timestamp ? new Date(prompt.response_timestamp).toLocaleString('ru-RU') : 'Не завершен';
                
                promptContent.innerHTML = `
                    <div class="prompt-details">
                        <div class="prompt-info">
                            <div class="prompt-info-item">
                                <strong>Агент:</strong> ${agent.title}
                            </div>
                            <div class="prompt-info-item">
                                <strong>Провайдер:</strong> ${prompt.provider.toUpperCase()}
                            </div>
                            <div class="prompt-info-item">
                                <strong>Время запроса:</strong> ${requestTime}
                            </div>
                            <div class="prompt-info-item">
                                <strong>Время ответа:</strong> ${responseTime}
                            </div>
                            ${prompt.response_time_seconds ? `
                                <div class="prompt-info-item">
                                    <strong>Время выполнения:</strong> ${Math.round(prompt.response_time_seconds * 100) / 100} сек
                                </div>
                            ` : ''}
                            ${prompt.tokens_used ? `
                                <div class="prompt-info-item">
                                    <strong>Использовано токенов:</strong> ${prompt.tokens_used}
                                </div>
                            ` : ''}
                            <div class="prompt-info-item">
                                <strong>Статус:</strong> 
                                <span class="prompt-status ${prompt.success ? 'success' : 'error'}">
                                    ${prompt.success ? '✅ Успешно' : '❌ Ошибка'}
                                </span>
                            </div>
                        </div>
                        
                        <div class="prompt-text-container">
                            <div class="prompt-text-header">
                                <h5>Отправленный промпт:</h5>
                                <button class="copy-prompt-btn" data-prompt="${encodeURIComponent(prompt.full_prompt)}">
                                    📋 Скопировать промпт
                                </button>
                            </div>
                            <pre class="prompt-text">${prompt.full_prompt}</pre>
                        </div>
                        
                        ${prompt.system_prompt ? `
                            <div class="system-prompt-container">
                                <div class="system-prompt-header">
                                    <h5>Системный промпт:</h5>
                                    <button class="copy-system-prompt-btn" data-prompt="${encodeURIComponent(prompt.system_prompt)}">
                                        📋 Скопировать системный промпт
                                    </button>
                                </div>
                                <pre class="system-prompt-text">${prompt.system_prompt}</pre>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                // Setup copy buttons
                setupCopyButtons(promptContent);
                
            } else {
                console.warn('🚨 Agent not found or no prompt:', { agentName, agent, hasPrompt: agent?.prompt });
                promptContent.innerHTML = `
                    <div class="prompt-error">
                        <span class="error-icon">⚠️</span>
                        <div class="error-message">Промпт для агента "${agentName}" не найден</div>
                        <div class="error-details">Доступные агенты: ${agents.map(a => a.name || 'unnamed').join(', ')}</div>
                    </div>
                `;
            }
        } else {
            throw new Error(data.error || 'Ошибка загрузки промпта');
        }
        
    } catch (error) {
        console.error('❌ Error loading agent prompt:', error);
        promptContent.innerHTML = `
            <div class="prompt-error">
                <span class="error-icon">❌</span>
                <div class="error-message">Ошибка загрузки промпта: ${error.message}</div>
            </div>
        `;
    }
}

// Setup copy buttons for prompts
function setupCopyButtons(container) {
    container.querySelectorAll('.copy-prompt-btn, .copy-system-prompt-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const promptText = decodeURIComponent(button.dataset.prompt);
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(promptText).then(() => {
                    showNotification('Промпт скопирован в буфер обмена', 'success');
                    
                    // Visual feedback
                    const originalText = button.textContent;
                    button.textContent = '✅ Скопировано';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                }).catch(err => {
                    console.error('❌ Error copying to clipboard:', err);
                    showNotification('Ошибка копирования в буфер обмена', 'error');
                });
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = promptText;
                document.body.appendChild(textArea);
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    showNotification('Промпт скопирован в буфер обмена', 'success');
                    
                    const originalText = button.textContent;
                    button.textContent = '✅ Скопировано';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                } catch (err) {
                    console.error('❌ Error copying to clipboard:', err);
                    showNotification('Ошибка копирования в буфер обмена', 'error');
                }
                
                document.body.removeChild(textArea);
            }
        });
    });
}

// Load AI history
// Load AI history into dropdown
async function loadAIHistory() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/history?limit=20`);
        const data = await response.json();
        
        const historyDropdown = document.getElementById('ai-history-dropdown');
        if (!historyDropdown) return;
        
        // Clear existing options except the first one
        historyDropdown.innerHTML = '<option value="">Выберите анализ...</option>';
        
        if (data.success && data.data && data.data.length > 0) {
            analysisHistory = data.data;
            
            data.data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                const dateStr = formatDateTime(item.created_at);
                // Показываем организацию вместо подразделения
                const orgName = item.organization_name || 'Неизвестно';
                const providerLabel = item.provider_label || item.provider?.toUpperCase() || '';
                option.textContent = `${orgName} (${providerLabel}) • ${dateStr}`;
                option.setAttribute('data-created-at', item.created_at);
                option.setAttribute('data-organization', item.organization_name || '');
                option.setAttribute('data-department', item.department_name || '');
                historyDropdown.appendChild(option);
            });
            
            console.log(`📋 Loaded ${data.data.length} history items into dropdown`);
        }
        
    } catch (error) {
        console.error('❌ Error loading AI history:', error);
    }
}

// Handle history dropdown change
function onHistoryDropdownChange() {
    const dropdown = document.getElementById('ai-history-dropdown');
    const selectedId = dropdown?.value;
    
    if (selectedId) {
        loadHistoryItem(selectedId);
    }
}

// Load history item
async function loadHistoryItem(analysisId) {
    try {
        console.log('🔍 Loading analysis ID:', analysisId);
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/analysis/${analysisId}`);
        const data = await response.json();
        
        console.log('📊 History data loaded:', data);
        
        if (data.success) {
            currentAnalysisId = analysisId;
            console.log('✅ Setting current analysis ID to:', analysisId);
            
            hideAIPlaceholder();
            
            const analysisResultsData = {
                analysis_id: analysisId,
                department_id: data.data.department_id,
                department_name: data.data.department_name || data.data.department_id,
                organization_name: data.data.organization_name || '', // Добавляем название организации
                period: {
                    start: data.data.date_start,
                    end: data.data.date_end
                },
                agent_results: data.data.agent_results,
                created_at: data.data.created_at,
                provider: data.data.provider
            };
            
            console.log('📈 Displaying analysis results:', analysisResultsData);
            displayAnalysisResults(analysisResultsData);
            
            showNotification('История анализа загружена', 'success');
        } else {
            console.error('❌ API returned error:', data.error);
            showNotification('Ошибка загрузки истории', 'error');
        }
        
    } catch (error) {
        console.error('❌ Error loading history item:', error);
        showNotification('Ошибка загрузки истории анализа', 'error');
    }
}

// Load AI prompts
async function loadAIPrompts() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/prompts`);
        const data = await response.json();
        
        if (data.success && data.data) {
            agentPrompts = {};
            data.data.forEach(prompt => {
                agentPrompts[prompt.agent_name] = prompt.prompt_text;
            });
            console.log('📝 Loaded AI prompts for', Object.keys(agentPrompts).length, 'agents');
        }
        
    } catch (error) {
        console.error('❌ Error loading AI prompts:', error);
    }
}

// Show prompts modal
function showPromptsModal() {
    // Create modal HTML
    const modalHTML = `
        <div class="ai-prompts-modal" id="ai-prompts-modal">
            <div class="prompts-modal-content">
                <div class="prompts-modal-header">
                    <h3 class="prompts-modal-title">⚙️ Настройка промптов агентов</h3>
                    <button class="prompts-modal-close" id="prompts-modal-close">×</button>
                </div>
                <div class="prompts-modal-body">
                    ${generatePromptsHTML()}
                </div>
                <div class="prompts-modal-footer">
                    <button class="prompts-save-btn" id="prompts-save-btn">💾 Сохранить изменения</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal
    const existingModal = document.getElementById('ai-prompts-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = document.getElementById('ai-prompts-modal');
    modal.classList.add('show');
    
    // Setup modal event handlers
    setupPromptsModal();
}

// Generate prompts HTML
function generatePromptsHTML() {
    const agentConfig = {
        SalesAnalysisAgent: { icon: '📈', title: 'Аналитик продаж' },
        PayrollAnalysisAgent: { icon: '💰', title: 'Аналитик затрат' },
        StaffingAgent: { icon: '👥', title: 'Оптимизация смен' },
        ReputationAgent: { icon: '⭐', title: 'Анализ репутации' },
        OptimizationAgent: { icon: '🎯', title: 'Консультант оптимизации' },
        NarrativeAgent: { icon: '📊', title: 'Бизнес-консультант' }
    };
    
    return Object.entries(agentConfig).map(([agentName, config]) => {
        const prompt = agentPrompts[agentName] || '';
        
        return `
            <div class="prompt-editor">
                <div class="prompt-editor-header">
                    <h4 class="prompt-agent-title">${config.icon} ${config.title}</h4>
                    <button class="prompt-rerun-btn" data-agent="${agentName}" ${!currentAnalysisId ? 'disabled' : ''}>
                        🔄 Перезапустить
                    </button>
                </div>
                <textarea class="prompt-textarea" data-agent="${agentName}" placeholder="Промпт агента...">${prompt}</textarea>
            </div>
        `;
    }).join('');
}

// Setup prompts modal
function setupPromptsModal() {
    const modal = document.getElementById('ai-prompts-modal');
    const closeBtn = document.getElementById('prompts-modal-close');
    const saveBtn = document.getElementById('prompts-save-btn');
    
    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        });
    }
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    });
    
    // Save prompts
    if (saveBtn) {
        saveBtn.addEventListener('click', savePrompts);
    }
    
    // Rerun agent buttons
    document.querySelectorAll('.prompt-rerun-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const agentName = e.target.dataset.agent;
            const textarea = document.querySelector(`textarea[data-agent="${agentName}"]`);
            if (textarea && currentAnalysisId) {
                rerunAgent(agentName, textarea.value);
            }
        });
    });
}

// Save prompts
async function savePrompts() {
    const saveBtn = document.getElementById('prompts-save-btn');
    const textareas = document.querySelectorAll('.prompt-textarea');
    
    const prompts = {};
    textareas.forEach(textarea => {
        const agentName = textarea.dataset.agent;
        prompts[agentName] = textarea.value;
    });
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняется...';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/prompts`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompts })
        });
        
        const result = await response.json();
        
        if (result.success) {
            agentPrompts = { ...prompts };
            showNotification('Промпты успешно сохранены', 'success');
            
            // Close modal
            const modal = document.getElementById('ai-prompts-modal');
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        } else {
            throw new Error(result.error || 'Ошибка сохранения');
        }
        
    } catch (error) {
        console.error('❌ Error saving prompts:', error);
        showNotification(`Ошибка сохранения промптов: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Сохранить изменения';
    }
}

// Rerun single agent
async function rerunAgent(agentName, newPrompt) {
    if (!currentAnalysisId) {
        showNotification('Нет активного анализа для перезапуска агента', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/rerun-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                analysis_id: currentAnalysisId,
                agent_name: agentName,
                new_prompt: newPrompt
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update the agent result in the current view
            const agentResult = document.querySelector(`[data-agent="${agentName}"] .agent-result-text`);
            if (agentResult) {
                agentResult.textContent = result.data.result;
            }
            
            showNotification(`Агент ${agentName} перезапущен успешно`, 'success');
        } else {
            throw new Error(result.error || 'Ошибка перезапуска агента');
        }
        
    } catch (error) {
        console.error('❌ Error rerunning agent:', error);
        showNotification(`Ошибка перезапуска агента: ${error.message}`, 'error');
    }
}

// Load available AI providers and update the select
async function loadAIProviders() {
    console.log('🔍 Loading AI providers...');
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/providers`);
        if (!response.ok) {
            console.warn('⚠️ Failed to load providers, using defaults');
            return;
        }
        
        const data = await response.json();
        if (!data.success) {
            console.warn('⚠️ Providers API returned error:', data.error);
            return;
        }
        
        const providerSelect = document.getElementById('ai-provider-select');
        if (!providerSelect) return;
        
        // Clear existing options
        providerSelect.innerHTML = '';
        
        // Add available providers
        const providers = data.data.availability;
        for (const [providerName, info] of Object.entries(providers)) {
            const option = document.createElement('option');
            option.value = providerName;
            
            // Set display name and status
            const displayNames = {
                'claude': 'Claude (Anthropic)',
                'openai': 'OpenAI GPT-4',
                'gemini': 'Google Gemini'
            };
            
            const displayName = displayNames[providerName] || providerName;
            const status = info.available ? '' : ' (недоступен)';
            option.textContent = displayName + status;
            
            // Disable unavailable providers
            if (!info.available) {
                option.disabled = true;
                option.title = `Недоступен: ${info.error || 'Не настроен'}`;
            }
            
            // Set default selection
            if (providerName === data.data.summary.default_provider && info.available) {
                option.selected = true;
            }
            
            providerSelect.appendChild(option);
        }
        
        console.log(`✅ Loaded ${Object.keys(providers).length} AI providers, ${data.data.summary.available_providers} available`);
        
        // Show provider status in console for debugging
        for (const [name, info] of Object.entries(providers)) {
            const status = info.available ? '✅' : '❌';
            console.log(`${status} ${name}: ${info.available ? 'доступен' : info.error}`);
        }
        
    } catch (error) {
        console.error('❌ Error loading AI providers:', error);
        console.log('📋 Using fallback provider options');
    }
}

// Add provider information to analysis display
function addProviderInfoToResults(provider, analysisContainer) {
    if (!analysisContainer || !provider) return;
    
    // Add provider badge to the analysis header
    const header = analysisContainer.querySelector('.analysis-header');
    if (header && !header.querySelector('.provider-badge')) {
        const providerBadge = document.createElement('span');
        providerBadge.className = 'provider-badge';
        providerBadge.style.cssText = `
            background: #e3f2fd;
            color: #1976d2;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            margin-left: 10px;
            font-weight: 500;
        `;
        
        const providerNames = {
            'claude': '🤖 Claude',
            'openai': '🧠 OpenAI',
            'gemini': '💎 Gemini'
        };
        
        providerBadge.textContent = providerNames[provider] || provider;
        header.appendChild(providerBadge);
    }
}

// Utility function to format date time
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Make function globally available
window.initAIRecommendationSection = initAIRecommendationSection;
window.initAIRecommendationSection = initAIRecommendationSection;