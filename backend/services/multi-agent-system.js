const AnthropicClient = require('./anthropic-client');
const { Pool } = require('pg');

require('dotenv').config();

// PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

class MultiAgentSystem {
    constructor() {
        this.anthropicClient = new AnthropicClient();
        
        // Circuit breaker для защиты от перегрузок
        this.circuitBreaker = {
            failureCount: 0,
            lastFailureTime: null,
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            failureThreshold: 3, // Количество ошибок для открытия
            recoveryTimeout: 300000, // 5 минут для восстановления
            halfOpenMaxRequests: 1 // Максимум запросов в HALF_OPEN состоянии
        };
        
        // Конфигурация агентов
        this.agents = {
            SalesAnalysisAgent: {
                name: 'SalesAnalysisAgent',
                description: 'AI-аналитик продаж',
                data_fields: ['forecast', 'plan_vs_fact', 'hourly_sales'],
                default_prompt: `Ты — AI-аналитик продаж.
Проанализируй прогноз продаж по дням, сравнение план-факт, и почасовые продажи:

— Прогноз: {forecast}
— План/факт: {plan_vs_fact}
— Почасовые: {hourly_sales}

Сделай выводы о динамике выручки, выяви пики и провалы, укажи на аномалии и сильные/слабые дни.`
            },

            PayrollAnalysisAgent: {
                name: 'PayrollAnalysisAgent',
                description: 'AI-аналитик затрат',
                data_fields: ['payroll', 'forecast'],
                default_prompt: `Ты — AI-аналитик затрат.
Анализируй выплаты сотрудникам и график смен за период.
Сравни расходы на персонал с прогнозом продаж, оцени эффективность и найди неэффективные смены.

— ФОТ и смены: {payroll}
— Прогноз продаж: {forecast}`
            },

            StaffingAgent: {
                name: 'StaffingAgent',
                description: 'AI по оптимизации смен',
                data_fields: ['payroll', 'hourly_sales'],
                default_prompt: `Ты — AI по оптимизации смен.
Оцени, достаточно ли персонала на пиковых часах продаж, нет ли недогрузки или перегрузки людей.

— Смены: {payroll}
— Почасовые продажи: {hourly_sales}

Дай советы по оптимальному распределению сотрудников.`
            },

            ReputationAgent: {
                name: 'ReputationAgent',
                description: 'AI-аналитик репутации',
                data_fields: ['reviews'],
                default_prompt: `Ты — AI-аналитик репутации.
Проанализируй свежие отзывы клиентов: выяви основные темы, проблемы, повторяющиеся жалобы и сильные стороны.

— Отзывы: {reviews}`
            },

            OptimizationAgent: {
                name: 'OptimizationAgent',
                description: 'AI-консультант по оптимизации',
                data_fields: ['agent_results'],
                default_prompt: `Ты — AI-консультант по оптимизации.
Используй выводы других аналитиков по продажам, ФОТ, расписанию и отзывам клиентов.

Дай список конкретных шагов по оптимизации работы ресторана: как повысить выручку, сократить расходы и улучшить сервис.`
            },

            NarrativeAgent: {
                name: 'NarrativeAgent',
                description: 'Бизнес-консультант для управляющего',
                data_fields: ['all_data', 'agent_results'],
                default_prompt: `Ты — бизнес-консультант для управляющего рестораном.
Составь итоговый отчёт и резюме на основе аналитики по продажам, персоналу, отзывам и рекомендациям.

В начале — краткое резюме, затем подробности по разделам: продажи, персонал, отзывы, шаги по улучшению.`
            }
        };
    }

