const BaseEngine = require('./base-engine');
const OpenAI = require('openai');
const { Pool } = require('pg');

// PostgreSQL connection для логирования
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

/**
 * OpenAI GPT AI Engine
 * Реализация для интеграции с OpenAI API (GPT-4, GPT-3.5)
 */
class OpenAIEngine extends BaseEngine {
    constructor(apiKey, options = {}) {
        super(apiKey, options);
        
        // Инициализация OpenAI клиента
        this.openaiClient = new OpenAI({
            apiKey: apiKey
        });
        
        // Конфигурация моделей
        this.defaultModel = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
        this.supportedModels = [
            'gpt-4o-mini',
            'gpt-4o',
            'gpt-3.5-turbo',
            'gpt-4-turbo',
            'gpt-4'
        ];
        
        // Переопределяем максимальные токены для OpenAI
        this.options.maxTokens = options.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 4000;
        
        console.log(`[OpenAI-Engine] Инициализирован с моделью: ${this.defaultModel}`);
    }

    /**
     * Логирование промпта в базу данных
     * @param {string} agentName - Название агента
     * @param {string} fullPrompt - Полный промпт
     * @param {string} systemPrompt - Системный промпт
     * @param {string} response - Ответ от OpenAI
     * @param {object} metadata - Метаданные ответа
     * @param {number} analysisId - ID анализа
     */
    async logPrompt(agentName, fullPrompt, systemPrompt = '', response = '', metadata = {}, analysisId = null) {
        try {
            const query = `
                INSERT INTO ai_prompt_logs (
                    analysis_id, agent_name, provider, full_prompt, prompt_length,
                    system_prompt, response_text, response_length, success, tokens_used,
                    request_timestamp, response_timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `;
            
            const values = [
                analysisId,
                agentName,
                'openai',
                fullPrompt,
                fullPrompt.length,
                systemPrompt,
                response,
                response.length,
                !!response,
                metadata.usage?.total_tokens || 0,
                new Date(),
                response ? new Date() : null
            ];
            
            const result = await pool.query(query, values);
            console.log(`[OpenAI-Engine] 📝 Промпт залогирован в БД с ID: ${result.rows[0].id}`);
            return result.rows[0].id;
        } catch (error) {
            console.error(`[OpenAI-Engine] ❌ Ошибка логирования промпта:`, error.message);
        }
    }

