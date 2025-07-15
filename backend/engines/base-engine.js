/**
 * Базовый класс для AI-движков
 * Определяет единый интерфейс для всех провайдеров AI
 */
class BaseEngine {
    constructor(apiKey, options = {}) {
        if (!apiKey) {
            throw new Error(`API ключ обязателен для ${this.constructor.name}`);
        }
        
        this.apiKey = apiKey;
        this.options = {
            maxTokens: 4000,
            temperature: 0.7,
            maxRetries: 7, // Увеличиваем количество попыток для стабильности
            retryDelay: 8000, // Увеличиваем задержку между попытками
            ...options
        };
        
        // Логирование инициализации
        const keyPreview = apiKey.substring(0, 20) + '...';
        console.log(`[${this.getProviderName()}] Инициализирован с ключом: ${keyPreview}`);
    }

    /**
     * Основной метод выполнения AI анализа
     * @param {string} prompt - Промпт для анализа
     * @param {object} context - Контекстные данные
     * @param {object} options - Дополнительные параметры
     * @returns {Promise<object>} Результат анализа
     */
    async run(prompt, context = {}, options = {}) {
        throw new Error(`Метод run() должен быть реализован в ${this.constructor.name}`);
    }

    /**
     * Анализ данных с помощью специфического агента
     * @param {string} agentName - Название агента
     * @param {string} prompt - Промпт агента
     * @param {object} data - Данные для анализа
     * @param {object} options - Дополнительные параметры
     * @returns {Promise<object>} Результат анализа
     */
    async analyzeWithAgent(agentName, prompt, data, options = {}) {
        try {
            console.log(`[${this.getProviderName()}] Запуск агента "${agentName}"`);

            // Формирование полного промпта с данными
            const dataString = JSON.stringify(data, null, 2);
            const fullPrompt = `${prompt}\n\nДанные для анализа:\n${dataString}`;

            // Системный промпт для контекста
            const systemPrompt = `Ты - AI-аналитик ресторанного бизнеса. Твоя роль: ${agentName}. 
Анализируй предоставленные данные профессионально и дай конкретные рекомендации.
Отвечай на русском языке, структурированно и по делу.`;

            const result = await this.run(fullPrompt, { 
                systemPrompt, 
                agentName, 
                analysisId: options.analysisId 
            }, options);

            if (result.success) {
                console.log(`[${this.getProviderName()}] ✅ Агент "${agentName}" завершил анализ`);
                return {
                    success: true,
                    agent_name: agentName,
                    result: result.content || result.data,
                    metadata: {
                        ...result.metadata,
                        provider: this.getProviderName(),
                        agent_name: agentName,
                        data_size: dataString.length,
                        prompt_size: prompt.length
                    }
                };
            } else {
                console.error(`[${this.getProviderName()}] ❌ Ошибка агента "${agentName}":`, result.error);
                return {
                    success: false,
                    agent_name: agentName,
                    error: result.error
                };
            }

        } catch (error) {
            console.error(`[${this.getProviderName()}] Критическая ошибка агента "${agentName}":`, error);
            return {
                success: false,
                agent_name: agentName,
                error: {
                    type: 'critical_error',
                    message: error.message,
                    provider: this.getProviderName()
                }
            };
        }
    }

    /**
     * Проверка подключения к API
     * @returns {Promise<object>} Результат теста
     */
    async validateConnection() {
        try {
            console.log(`[${this.getProviderName()}] Тестирование соединения...`);

            const testPrompt = 'Привет! Ответь кратко: ты работаешь?';
            const result = await this.run(testPrompt, {}, { maxTokens: 100 });

            if (result.success) {
                console.log(`[${this.getProviderName()}] ✅ Соединение успешно`);
                return {
                    success: true,
                    provider: this.getProviderName(),
                    message: 'Соединение успешно',
                    test_response: result.content || result.data
                };
            } else {
                console.log(`[${this.getProviderName()}] ❌ Ошибка соединения`);
                return {
                    success: false,
                    provider: this.getProviderName(),
                    message: 'Ошибка соединения',
                    error: result.error
                };
            }

        } catch (error) {
            console.error(`[${this.getProviderName()}] Критическая ошибка тестирования:`, error);
            return {
                success: false,
                provider: this.getProviderName(),
                message: 'Критическая ошибка тестирования',
                error: error.message
            };
        }
    }