    /**
     * Запуск полного мультиагентного анализа
     * @param {object} mcpData - Данные от MCP API
     * @returns {object} Результаты всех агентов
     */
    async runAnalysis(mcpData) {
        try {
            console.log('[MultiAgent] Запуск полного мультиагентного анализа...');

            const results = {};
            
            // Разделяем агентов на группы для более стабильного выполнения
            const primaryAgents = ['SalesAnalysisAgent', 'PayrollAnalysisAgent', 'StaffingAgent', 'ReputationAgent'];
            const secondaryAgents = ['OptimizationAgent', 'NarrativeAgent'];

            // Сначала выполняем основные агенты
            console.log('[MultiAgent] 🚀 Запуск основных агентов (1-4)...');
            for (const agentName of primaryAgents) {
                console.log(`[MultiAgent] Запуск агента: ${agentName}`);

                const agentResult = await this.runSingleAgent(agentName, mcpData, null, results);
                
                if (agentResult.success) {
                    results[agentName] = agentResult.result;
                    console.log(`[MultiAgent] ✅ Агент ${agentName} завершен успешно`);
                } else {
                    console.error(`[MultiAgent] ❌ Ошибка агента ${agentName}:`, agentResult.error);
                    results[agentName] = {
                        error: true,
                        message: `Ошибка выполнения агента: ${agentResult.error.message || 'Неизвестная ошибка'}`
                    };
                }

                // Адаптивная пауза между основными агентами с учетом предыдущих ошибок
                let pauseDuration = this.calculateAdaptivePause(agentName, results);
                
                // Дополнительная пауза при обнаружении ошибок 529
                if (agentResult.error && agentResult.error.status === 529) {
                    pauseDuration = Math.max(pauseDuration, 60000); // Минимум 1 минута после 529 ошибки
                    console.log(`[MultiAgent] ⚠️ Обнаружена ошибка 529! Увеличиваем паузу до ${pauseDuration/1000} секунд`);
                }
                
                console.log(`[MultiAgent] ⏳ Адаптивная пауза ${pauseDuration/1000} секунд после агента ${agentName}...`);
                await new Promise(resolve => setTimeout(resolve, pauseDuration));
            }

            // Дополнительная пауза перед зависимыми агентами с учетом предыдущих ошибок
            const preSecondaryPause = this.calculatePreSecondaryPause(results);
            console.log(`[MultiAgent] 🔄 Переход к зависимым агентам (5-6). Дополнительная пауза ${preSecondaryPause/1000} секунд...`);
            await new Promise(resolve => setTimeout(resolve, preSecondaryPause));

            // Теперь выполняем зависимые агенты с большими паузами
            console.log('[MultiAgent] 🎯 Запуск зависимых агентов (OptimizationAgent, NarrativeAgent)...');
            for (const agentName of secondaryAgents) {
                console.log(`[MultiAgent] Запуск зависимого агента: ${agentName}`);

                const agentResult = await this.runSingleAgent(agentName, mcpData, null, results);
                
                if (agentResult.success) {
                    results[agentName] = agentResult.result;
                    console.log(`[MultiAgent] ✅ Зависимый агент ${agentName} завершен успешно`);
                } else {
                    console.error(`[MultiAgent] ❌ Ошибка зависимого агента ${agentName}:`, agentResult.error);
                    results[agentName] = {
                        error: true,
                        message: `Ошибка выполнения агента: ${agentResult.error.message || 'Неизвестная ошибка'}`
                    };
                }

                // Увеличенная пауза между зависимыми агентами с учетом ошибок
                if (agentName !== secondaryAgents[secondaryAgents.length - 1]) { // Не ждем после последнего
                    let secondaryPause = 15000; // Базовая пауза 15 секунд
                    
                    // Если есть ошибка 529, увеличиваем паузу
                    if (agentResult.error && agentResult.error.status === 529) {
                        secondaryPause = 90000; // 1.5 минуты после 529 ошибки
                        console.log(`[MultiAgent] ⚠️ Ошибка 529 в ${agentName}! Увеличиваем паузу до ${secondaryPause/1000} секунд`);
                    }
                    
                    console.log(`[MultiAgent] ⏳ Пауза ${secondaryPause/1000} секунд перед следующим зависимым агентом...`);
                    await new Promise(resolve => setTimeout(resolve, secondaryPause));
                }
            }

            console.log('[MultiAgent] ✅ Полный анализ завершен');

            const totalAgents = primaryAgents.length + secondaryAgents.length;
            return {
                success: true,
                results: results,
                metadata: {
                    total_agents: totalAgents,
                    primary_agents: primaryAgents.length,
                    secondary_agents: secondaryAgents.length,
                    successful_agents: Object.keys(results).filter(key => !results[key].error).length,
                    failed_agents: Object.keys(results).filter(key => results[key].error).length,
                    completed_at: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('[MultiAgent] Критическая ошибка анализа:', error);
            return {
                success: false,
                error: {
                    type: 'system_error',
                    message: error.message
                }
            };
        }
    }

    /**
     * Запуск отдельного агента
     * @param {string} agentName - Название агента
     * @param {object} mcpData - Данные от MCP
     * @param {string} customPrompt - Кастомный промпт (опционально)
     * @param {object} previousResults - Результаты предыдущих агентов
     * @returns {object} Результат агента
     */
    async runSingleAgent(agentName, mcpData, customPrompt = null, previousResults = {}) {
        try {
            const agent = this.agents[agentName];
            if (!agent) {
                throw new Error(`Агент ${agentName} не найден`);
            }

            // Проверка circuit breaker
            const circuitState = this.checkCircuitBreaker();
            if (circuitState === 'OPEN') {
                console.log(`[MultiAgent] 🔴 Circuit breaker OPEN для ${agentName}. Пропускаем выполнение.`);
                return {
                    success: false,
                    agent_name: agentName,
                    error: {
                        type: 'circuit_breaker_open',
                        message: 'Circuit breaker открыт из-за частых ошибок 529'
                    }
                };
            }

            // Получение промпта (кастомный или из БД, или дефолтный)
            const prompt = customPrompt || await this.getAgentPrompt(agentName) || agent.default_prompt;

            // Подготовка данных для агента
            const agentData = this.prepareAgentData(agent, mcpData, previousResults);

            // Замена плейсхолдеров в промпте
            const processedPrompt = this.processPromptPlaceholders(prompt, agentData);

            // Специальные настройки для проблемных агентов
            const agentOptions = {};
            if (agentName === 'StaffingAgent' || agentName === 'NarrativeAgent') {
                agentOptions.maxRetries = 7; // Больше попыток для проблемных агентов
                agentOptions.retryDelay = 10000; // Увеличенная базовая задержка (10 секунд)
                console.log(`[MultiAgent] 🛠️  Применяем специальные настройки для ${agentName}: ${agentOptions.maxRetries} попыток, задержка ${agentOptions.retryDelay/1000}с`);
            }

            // Запуск агента через Anthropic API
            const result = await this.anthropicClient.analyzeWithAgent(agentName, processedPrompt, agentData, agentOptions);

            // Обновление circuit breaker на основе результата
            this.updateCircuitBreaker(result);

            return result;

        } catch (error) {
            console.error(`[MultiAgent] Ошибка агента ${agentName}:`, error);
            
            // Обновление circuit breaker при ошибке
            this.updateCircuitBreaker({ success: false, error: { status: 529 } });
            
            return {
                success: false,
                agent_name: agentName,
                error: {
                    type: 'agent_error',
                    message: error.message
                }
            };
        }
    }

    /**
     * Подготовка данных для конкретного агента
     * @param {object} agent - Конфигурация агента
     * @param {object} mcpData - Данные от MCP
     * @param {object} previousResults - Результаты предыдущих агентов
     * @returns {object} Подготовленные данные
     */
    prepareAgentData(agent, mcpData, previousResults) {
        const agentData = {};

        // Добавляем необходимые поля из MCP данных
        for (const field of agent.data_fields) {
            if (field === 'agent_results') {
                agentData.agent_results = previousResults;
            } else if (field === 'all_data') {
                agentData.all_data = mcpData;
                agentData.agent_results = previousResults;
            } else if (mcpData[field]) {
                agentData[field] = mcpData[field].data || mcpData[field];
            }
        }

        return agentData;
    }

    /**
     * Обработка плейсхолдеров в промпте
     * @param {string} prompt - Исходный промпт
     * @param {object} data - Данные для замены
     * @returns {string} Обработанный промпт
     */
    processPromptPlaceholders(prompt, data) {
        let processedPrompt = prompt;

        // Замена плейсхолдеров {field_name} на JSON данные
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{${key}}`;
            if (processedPrompt.includes(placeholder)) {
                const jsonValue = JSON.stringify(value, null, 2);
                processedPrompt = processedPrompt.replace(placeholder, jsonValue);
            }
        }

        return processedPrompt;
    }

    /**
     * Получение промпта агента из БД
     * @param {string} agentName - Название агента
     * @returns {string|null} Промпт или null
     */
    async getAgentPrompt(agentName) {
        try {
            const query = 'SELECT prompt_text FROM ai_prompts WHERE agent_name = $1';
            const result = await pool.query(query, [agentName]);
            
            return result.rows.length > 0 ? result.rows[0].prompt_text : null;
        } catch (error) {
            console.warn(`[MultiAgent] Не удалось получить промпт для ${agentName}:`, error.message);
            return null;
        }
    }

    /**
     * Инициализация промптов по умолчанию в БД
     * @returns {object} Результат инициализации
     */
    async initializeDefaultPrompts() {
        try {
            console.log('[MultiAgent] Инициализация промптов по умолчанию...');

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                for (const [agentName, agent] of Object.entries(this.agents)) {
                    await client.query(`
                        INSERT INTO ai_prompts (agent_name, prompt_text, updated_at)
                        VALUES ($1, $2, NOW())
                        ON CONFLICT (agent_name) DO NOTHING
                    `, [agentName, agent.default_prompt]);
                }

                await client.query('COMMIT');
                console.log('[MultiAgent] ✅ Промпты по умолчанию инициализированы');

                return { success: true, message: 'Промпты инициализированы' };

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('[MultiAgent] Ошибка инициализации промптов:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Вычисляет адаптивную паузу между основными агентами
     * @param {string} agentName - Название текущего агента
     * @param {object} results - Результаты предыдущих агентов
     * @returns {number} Пауза в миллисекундах
     */
    calculateAdaptivePause(agentName, results) {
        let basePause = 8000; // Базовая пауза 8 секунд
        
        // Специальные паузы для проблемных агентов
        const agentPauses = {
            'SalesAnalysisAgent': 10000,  // 10 секунд
            'PayrollAnalysisAgent': 15000, // 15 секунд
            'StaffingAgent': 25000,       // 25 секунд (самый проблемный)
            'ReputationAgent': 12000      // 12 секунд
        };
        
        basePause = agentPauses[agentName] || basePause;
        
        // Увеличиваем паузу, если в предыдущих агентах были ошибки 529
        const errorCount = Object.values(results).filter(result => 
            result.error && result.error.status === 529
        ).length;
        
        if (errorCount > 0) {
            basePause += errorCount * 30000; // +30 секунд за каждую ошибку 529
            console.log(`[MultiAgent] 📊 Обнаружено ${errorCount} ошибок 529, увеличиваем паузу на ${errorCount * 30}с`);
        }
        
        return basePause;
    }

    /**
     * Вычисляет паузу перед запуском вторичных агентов
     * @param {object} results - Результаты первичных агентов
     * @returns {number} Пауза в миллисекундах
     */
    calculatePreSecondaryPause(results) {
        let basePause = 20000; // Базовая пауза 20 секунд
        
        // Подсчет ошибок 529 в первичных агентах
        const error529Count = Object.values(results).filter(result => 
            result.error && result.error.status === 529
        ).length;
        
        // Подсчет общего количества ошибок
        const totalErrorCount = Object.values(results).filter(result => result.error).length;
        
        // Увеличиваем паузу на основе ошибок
        if (error529Count > 0) {
            basePause += error529Count * 60000; // +1 минута за каждую ошибку 529
            console.log(`[MultiAgent] 📊 ${error529Count} ошибок 529 в первичных агентах, увеличиваем паузу на ${error529Count}мин`);
        }
        
        if (totalErrorCount > 2) {
            basePause += 30000; // +30 секунд при многих ошибках
            console.log(`[MultiAgent] 📊 Много ошибок (${totalErrorCount}), дополнительная пауза +30с`);
        }
        
        return Math.min(basePause, 300000); // Максимум 5 минут
    }

    /**
     * Проверка состояния circuit breaker
     * @returns {string} Состояние: CLOSED, OPEN, HALF_OPEN
     */
    checkCircuitBreaker() {
        const now = Date.now();
        const { state, lastFailureTime, recoveryTimeout } = this.circuitBreaker;
        
        if (state === 'OPEN') {
            if (now - lastFailureTime > recoveryTimeout) {
                console.log('[MultiAgent] 🟡 Circuit breaker переходит в HALF_OPEN состояние');
                this.circuitBreaker.state = 'HALF_OPEN';
                return 'HALF_OPEN';
            }
            return 'OPEN';
        }
        
        return state;
    }

    /**
     * Обновление состояния circuit breaker
     * @param {object} result - Результат выполнения агента
     */
    updateCircuitBreaker(result) {
        const { state } = this.circuitBreaker;
        
        if (result.success) {
            // Успешное выполнение - сбрасываем счетчик ошибок
            if (state === 'HALF_OPEN') {
                console.log('[MultiAgent] 🟢 Circuit breaker закрывается после успешного выполнения');
                this.circuitBreaker.state = 'CLOSED';
            }
            this.circuitBreaker.failureCount = 0;
        } else {
            // Ошибка - увеличиваем счетчик
            if (result.error && result.error.status === 529) {
                this.circuitBreaker.failureCount++;
                this.circuitBreaker.lastFailureTime = Date.now();
                
                console.log(`[MultiAgent] 📊 Circuit breaker: ${this.circuitBreaker.failureCount} ошибок 529`);
                
                // Открываем circuit breaker при превышении порога
                if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
                    console.log('[MultiAgent] 🔴 Circuit breaker ОТКРЫТ из-за частых ошибок 529');
                    this.circuitBreaker.state = 'OPEN';
                }
            }
        }
    }

    /**
     * Получение информации о всех агентах
     * @returns {object} Информация об агентах
     */
    getAgentsInfo() {
        return {
            agents: Object.keys(this.agents).map(name => ({
                name,
                description: this.agents[name].description,
                data_fields: this.agents[name].data_fields
            })),
            total_agents: Object.keys(this.agents).length,
            circuit_breaker: {
                state: this.circuitBreaker.state,
                failure_count: this.circuitBreaker.failureCount,
                last_failure_time: this.circuitBreaker.lastFailureTime
            }
        };
    }
}

module.exports = MultiAgentSystem;