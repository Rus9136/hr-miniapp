const AnthropicClient = require('./anthropic-client');
const { EngineDispatcher } = require('../engines');
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
        // Создаем клиенты с 5 разными API ключами для полной изоляции лимитов
        this.apiClients = {
            // Основной клиент для легких агентов
            default: new AnthropicClient(),
            
            // Специальный клиент для PayrollAnalysisAgent
            PayrollAnalysisAgent: new AnthropicClient(process.env.ANTHROPIC_API_KEY_PAYROLL),
            
            // Специальный клиент для StaffingAgent
            StaffingAgent: new AnthropicClient(process.env.ANTHROPIC_API_KEY_STAFFING),
            
            // Специальный клиент для NarrativeAgent (самые тяжелые промпты!)
            NarrativeAgent: process.env.ANTHROPIC_API_KEY_NARRATIVE ? 
                new AnthropicClient(process.env.ANTHROPIC_API_KEY_NARRATIVE) : null,
            
            // Специальный клиент для ReputationAgent
            ReputationAgent: process.env.ANTHROPIC_API_KEY_REPUTATION ? 
                new AnthropicClient(process.env.ANTHROPIC_API_KEY_REPUTATION) : null
        };
        
        // Для обратной совместимости сохраняем ссылку на дефолтный клиент
        this.anthropicClient = this.apiClients.default;
        
        // Инициализация диспетчера движков для мультипровайдерной поддержки
        this.engineDispatcher = new EngineDispatcher();
        
        console.log('[MultiAgent] 🔑 Инициализирована система с 5 API ключами для полной изоляции лимитов');
        console.log('[MultiAgent] - Ключ DEFAULT: SalesAnalysisAgent, OptimizationAgent');
        console.log('[MultiAgent] - Ключ PAYROLL: PayrollAnalysisAgent');
        console.log('[MultiAgent] - Ключ STAFFING: StaffingAgent');
        console.log('[MultiAgent] - Ключ NARRATIVE: NarrativeAgent (до 460k символов!)');
        console.log('[MultiAgent] - Ключ REPUTATION: ReputationAgent');
        
        // Предупреждение если ключи не настроены
        if (!this.apiClients.NarrativeAgent) {
            console.warn('[MultiAgent] ⚠️  ANTHROPIC_API_KEY_NARRATIVE не настроен! NarrativeAgent будет использовать основной ключ');
        }
        if (!this.apiClients.ReputationAgent) {
            console.warn('[MultiAgent] ⚠️  ANTHROPIC_API_KEY_REPUTATION не настроен! ReputationAgent будет использовать основной ключ');
        }
        
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
                default_prompt: `Ты — AI-аналитик клиентской репутации.

Вот исходные данные:
- Последние отзывы клиентов: {reviews}

Тебе нужно:
1. Проанализировать основные темы и настроения отзывов (положительные, нейтральные, отрицательные).
2. Найти часто повторяющиеся жалобы и замечания.
3. Отметить, что больше всего нравится клиентам.
4. Дать советы по улучшению сервиса на основе обратной связи.

Сделай выводы краткими и прикладными для управляющего.`
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
                data_fields: ['all_data', 'agent_results', 'department_info'],
                default_prompt: `Ты — бизнес-консультант для управляющего рестораном.
Составь итоговый отчёт и резюме на основе аналитики по продажам, персоналу, отзывам и рекомендациям.

Информация о подразделении: {department_info}

В начале — краткое резюме, затем подробности по разделам: продажи, персонал, отзывы, шаги по улучшению.`
            }
        };
    }

    /**
     * Сжимает данные MCP для экономии токенов
     * @param {object} data - Исходные данные
     * @returns {object} Сжатые данные
     */
    compressDataForTokens(data) {
        const compressed = {};
        
        // Функция для извлечения данных из MCP структуры
        const extractData = (field) => {
            if (data[field]) {
                // Проверяем, есть ли вложенное поле .data
                if (typeof data[field] === 'object' && data[field].data !== undefined) {
                    return data[field].data;
                } else {
                    // Если нет поля .data, используем значение напрямую
                    return data[field];
                }
            }
            return null;
        };
        
        // Сначала извлекаем plan_vs_fact для получения actual_sales
        const planVsFactData = extractData('plan_vs_fact');

        // Создаем карту фактических продаж по датам из plan_vs_fact
        const actualSalesMap = {};
        if (planVsFactData && Array.isArray(planVsFactData)) {
            planVsFactData.forEach(item => {
                if (item.date && item.actual_sales !== undefined) {
                    actualSalesMap[item.date] = item.actual_sales;
                }
            });
            console.log(`[MultiAgent] 📊 Загружено ${Object.keys(actualSalesMap).length} фактических продаж из plan_vs_fact`);
        }

        // Сжимаем прогнозы (оставляем только ключевые поля)
        const forecastData = extractData('forecast');
        if (forecastData && Array.isArray(forecastData)) {
            compressed.forecast = forecastData.slice(0, 10).map(item => {
                // Берем actual_sales из plan_vs_fact если нет в forecast
                const actualSales = item.actual_sales !== undefined
                    ? item.actual_sales
                    : actualSalesMap[item.date];

                return {
                    date: item.date,
                    plan: item.predicted_sales ? Math.round(item.predicted_sales / 1000) + 'k' : 'N/A',
                    // Используем actual_sales из forecast или из plan_vs_fact
                    fact: actualSales !== undefined ? Math.round(actualSales / 1000) + 'k' : 'N/A'
                };
            });

            // Логируем статистику
            const withFact = compressed.forecast.filter(f => f.fact !== 'N/A').length;
            console.log(`[MultiAgent] 📊 Forecast: ${compressed.forecast.length} дней, из них ${withFact} с фактическими данными`);
        }

        // Сжимаем данные план/факт
        if (planVsFactData && Array.isArray(planVsFactData)) {
            compressed.plan_vs_fact = planVsFactData.slice(0, 10).map(item => ({
                date: item.date,
                plan: item.predicted_sales ? Math.round(item.predicted_sales / 1000) + 'k' : 'N/A',
                fact: item.actual_sales ? Math.round(item.actual_sales / 1000) + 'k' : 'N/A',
                deviation: item.error_percentage || item.deviation || 0
            }));
        }

        // Сжимаем данные по ФОТ
        const payrollData = extractData('payroll');
        if (payrollData && Array.isArray(payrollData)) {
            compressed.payroll = payrollData.slice(0, 20).map(item => {
                // MCP API возвращает payroll_total, а не total_payroll!
                const totalPayroll = item.payroll_total || item.total_payroll || 0;

                return {
                    name: item.employee_name ? item.employee_name.split(' ')[0] : 'N/A',
                    // shifts - это массив смен, передаем его полностью для анализа
                    shifts: Array.isArray(item.shifts) ? item.shifts : [],
                    // Месячный ФОТ сотрудника
                    payroll: Math.round(totalPayroll / 1000) + 'k'
                };
            });

            // Логируем статистику
            const totalFOT = payrollData.reduce((sum, item) => sum + (item.payroll_total || item.total_payroll || 0), 0);
            console.log(`[MultiAgent] 💰 Payroll: ${compressed.payroll.length} сотрудников, общий ФОТ: ${Math.round(totalFOT / 1000)}k₸`);
        }
        
        // Сжимаем почасовые продажи
        const hourlySalesData = extractData('hourly_sales');
        if (hourlySalesData) {
            compressed.hourly_sales = [];

            // Функция для определения дня недели по дате (Asia/Almaty)
            const getDayInfo = (dateStr) => {
                if (!dateStr) return { day: 'unknown', isWeekend: false };
                const date = new Date(dateStr + 'T12:00:00+05:00'); // Asia/Almaty UTC+5
                const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return {
                    day: days[dayOfWeek],
                    isWeekend: dayOfWeek === 0 || dayOfWeek === 6 // Суббота или воскресенье
                };
            };

            // Обработка записи почасовых продаж
            const processHourlySalesItem = (item) => {
                const dayInfo = getDayInfo(item.date);
                return {
                    date: item.date || null,
                    day: dayInfo.day,
                    h: item.hour,
                    type: dayInfo.isWeekend ? 'weekend' : 'weekday',
                    sales: item.sales_amount ? Math.round(item.sales_amount / 1000) + 'k' : '0k'
                };
            };

            // НОВЫЙ ФОРМАТ: простой массив с данными по каждому дню
            if (Array.isArray(hourlySalesData)) {
                // Сортируем по дате и часу, берем все записи (не ограничиваем)
                const sortedData = hourlySalesData
                    .sort((a, b) => {
                        if (a.date !== b.date) return a.date.localeCompare(b.date);
                        return a.hour - b.hour;
                    });

                compressed.hourly_sales = sortedData.map(processHourlySalesItem);
            }
            // СТАРЫЙ ФОРМАТ (fallback): объект с weekdays/weekends
            else if (hourlySalesData.weekdays || hourlySalesData.weekends) {
                if (hourlySalesData.weekdays && Array.isArray(hourlySalesData.weekdays)) {
                    compressed.hourly_sales.push(...hourlySalesData.weekdays.map(processHourlySalesItem));
                }
                if (hourlySalesData.weekends && Array.isArray(hourlySalesData.weekends)) {
                    const existing = new Set(compressed.hourly_sales.map(i => `${i.date}-${i.h}`));
                    const weekendItems = hourlySalesData.weekends
                        .map(processHourlySalesItem)
                        .filter(item => !existing.has(`${item.date}-${item.h}`));
                    compressed.hourly_sales.push(...weekendItems);
                }
            }

            // Логируем статистику по hourly_sales
            const uniqueDates = [...new Set(compressed.hourly_sales.map(i => i.date).filter(d => d))];
            console.log(`[MultiAgent] ⏰ Hourly sales: ${compressed.hourly_sales.length} записей за ${uniqueDates.length} дней`);
            if (uniqueDates.length === 1) {
                console.warn(`[MultiAgent] ⚠️ ВНИМАНИЕ: Почасовые продажи доступны только за 1 день (${uniqueDates[0]}). MCP API не вернул данные за весь период.`);
            } else if (uniqueDates.length > 1) {
                console.log(`[MultiAgent] ✅ Почасовые продажи за период: ${uniqueDates[0]} - ${uniqueDates[uniqueDates.length - 1]}`);
            }
        }
        
        // Обработка отзывов с правильным лимитом
        const reviewsData = extractData('reviews');
        if (reviewsData && Array.isArray(reviewsData)) {
            // Используем все доступные отзывы (не ограничиваем до 10)
            compressed.reviews = reviewsData.map(item => ({
                rating: item.rating || 0,
                // Проверяем и text, и comment поля, увеличиваем лимит символов
                text: (item.text || item.comment || '').substring(0, 300) // Увеличено до 300 символов
            }));

            console.log(`[MultiAgent] 📊 Обработано отзывов: ${compressed.reviews.length} из ${reviewsData.length} доступных`);
        }

        // Обработка department_info для NarrativeAgent
        const departmentInfoData = extractData('department_info');
        if (departmentInfoData) {
            compressed.department_info = {
                name: departmentInfoData.object_name || 'N/A',
                company: departmentInfoData.object_company || 'N/A',
                hall_area: departmentInfoData.hall_area || null,
                kitchen_area: departmentInfoData.kitchen_area || null,
                seats_count: departmentInfoData.seats_count || null
            };
            console.log(`[MultiAgent] 🏢 Department info: ${compressed.department_info.name} (${compressed.department_info.company})`);
        } else {
            console.warn(`[MultiAgent] ⚠️ department_info отсутствует в MCP данных`);
        }

        // КРИТИЧЕСКОЕ сжатие результатов агентов для NarrativeAgent
        if (data.agent_results) {
            compressed.agent_results = {};
            for (const [agentName, result] of Object.entries(data.agent_results)) {
                if (typeof result === 'string') {
                    // Обрезаем результаты агентов до 500 символов каждый
                    compressed.agent_results[agentName] = result.substring(0, 500) + '...';
                } else {
                    compressed.agent_results[agentName] = result;
                }
            }
        }
        
        console.log(`[MultiAgent] 📦 Сжатие данных: ${JSON.stringify(data).length} → ${JSON.stringify(compressed).length} символов`);
        return compressed;
    }

    /**
     * Запуск полного мультиагентного анализа
     * @param {object} mcpData - Данные от MCP API
     * @param {object} options - Дополнительные параметры (включая provider)
     * @returns {object} Результаты всех агентов
     */
    async runAnalysis(mcpData, options = {}) {
        const { provider = 'claude', analysisId = null } = options;
        // Сжимаем данные для экономии токенов
        const compressedData = this.compressDataForTokens(mcpData);
        try {
            console.log(`[MultiAgent] Запуск полного мультиагентного анализа с провайдером: ${provider}...`);

            const results = {};
            
            // Разделяем агентов на группы для более стабильного выполнения
            const primaryAgents = ['SalesAnalysisAgent', 'PayrollAnalysisAgent', 'StaffingAgent', 'ReputationAgent'];
            const secondaryAgents = ['OptimizationAgent', 'NarrativeAgent'];

            // Сначала выполняем основные агенты
            console.log('[MultiAgent] 🚀 Запуск основных агентов (1-4)...');
            for (const agentName of primaryAgents) {
                console.log(`[MultiAgent] Запуск агента: ${agentName}`);

                const agentResult = await this.runSingleAgent(agentName, compressedData, null, results, { provider, analysisId });
                
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
                
                // Экстремальная пауза при обнаружении ошибок 529
                if (agentResult.error && agentResult.error.status === 529) {
                    pauseDuration = Math.max(pauseDuration, 180000); // Минимум 3 минуты после 529 ошибки
                    console.log(`[MultiAgent] 🚨 КРИТИЧЕСКАЯ ошибка 529! Увеличиваем паузу до ${pauseDuration/1000} секунд`);
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

                const agentResult = await this.runSingleAgent(agentName, compressedData, null, results, { provider, analysisId });
                
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
                    let secondaryPause = 60000; // Увеличена базовая пауза до 60 секунд
                    
                    // Если есть ошибка 529, ЗНАЧИТЕЛЬНО увеличиваем паузу
                    if (agentResult.error && agentResult.error.status === 529) {
                        secondaryPause = 300000; // 5 минут после 529 ошибки для зависимых агентов
                        console.log(`[MultiAgent] 🚨 КРИТИЧЕСКАЯ ошибка 529 в зависимом агенте ${agentName}! Увеличиваем паузу до ${secondaryPause/1000} секунд`);
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
     * @param {object} options - Дополнительные параметры (включая provider)
     * @returns {object} Результат агента
     */
    async runSingleAgent(agentName, mcpData, customPrompt = null, previousResults = {}, options = {}) {
        const { provider = 'claude', analysisId = null } = options;
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
            const agentOptions = { analysisId };
            if (agentName === 'StaffingAgent' || agentName === 'NarrativeAgent') {
                agentOptions.maxRetries = 7; // Больше попыток для проблемных агентов
                agentOptions.retryDelay = 10000; // Увеличенная базовая задержка (10 секунд)
                console.log(`[MultiAgent] 🛠️  Применяем специальные настройки для ${agentName}: ${agentOptions.maxRetries} попыток, задержка ${agentOptions.retryDelay/1000}с`);
            }

            // Выбираем движок в зависимости от провайдера
            let result;
            if (provider === 'claude') {
                // Используем существующую логику Claude с множественными ключами (обратная совместимость)
                const apiClient = this.apiClients[agentName] || this.apiClients.default;
                console.log(`[MultiAgent] 🔑 Claude: Используем ${this.apiClients[agentName] ? 'специальный' : 'основной'} API ключ для ${agentName}`);
                result = await apiClient.analyzeWithAgent(agentName, processedPrompt, agentData, agentOptions);
            } else {
                // Используем новые движки для других провайдеров
                console.log(`[MultiAgent] 🚀 Используем ${provider} движок для агента ${agentName}`);
                const engine = this.engineDispatcher.getEngine(provider);
                result = await engine.analyzeWithAgent(agentName, processedPrompt, agentData, agentOptions);
            }

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
                // Исправление: правильно извлекаем данные из MCP структуры
                // Проверяем, есть ли вложенное поле .data
                if (typeof mcpData[field] === 'object' && mcpData[field].data !== undefined) {
                    agentData[field] = mcpData[field].data;
                } else {
                    // Если нет поля .data, используем значение напрямую
                    agentData[field] = mcpData[field];
                }
            } else {
                // НЕ устанавливаем null для отсутствующих полей - это может вызвать проблемы
                console.warn(`[MultiAgent] Поле ${field} отсутствует в MCP данных для агента ${agent.name}`);
            }
        }

        console.log(`[MultiAgent] Подготовленные данные для агента ${agent.name}:`, 
            Object.keys(agentData).map(key => `${key}: ${Array.isArray(agentData[key]) ? `массив(${agentData[key].length})` : typeof agentData[key]}`).join(', ')
        );

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
        const replacements = [];

        // Замена плейсхолдеров {field_name} на JSON данные
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{${key}}`;
            if (processedPrompt.includes(placeholder)) {
                const jsonValue = JSON.stringify(value, null, 2);
                processedPrompt = processedPrompt.replace(placeholder, jsonValue);
                replacements.push({
                    placeholder,
                    dataType: Array.isArray(value) ? `array[${value.length}]` : typeof value,
                    size: JSON.stringify(value).length
                });
            }
        }

        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Замена оставшихся плейсхолдеров на сообщение об отсутствии данных
        const remainingPlaceholders = processedPrompt.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
        if (remainingPlaceholders && remainingPlaceholders.length > 0) {
            console.warn(`[MultiAgent] ⚠️ Найдены незамененные плейсхолдеры: ${remainingPlaceholders.join(', ')}`);
            
            // Заменяем каждый незамененный плейсхолдер на сообщение об отсутствии данных
            for (const placeholder of remainingPlaceholders) {
                const fieldName = placeholder.slice(1, -1); // Убираем фигурные скобки
                const noDataMessage = `[Данные "${fieldName}" отсутствуют в MCP API]`;
                processedPrompt = processedPrompt.replace(placeholder, noDataMessage);
                console.log(`[MultiAgent] 🔄 Замена отсутствующих данных: ${placeholder} → ${noDataMessage}`);
            }
        }

        // Логирование для отладки
        if (replacements.length > 0) {
            console.log(`[MultiAgent] 🔄 Заменено ${replacements.length} плейсхолдеров:`, 
                replacements.map(r => `${r.placeholder} → ${r.dataType} (${r.size} символов)`).join(', ')
            );
        }

        // Финальная проверка на оставшиеся плейсхолдеры
        const finalCheck = processedPrompt.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
        if (finalCheck && finalCheck.length > 0) {
            console.error(`[MultiAgent] ❌ КРИТИЧЕСКАЯ ОШИБКА: Остались незамененные плейсхолдеры:`, finalCheck);
        } else {
            console.log(`[MultiAgent] ✅ Все плейсхолдеры успешно обработаны`);
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
        let basePause = 20000; // Уменьшена базовая пауза до 20 секунд (благодаря множественным ключам)
        
        // Оптимизированные паузы с учетом изолированных API ключей
        const agentPauses = {
            'SalesAnalysisAgent': 30000,     // 30 секунд (основной ключ)
            'PayrollAnalysisAgent': 40000,   // 40 секунд (отдельный ключ PAYROLL)
            'StaffingAgent': 40000,          // 40 секунд (отдельный ключ STAFFING)
            'ReputationAgent': 30000         // 30 секунд (основной ключ)
        };
        
        basePause = agentPauses[agentName] || basePause;
        
        // Увеличиваем паузу, если в предыдущих агентах были ошибки 529
        const errorCount = Object.values(results).filter(result => 
            result.error && result.error.status === 529
        ).length;
        
        if (errorCount > 0) {
            // ЭКСПОНЕНЦИАЛЬНОЕ увеличение: 1 ошибка = +120с, 2 = +240с, 3+ = +480с
            const multiplier = Math.min(errorCount, 3);
            const additionalPause = [120000, 240000, 480000][multiplier - 1] || 480000;
            basePause += additionalPause;
            console.log(`[MultiAgent] 🚨 КРИТИЧЕСКОЕ накопление ${errorCount} ошибок 529! Экстремальное увеличение паузы на ${additionalPause/1000}с`);
        }
        
        return basePause;
    }

    /**
     * Вычисляет паузу перед запуском вторичных агентов
     * @param {object} results - Результаты первичных агентов
     * @returns {number} Пауза в миллисекундах
     */
    calculatePreSecondaryPause(results) {
        let basePause = 60000; // Оптимизирована базовая пауза до 1 минуты (благодаря множественным ключам)
        
        // Подсчет ошибок 529 в первичных агентах
        const error529Count = Object.values(results).filter(result => 
            result.error && result.error.status === 529
        ).length;
        
        // Подсчет общего количества ошибок
        const totalErrorCount = Object.values(results).filter(result => result.error).length;
        
        // КРИТИЧЕСКОЕ увеличение паузы при ошибках 529
        if (error529Count > 0) {
            // Экспоненциальное увеличение: 1 = +300с, 2 = +600с, 3+ = +900с (15 минут!)
            const multiplier = Math.min(error529Count, 3);
            const additionalPause = [300000, 600000, 900000][multiplier - 1] || 900000;
            basePause += additionalPause;
            console.log(`[MultiAgent] 🚨 КРИТИЧЕСКИХ ${error529Count} ошибок 529! Экстремальная пауза +${additionalPause/60000} минут перед зависимыми агентами`);
        }
        
        if (totalErrorCount > 2) {
            basePause += 120000; // +2 минуты при многих ошибках
            console.log(`[MultiAgent] ⚠️ Критическое количество ошибок (${totalErrorCount}), дополнительная пауза +2 минуты`);
        }
        
        return Math.min(basePause, 1200000); // Максимум 20 минут для критических случаев
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

    /**
     * Быстрый режим анализа (только 2 агента для тестирования лимитов)
     */
    async runFastAnalysis(mcpData) {
        console.log('[MultiAgent] 🚀 БЫСТРЫЙ РЕЖИМ: только 2 агента');
        
        const compressedData = this.compressDataForTokens(mcpData);
        const results = {};
        
        // Только самые важные агенты
        const fastAgents = ['SalesAnalysisAgent', 'ReputationAgent'];
        
        for (const agentName of fastAgents) {
            console.log(`[MultiAgent] ⚡ Быстрый агент: ${agentName}`);
            
            const agentResult = await this.runSingleAgent(agentName, compressedData, null, results);
            
            if (agentResult.success) {
                results[agentName] = agentResult.result;
                console.log(`[MultiAgent] ✅ ${agentName} завершен`);
            } else {
                console.error(`[MultiAgent] ❌ ${agentName} ошибка:`, agentResult.error);
                results[agentName] = {
                    error: true,
                    message: agentResult.error.message
                };
            }
            
            // Пауза 60 секунд между агентами
            if (agentName !== fastAgents[fastAgents.length - 1]) {
                console.log('[MultiAgent] ⏳ Быстрая пауза 60 секунд...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }
        
        return {
            success: true,
            results: results,
            metadata: {
                mode: 'fast',
                total_agents: 2,
                successful_agents: Object.keys(results).filter(key => !results[key].error).length,
                failed_agents: Object.keys(results).filter(key => results[key].error).length
            }
        };
    }

}

module.exports = MultiAgentSystem;