    /**
     * Основной метод выполнения AI анализа через OpenAI
     * @param {string} prompt - Промпт для анализа
     * @param {object} context - Контекстные данные
     * @param {object} options - Дополнительные параметры
     * @returns {Promise<object>} Результат анализа
     */
    async run(prompt, context = {}, options = {}) {
        const {
            model = this.defaultModel,
            max_tokens = this.options.maxTokens,
            temperature = this.options.temperature,
            maxRetries = this.options.maxRetries,
            retryDelay = this.options.retryDelay
        } = { ...this.options, ...options };

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[OpenAI-Engine] Отправка запроса к OpenAI (${model}), попытка ${attempt}/${maxRetries}, длина промпта: ${prompt.length} символов`);

                // Подготовка сообщений для OpenAI API
                const messages = [];
                
                // Добавляем системный промпт если есть
                if (context.systemPrompt) {
                    messages.push({
                        role: 'system',
                        content: context.systemPrompt
                    });
                }
                
                // Добавляем основной промпт
                messages.push({
                    role: 'user',
                    content: prompt
                });

                const requestParams = {
                    model,
                    messages,
                    max_tokens,
                    temperature
                };

                console.log(`[OpenAI-Engine] Параметры запроса: модель=${model}, max_tokens=${max_tokens}, temperature=${temperature}`);

                const response = await this.openaiClient.chat.completions.create(requestParams);

                if (!response.choices || response.choices.length === 0) {
                    throw new Error('Пустой ответ от OpenAI API');
                }

                const content = response.choices[0].message.content;

                console.log(`[OpenAI-Engine] ✅ Получен ответ от OpenAI, попытка ${attempt}, длина: ${content.length} символов`);

                // Логируем промпт и ответ в базу данных
                const analysisId = context.analysisId || null;
                const agentName = context.agentName || 'unknown';
                const systemPrompt = context.systemPrompt || '';
                await this.logPrompt(agentName, prompt, systemPrompt, content, response, analysisId);

                return {
                    success: true,
                    content: content,
                    metadata: {
                        model: response.model,
                        usage: response.usage,
                        finish_reason: response.choices[0].finish_reason,
                        response_id: response.id,
                        attempts: attempt,
                        provider: 'openai',
                        engine: 'openai-engine'
                    }
                };

            } catch (error) {
                console.error(`[OpenAI-Engine] Ошибка запроса к OpenAI API, попытка ${attempt}/${maxRetries}:`, error.message);

                // Детальная обработка ошибок OpenAI
                let errorDetails = {
                    type: 'unknown_error',
                    message: error.message,
                    attempt: attempt,
                    provider: 'openai',
                    engine: 'openai-engine'
                };

                if (error.status) {
                    // API ошибки OpenAI
                    errorDetails = {
                        type: 'api_error',
                        status: error.status,
                        message: error.message,
                        error_type: error.type,
                        error_code: error.code,
                        attempt: attempt,
                        provider: 'openai',
                        engine: 'openai-engine'
                    };
                } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                    // Ошибки сети
                    errorDetails = {
                        type: 'network_error',
                        message: 'Нет соединения с OpenAI API',
                        code: error.code,
                        attempt: attempt,
                        provider: 'openai',
                        engine: 'openai-engine'
                    };
                }

                // Проверяем, стоит ли повторить запрос
                const shouldRetry = this.shouldRetryOpenAIError(error, attempt, maxRetries);
                
                if (shouldRetry) {
                    const delay = this.calculateRetryDelay(attempt, retryDelay, error.status);
                    console.log(`[OpenAI-Engine] ⏳ Повтор через ${delay/1000} секунд... (попытка ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue; // Повторяем цикл
                } else {
                    // Окончательная ошибка
                    return {
                        success: false,
                        error: errorDetails
                    };
                }
            }
        }

        // Если дошли до сюда, значит все попытки исчерпаны
        return {
            success: false,
            error: {
                type: 'max_retries_exceeded',
                message: `Все ${maxRetries} попыток исчерпаны`,
                attempts: maxRetries,
                provider: 'openai',
                engine: 'openai-engine'
            }
        };
    }

    /**
     * Проверка подключения к OpenAI API
     * @returns {Promise<object>} Результат теста
     */
    async validateConnection() {
        try {
            console.log('[OpenAI-Engine] Тестирование соединения с OpenAI API...');

            const testPrompt = 'Привет! Ответь кратко: ты работаешь?';
            const result = await this.run(testPrompt, {}, { 
                max_tokens: 100,
                maxRetries: 2 // Быстрый тест
            });

            if (result.success) {
                console.log('[OpenAI-Engine] ✅ Соединение с OpenAI API успешно');
                return {
                    success: true,
                    available: true,
                    provider: 'openai',
                    engine: 'openai-engine',
                    message: 'Соединение с OpenAI API успешно',
                    test_response: result.content,
                    model: result.metadata.model
                };
            } else {
                console.log('[OpenAI-Engine] ❌ Ошибка соединения с OpenAI API');
                return {
                    success: false,
                    available: false,
                    provider: 'openai',
                    engine: 'openai-engine',
                    message: 'Ошибка соединения с OpenAI API',
                    error: result.error
                };
            }

        } catch (error) {
            console.error('[OpenAI-Engine] Критическая ошибка тестирования:', error);
            return {
                success: false,
                available: false,
                provider: 'openai',
                engine: 'openai-engine',
                message: 'Критическая ошибка тестирования OpenAI API',
                error: error.message
            };
        }
    }

    /**
     * Получение имени провайдера
     * @returns {string} Название провайдера
     */
    getProviderName() {
        return 'openai';
    }

    /**
     * Получение поддерживаемых моделей
     * @returns {array} Список моделей
     */
    getSupportedModels() {
        return this.supportedModels;
    }

    /**
     * Проверка, стоит ли повторить запрос при ошибке OpenAI
     * @param {Error} error - Объект ошибки
     * @param {number} attempt - Номер текущей попытки
     * @param {number} maxRetries - Максимальное количество попыток
     * @returns {boolean} Стоит ли повторить
     */
    shouldRetryOpenAIError(error, attempt, maxRetries) {
        // Не повторяем, если достигли максимума попыток
        if (attempt >= maxRetries) {
            return false;
        }

        // Повторяем для ошибок rate limit (429)
        if (error.status === 429) {
            console.log(`[OpenAI-Engine] 🔄 Ошибка 429 (Rate Limited) - повторяем запрос`);
            return true;
        }

        // Повторяем для ошибок перегрузки (502, 503, 529)
        if ([502, 503, 529].includes(error.status)) {
            console.log(`[OpenAI-Engine] 🔄 Ошибка ${error.status} (Server Overloaded) - повторяем запрос`);
            return true;
        }

        // Повторяем для ошибок сервера (5xx)
        if (error.status >= 500 && error.status < 600) {
            console.log(`[OpenAI-Engine] 🔄 Ошибка сервера ${error.status} - повторяем запрос`);
            return true;
        }

        // Повторяем для timeout ошибок
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            console.log(`[OpenAI-Engine] 🔄 Ошибка timeout - повторяем запрос`);
            return true;
        }

        // Повторяем для сетевых ошибок
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
            console.log(`[OpenAI-Engine] 🔄 Сетевая ошибка ${error.code} - повторяем запрос`);
            return true;
        }

        // Не повторяем для ошибок авторизации и неправильных запросов
        if ([400, 401, 403, 404].includes(error.status)) {
            console.log(`[OpenAI-Engine] ❌ Клиентская ошибка ${error.status} - не повторяем`);
            return false;
        }

        // По умолчанию не повторяем
        return false;
    }

    /**
     * Вычисляет задержку для повтора с учетом особенностей OpenAI
     * @param {number} attempt - Номер попытки
     * @param {number} baseDelay - Базовая задержка в мс
     * @param {number} errorStatus - Статус ошибки
     * @returns {number} Задержка в миллисекундах
     */
    calculateRetryDelay(attempt, baseDelay, errorStatus) {
        // Для ошибки 429 (Rate Limited) используем более агрессивные задержки
        if (errorStatus === 429) {
            // Экспоненциальные задержки: 60s, 120s, 240s, 480s, 600s
            const delays = [60000, 120000, 240000, 480000, 600000];
            const delay = delays[attempt - 1] || 600000;
            
            // Добавляем jitter для лучшего распределения нагрузки
            const jitter = Math.random() * 10000; // До 10 секунд случайности
            return delay + jitter;
        }

        // Для ошибок перегрузки (502, 503, 529) используем средние задержки
        if ([502, 503, 529].includes(errorStatus)) {
            const delays = [30000, 60000, 120000, 240000, 360000]; // 30s, 1m, 2m, 4m, 6m
            const delay = delays[attempt - 1] || 360000;
            
            const jitter = Math.random() * 5000; // До 5 секунд случайности
            return delay + jitter;
        }

        // Экспоненциальный backoff для остальных ошибок
        const delay = baseDelay * Math.pow(2, attempt - 1);
        
        // Добавляем случайный jitter для избежания thundering herd
        const jitter = Math.random() * 1000;
        
        return Math.min(delay + jitter, 60000); // Максимум 60 секунд для OpenAI
    }

    /**
     * Получение статистики использования
     * @returns {object} Статистика
     */
    getUsageStats() {
        const baseStats = super.getUsageStats();
        
        return {
            ...baseStats,
            default_model: this.defaultModel,
            openai_specific: {
                supported_models: this.supportedModels,
                api_version: 'v1',
                max_tokens_default: this.options.maxTokens,
                pricing_model: 'per_token'
            }
        };
    }

    /**
     * Установка кастомной модели
     * @param {string} model - Название модели
     */
    setModel(model) {
        if (this.supportedModels.includes(model)) {
            this.defaultModel = model;
            console.log(`[OpenAI-Engine] Модель изменена на: ${model}`);
        } else {
            throw new Error(`Модель ${model} не поддерживается. Доступные: ${this.supportedModels.join(', ')}`);
        }
    }

    /**
     * Получение текущей модели
     * @returns {string} Название модели
     */
    getCurrentModel() {
        return this.defaultModel;
    }

    /**
     * Получение информации о лимитах OpenAI
     * @returns {object} Информация о лимитах
     */
    getRateLimitInfo() {
        return {
            provider: 'openai',
            typical_limits: {
                'gpt-4': {
                    requests_per_minute: 10000,
                    tokens_per_minute: 30000,
                    batch_queue_limit: 90000
                },
                'gpt-4-turbo': {
                    requests_per_minute: 10000,
                    tokens_per_minute: 30000,
                    batch_queue_limit: 90000
                },
                'gpt-3.5-turbo': {
                    requests_per_minute: 10000,
                    tokens_per_minute: 50000,
                    batch_queue_limit: 200000
                }
            },
            retry_strategy: 'exponential_backoff_with_jitter',
            max_retry_delay: '10_minutes'
        };
    }
}

module.exports = OpenAIEngine;