    /**
     * Получение имени провайдера
     * @returns {string} Название провайдера
     */
    getProviderName() {
        throw new Error(`Метод getProviderName() должен быть реализован в ${this.constructor.name}`);
    }

    /**
     * Получение поддерживаемых моделей
     * @returns {array} Список моделей
     */
    getSupportedModels() {
        throw new Error(`Метод getSupportedModels() должен быть реализован в ${this.constructor.name}`);
    }

    /**
     * Проверка, стоит ли повторить запрос при ошибке
     * @param {Error} error - Объект ошибки
     * @param {number} attempt - Номер текущей попытки
     * @param {number} maxRetries - Максимальное количество попыток
     * @returns {boolean} Стоит ли повторить
     */
    shouldRetryError(error, attempt, maxRetries) {
        // Не повторяем, если достигли максимума попыток
        if (attempt >= maxRetries) {
            return false;
        }

        // Повторяем для ошибок перегрузки (529)
        if (error.status === 529) {
            console.log(`[${this.getProviderName()}] 🔄 Ошибка 529 (Overloaded) - повторяем запрос`);
            return true;
        }

        // Повторяем для ошибок сервера (5xx)
        if (error.status >= 500 && error.status < 600) {
            console.log(`[${this.getProviderName()}] 🔄 Ошибка сервера ${error.status} - повторяем запрос`);
            return true;
        }

        // Повторяем для timeout ошибок
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            console.log(`[${this.getProviderName()}] 🔄 Ошибка timeout - повторяем запрос`);
            return true;
        }

        // Повторяем для сетевых ошибок
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
            console.log(`[${this.getProviderName()}] 🔄 Сетевая ошибка ${error.code} - повторяем запрос`);
            return true;
        }

        // Не повторяем для клиентских ошибок (4xx)
        if (error.status >= 400 && error.status < 500) {
            console.log(`[${this.getProviderName()}] ❌ Клиентская ошибка ${error.status} - не повторяем`);
            return false;
        }

        // По умолчанию не повторяем
        return false;
    }

    /**
     * Вычисляет задержку для повтора с экспоненциальным backoff
     * @param {number} attempt - Номер попытки
     * @param {number} baseDelay - Базовая задержка в мс
     * @param {number} errorStatus - Статус ошибки
     * @returns {number} Задержка в миллисекундах
     */
    calculateRetryDelay(attempt, baseDelay, errorStatus) {
        // Для ошибки 529 (Overloaded) используем агрессивные задержки
        if (errorStatus === 529) {
            const delays = [30000, 90000, 180000, 360000, 600000]; // 30s, 90s, 3m, 6m, 10m
            const delay = delays[attempt - 1] || 600000;
            
            // Добавляем jitter для лучшего распределения нагрузки
            const jitter = Math.random() * 15000; // До 15 секунд случайности
            return delay + jitter;
        }

        // Экспоненциальный backoff для остальных ошибок
        const delay = baseDelay * Math.pow(2, attempt - 1);
        
        // Добавляем случайный jitter для избежания thundering herd
        const jitter = Math.random() * 1000;
        
        return Math.min(delay + jitter, 30000); // Максимум 30 секунд
    }

    /**
     * Получение статистики использования
     * @returns {object} Статистика
     */
    getUsageStats() {
        return {
            provider: this.getProviderName(),
            api_key_status: this.apiKey ? 'configured' : 'missing',
            supported_models: this.getSupportedModels(),
            options: this.options
        };
    }
}

module.exports = BaseEngine;