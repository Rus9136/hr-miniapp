const ClaudeEngine = require('./claude-engine');

/**
 * Диспетчер AI-движков
 * Управляет выбором и созданием экземпляров AI провайдеров
 */
class EngineDispatcher {
    constructor() {
        this.supportedProviders = ['claude', 'openai', 'gemini'];
        this.defaultProvider = process.env.AI_DEFAULT_PROVIDER || 'claude';
        
        // Кэш инициализированных движков
        this.engineCache = new Map();
        
        console.log(`[EngineDispatcher] Инициализирован с провайдером по умолчанию: ${this.defaultProvider}`);
        console.log(`[EngineDispatcher] Поддерживаемые провайдеры: ${this.supportedProviders.join(', ')}`);
    }

    /**
     * Получение экземпляра движка по провайдеру
     * @param {string} provider - Название провайдера (claude, openai, gemini)
     * @param {object} options - Дополнительные параметры
     * @returns {BaseEngine} Экземпляр движка
     */
    getEngine(provider = null, options = {}) {
        const selectedProvider = provider || this.defaultProvider;
        
        if (!this.supportedProviders.includes(selectedProvider)) {
            throw new Error(`Провайдер "${selectedProvider}" не поддерживается. Доступные: ${this.supportedProviders.join(', ')}`);
        }

        // Проверяем кэш
        const cacheKey = `${selectedProvider}_${JSON.stringify(options)}`;
        if (this.engineCache.has(cacheKey)) {
            console.log(`[EngineDispatcher] Использование кэшированного движка: ${selectedProvider}`);
            return this.engineCache.get(cacheKey);
        }

        console.log(`[EngineDispatcher] Создание нового экземпляра движка: ${selectedProvider}`);
        
        let engine;
        
        try {
            switch (selectedProvider) {
                case 'claude':
                    engine = this.createClaudeEngine(options);
                    break;
                    
                case 'openai':
                    engine = this.createOpenAIEngine(options);
                    break;
                    
                case 'gemini':
                    engine = this.createGeminiEngine(options);
                    break;
                    
                default:
                    throw new Error(`Реализация для провайдера "${selectedProvider}" не найдена`);
            }
            
            // Сохраняем в кэш
            this.engineCache.set(cacheKey, engine);
            
            return engine;
            
        } catch (error) {
            console.error(`[EngineDispatcher] Ошибка создания движка ${selectedProvider}:`, error);
            throw error;
        }
    }

    /**
     * Создание экземпляра Claude движка
     * @param {object} options - Параметры
     * @returns {ClaudeEngine} Экземпляр Claude движка
     */
    createClaudeEngine(options = {}) {
        const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY не найден в переменных окружения');
        }
        
