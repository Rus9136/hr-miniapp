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
            const agentOrder = ['SalesAnalysisAgent', 'PayrollAnalysisAgent', 'StaffingAgent', 'ReputationAgent', 'OptimizationAgent', 'NarrativeAgent'];

            // Последовательное выполнение агентов
            for (const agentName of agentOrder) {
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

                // Небольшая пауза между запросами
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('[MultiAgent] ✅ Полный анализ завершен');

            return {
                success: true,
                results: results,
                metadata: {
                    total_agents: agentOrder.length,
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

            // Получение промпта (кастомный или из БД, или дефолтный)
            const prompt = customPrompt || await this.getAgentPrompt(agentName) || agent.default_prompt;

            // Подготовка данных для агента
            const agentData = this.prepareAgentData(agent, mcpData, previousResults);

            // Замена плейсхолдеров в промпте
            const processedPrompt = this.processPromptPlaceholders(prompt, agentData);

            // Запуск агента через Anthropic API
            const result = await this.anthropicClient.analyzeWithAgent(agentName, processedPrompt, agentData);

            return result;

        } catch (error) {
            console.error(`[MultiAgent] Ошибка агента ${agentName}:`, error);
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
            total_agents: Object.keys(this.agents).length
        };
    }
}

module.exports = MultiAgentSystem;