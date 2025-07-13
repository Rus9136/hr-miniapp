// AI Recommendations Frontend Logic

let currentAnalysisId = null;
let agentPrompts = {};
let analysisHistory = [];

// Initialize AI Recommendations section
async function initAIRecommendationSection() {
    console.log('🤖 Initializing AI Recommendation section...');
    
    // Load departments for filter
    await loadAIDepartments();
    
    // Set default dates (last 7 days)
    setDefaultDates();
    
    // Set up event handlers
    setupAIEventHandlers();
    
    // Load history and prompts
    await loadAIHistory();
    await loadAIPrompts();
    
    console.log('✅ AI Recommendation section initialized');
}

// Load departments for AI section
async function loadAIDepartments() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/departments`);
        const data = await response.json();
        
        const departmentFilter = document.getElementById('ai-department-filter');
        if (!departmentFilter) return;
        
        // Clear existing options
        departmentFilter.innerHTML = '<option value="">Выберите подразделение</option>';
        
        // Handle both array format and object format
        const departments = Array.isArray(data) ? data : (data.success && data.data ? data.data : []);
        
        if (departments && departments.length > 0) {
            departments.forEach(dept => {
                if (dept.id_iiko) { // Only departments with id_iiko
                    const option = document.createElement('option');
                    option.value = dept.id_iiko;
                    option.textContent = `${dept.object_name} (${dept.object_company})`;
                    option.setAttribute('data-department-name', dept.object_name);
                    option.setAttribute('data-company', dept.object_company);
                    departmentFilter.appendChild(option);
                }
            });
            
            console.log(`📊 Loaded ${departments.length} departments for AI (${departments.filter(d => d.id_iiko).length} with id_iiko)`);
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

// Setup event handlers
function setupAIEventHandlers() {
    const processBtn = document.getElementById('ai-process-btn');
    const refreshHistoryBtn = document.getElementById('ai-refresh-history');
    const showPromptsBtn = document.getElementById('ai-show-prompts');
    
    if (processBtn) {
        processBtn.addEventListener('click', runAIAnalysis);
    }
    
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', loadAIHistory);
    }
    
    if (showPromptsBtn) {
        showPromptsBtn.addEventListener('click', showPromptsModal);
    }
}

// Run AI Analysis
async function runAIAnalysis() {
    const departmentFilter = document.getElementById('ai-department-filter');
    const dateFromInput = document.getElementById('ai-date-from');
    const dateToInput = document.getElementById('ai-date-to');
    const reviewsCountInput = document.getElementById('ai-reviews-count');
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
        const requestData = {
            department_id: departmentFilter.value,
            date_start: dateFromInput.value,
            date_end: dateToInput.value,
            reviews_count: parseInt(reviewsCountInput?.value || '50')
        };
        
        console.log('🚀 Starting AI analysis:', requestData);
        
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        console.log('📊 AI analysis result:', result);
        
        if (result.success) {
            currentAnalysisId = result.data.analysis_id;
            
            // Update progress to completed
            updateProgressStep('completed', 'Анализ завершен успешно!');
            
            // Display results
            displayAnalysisResults(result.data);
            
            // Refresh history
            await loadAIHistory();
            
            showNotification('AI-анализ завершен успешно!', 'success');
        } else {
            throw new Error(result.error || 'Неизвестная ошибка анализа');
        }
        
    } catch (error) {
        console.error('❌ AI analysis error:', error);
        updateProgressStep('error', `Ошибка: ${error.message}`);
        showNotification(`Ошибка анализа: ${error.message}`, 'error');
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
    const resultsContainer = document.getElementById('ai-results-container');
    if (!resultsContainer) return;
    
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
        <div class="ai-analysis-progress">
            <div class="progress-header">
                <span class="progress-icon">⏳</span>
                <h3 class="progress-title">Выполняется мультиагентный анализ</h3>
            </div>
            <ul class="progress-steps">
                <li class="progress-step active" id="step-data">
                    <span class="step-icon">📊</span>
                    Получение данных от MCP API...
                </li>
                <li class="progress-step" id="step-agents">
                    <span class="step-icon">🤖</span>
                    Запуск 6 AI-агентов...
                </li>
                <li class="progress-step" id="step-analysis">
                    <span class="step-icon">📈</span>
                    Анализ и формирование рекомендаций...
                </li>
                <li class="progress-step" id="step-complete">
                    <span class="step-icon">✅</span>
                    Сохранение результатов...
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

// Display analysis results
function displayAnalysisResults(analysisData) {
    const resultsContainer = document.getElementById('ai-results-container');
    if (!resultsContainer) return;
    
    // Get department info
    const departmentFilter = document.getElementById('ai-department-filter');
    const selectedOption = departmentFilter?.querySelector(`option[value="${analysisData.department_id}"]`);
    const departmentName = selectedOption?.getAttribute('data-department-name') || 'Неизвестно';
    
    resultsContainer.innerHTML = `
        <div class="ai-analysis-summary">
            <div class="summary-header">
                <span class="summary-icon">📊</span>
                <h3 class="summary-title">Результаты анализа</h3>
            </div>
            <div class="summary-stats">
                <div class="summary-stat">
                    <div class="stat-value">6</div>
                    <div class="stat-label">AI агентов</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-value">${Object.keys(analysisData.agent_results).length}</div>
                    <div class="stat-label">Выполнено</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-value">${Math.round((Date.parse(analysisData.created_at) - Date.parse(analysisData.period.start)) / (1000 * 60 * 60 * 24))}</div>
                    <div class="stat-label">Дней анализа</div>
                </div>
            </div>
            <div class="summary-department">
                <strong>Подразделение:</strong> ${departmentName}
            </div>
            <div class="summary-period">
                <strong>Период:</strong> ${analysisData.period.start} — ${analysisData.period.end}
            </div>
        </div>
        
        <div class="ai-agents-results">
            ${generateAgentResultsHTML(analysisData.agent_results)}
        </div>
        
        <div class="webhook-section">
            <div class="webhook-header">
                <span class="webhook-icon">🔗</span>
                <h4 class="webhook-title">Отправить результаты на webhook</h4>
            </div>
            <div class="webhook-controls">
                <input type="url" id="webhook-url" class="webhook-url-input" placeholder="https://example.com/webhook" value="">
                <button id="webhook-send-btn" class="webhook-send-btn">Отправить</button>
            </div>
            <div id="webhook-status" class="webhook-status"></div>
        </div>
    `;
    
    // Setup webhook functionality
    setupWebhookSender(analysisData);
    
    // Setup agent collapse functionality
    setupAgentCollapse();
}

// Generate agent results HTML
function generateAgentResultsHTML(agentResults) {
    const agentConfig = {
        SalesAnalysisAgent: { icon: '📈', title: 'Аналитик продаж', description: 'Анализ прогнозов и динамики продаж' },
        PayrollAnalysisAgent: { icon: '💰', title: 'Аналитик затрат', description: 'Анализ ФОТ и эффективности персонала' },
        StaffingAgent: { icon: '👥', title: 'Оптимизация смен', description: 'Распределение персонала по часам' },
        ReputationAgent: { icon: '⭐', title: 'Анализ репутации', description: 'Отзывы клиентов и проблемы сервиса' },
        OptimizationAgent: { icon: '🎯', title: 'Консультант оптимизации', description: 'Конкретные шаги улучшения' },
        NarrativeAgent: { icon: '📊', title: 'Бизнес-консультант', description: 'Итоговый отчет для управляющего' }
    };
    
    let html = '';
    
    Object.entries(agentResults).forEach(([agentName, result]) => {
        const config = agentConfig[agentName] || { icon: '🤖', title: agentName, description: 'AI агент' };
        const isError = result.error || false;
        const resultText = isError ? result.message || 'Ошибка выполнения агента' : result;
        
        html += `
            <div class="ai-agent-result ${isError ? 'error' : ''}" data-agent="${agentName}">
                <div class="agent-result-header">
                    <div class="agent-header-left">
                        <span class="agent-result-icon">${config.icon}</span>
                        <div>
                            <h4 class="agent-result-title">${config.title}</h4>
                            <p class="agent-result-description">${config.description}</p>
                        </div>
                    </div>
                    <span class="agent-collapse-icon">▼</span>
                </div>
                <div class="agent-result-content">
                    <div class="agent-result-text">${resultText}</div>
                </div>
            </div>
        `;
    });
    
    return html;
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

// Setup agent collapse functionality
function setupAgentCollapse() {
    document.querySelectorAll('.agent-result-header').forEach(header => {
        header.addEventListener('click', () => {
            const agentResult = header.closest('.ai-agent-result');
            agentResult.classList.toggle('collapsed');
        });
    });
}

// Load AI history
async function loadAIHistory() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/history?limit=10`);
        const data = await response.json();
        
        const historyContainer = document.getElementById('ai-history-list');
        if (!historyContainer) return;
        
        if (data.success && data.data && data.data.length > 0) {
            analysisHistory = data.data;
            
            historyContainer.innerHTML = data.data.map(item => `
                <div class="ai-history-item" data-id="${item.id}">
                    <div class="history-info">
                        <div class="history-department">${item.department_name || 'Неизвестно'}</div>
                        <div class="history-period">${item.date_start} — ${item.date_end}</div>
                    </div>
                    <div class="history-date">${formatDateTime(item.created_at)}</div>
                </div>
            `).join('');
            
            // Add click handlers for history items
            historyContainer.querySelectorAll('.ai-history-item').forEach(item => {
                item.addEventListener('click', () => loadHistoryItem(item.dataset.id));
            });
            
        } else {
            historyContainer.innerHTML = '<div class="ai-history-empty">История анализов пуста</div>';
        }
        
    } catch (error) {
        console.error('❌ Error loading AI history:', error);
    }
}

// Load history item
async function loadHistoryItem(analysisId) {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/ai-recommendations/${analysisId}`);
        const data = await response.json();
        
        if (data.success) {
            currentAnalysisId = analysisId;
            hideAIPlaceholder();
            displayAnalysisResults({
                analysis_id: analysisId,
                department_id: data.data.department_id,
                period: {
                    start: data.data.date_start,
                    end: data.data.date_end
                },
                agent_results: data.data.agent_results,
                created_at: data.data.created_at
            });
            
            showNotification('История анализа загружена', 'success');
        } else {
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