        return new ClaudeEngine(apiKey, options);
    }

    /**
     * Создание экземпляра OpenAI движка
     * @param {object} options - Параметры
     * @returns {OpenAIEngine} Экземпляр OpenAI движка
     */
    createOpenAIEngine(options = {}) {
        const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY не найден в переменных окружения');
        }
        
        // Динамическая загрузка OpenAI движка
        try {
            const OpenAIEngine = require('./openai-engine');
            return new OpenAIEngine(apiKey, options);
        } catch (error) {
            throw new Error(`OpenAI движок не доступен: ${error.message}`);
        }
    }

    /**
     * Создание экземпляра Gemini движка (заглушка)
     * @param {object} options - Параметры
     * @returns {GeminiEngine} Экземпляр Gemini движка
     */
    createGeminiEngine(options = {}) {
        const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY не найден в переменных окружения');
        }
        
        // Заглушка для будущей реализации
        throw new Error('Gemini движок пока не реализован. Будет добавлен в будущих версиях.');
    }

    /**
     * Создание движка для конкретного агента (с поддержкой множественных ключей Claude)
     * @param {string} agentName - Название агента
     * @param {string} provider - Провайдер AI
     * @param {object} options - Дополнительные параметры
     * @returns {BaseEngine} Экземпляр движка
     */
    getEngineForAgent(agentName, provider = null, options = {}) {
        const selectedProvider = provider || this.defaultProvider;
        
        // Специальная логика для Claude агентов с множественными ключами
        if (selectedProvider === 'claude') {
            return this.getClaudeEngineForAgent(agentName, options);
        }
        
        // Для остальных провайдеров используем обычную логику
        return this.getEngine(selectedProvider, options);
    }

    /**
     * Получение Claude движка для конкретного агента (совместимость с существующим кодом)
     * @param {string} agentName - Название агента
     * @param {object} options - Дополнительные параметры
     * @returns {ClaudeEngine} Экземпляр Claude движка с правильным ключом
     */
    getClaudeEngineForAgent(agentName, options = {}) {
        // Mapping агентов на специальные API ключи (из существующего кода)
        const agentKeyMapping = {
            'PayrollAnalysisAgent': process.env.ANTHROPIC_API_KEY_PAYROLL,
            'StaffingAgent': process.env.ANTHROPIC_API_KEY_STAFFING,
            'NarrativeAgent': process.env.ANTHROPIC_API_KEY_NARRATIVE,
            'ReputationAgent': process.env.ANTHROPIC_API_KEY_REPUTATION
        };
        
        // Выбираем API ключ для агента
        const agentApiKey = agentKeyMapping[agentName] || process.env.ANTHROPIC_API_KEY;
        
        if (!agentApiKey) {
            console.warn(`[EngineDispatcher] ⚠️ Специальный ключ для ${agentName} не найден, используем основной`);
        }
        
        const engineOptions = {
            ...options,
            apiKey: agentApiKey
        };
        
        console.log(`[EngineDispatcher] 🔑 Создание Claude движка для агента ${agentName} с ${agentApiKey ? 'специальным' : 'основным'} ключом`);
        
        return this.createClaudeEngine(engineOptions);
    }

    /**
     * Проверка доступности провайдера
     * @param {string} provider - Название провайдера
     * @returns {Promise<object>} Результат проверки
     */
    async validateProvider(provider) {
        try {
            const engine = this.getEngine(provider);
            const result = await engine.validateConnection();
            
            return {
                success: true,
                provider,
                available: result.success,
                details: result
            };
            
        } catch (error) {
            return {
                success: false,
                provider,
                available: false,
                error: error.message
            };
        }
    }

    /**
     * Проверка всех доступных провайдеров
     * @returns {Promise<object>} Статус всех провайдеров
     */
    async validateAllProviders() {
        console.log('[EngineDispatcher] Проверка всех провайдеров...');
        
        const results = {};
        
        for (const provider of this.supportedProviders) {
            try {
                results[provider] = await this.validateProvider(provider);
            } catch (error) {
                results[provider] = {
                    success: false,
                    provider,
                    available: false,
                    error: error.message
                };
            }
        }
        
        const availableProviders = Object.values(results).filter(r => r.available).length;
        
        return {
            total_providers: this.supportedProviders.length,
            available_providers: availableProviders,
            default_provider: this.defaultProvider,
            results
        };
    }

    /**
     * Получение информации о поддерживаемых провайдерах
     * @returns {object} Информация о провайдерах
     */
    getProvidersInfo() {
        return {
            supported_providers: this.supportedProviders,
            default_provider: this.defaultProvider,
            cache_size: this.engineCache.size,
            providers_config: {
                claude: {
                    env_key: 'ANTHROPIC_API_KEY',
                    multiple_keys: true,
                    special_keys: ['ANTHROPIC_API_KEY_PAYROLL', 'ANTHROPIC_API_KEY_STAFFING', 'ANTHROPIC_API_KEY_NARRATIVE', 'ANTHROPIC_API_KEY_REPUTATION']
                },
                openai: {
                    env_key: 'OPENAI_API_KEY',
                    multiple_keys: false
                },
                gemini: {
                    env_key: 'GEMINI_API_KEY',
                    multiple_keys: false,
                    status: 'not_implemented'
                }
            }
        };
    }

    /**
     * Очистка кэша движков
     */
    clearCache() {
        const cacheSize = this.engineCache.size;
        this.engineCache.clear();
        console.log(`[EngineDispatcher] Кэш очищен. Удалено ${cacheSize} экземпляров движков`);
    }
}

module.exports = EngineDispatcher;