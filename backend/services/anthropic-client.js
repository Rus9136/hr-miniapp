const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

class AnthropicClient {
    constructor() {
        this.apiKey = process.env.ANTHROPIC_API_KEY;
        
        if (!this.apiKey) {
            throw new Error('ANTHROPIC_API_KEY не найден в переменных окружения');
        }

        this.client = new Anthropic({
            apiKey: this.apiKey,
        });

        this.defaultModel = 'claude-3-5-sonnet-20241022';
        this.maxTokens = 4000;
        this.temperature = 0.7;
    }

    /**
     * Отправка запроса к Claude API с retry логикой
     * @param {string} prompt - Промпт для анализа
     * @param {object} options - Дополнительные параметры
     * @returns {object} Результат анализа или ошибка
     */
    async sendMessage(prompt, options = {}) {
        const {
            model = this.defaultModel,
            max_tokens = this.maxTokens,
            temperature = this.temperature,
            system = null,
            maxRetries = 5, // Увеличиваем количество попыток для 529 ошибок
            retryDelay = 5000 // 5 секунд базовая задержка
        } = options;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Anthropic-Client] Отправка запроса к Claude (${model}), попытка ${attempt}/${maxRetries}, длина промпта: ${prompt.length} символов`);

                const messages = [
                    {
                        role: 'user',
                        content: prompt
                    }
                ];

                const requestParams = {
                    model,
                    max_tokens,
                    temperature,
                    messages
                };

                // Добавляем system prompt если указан
                if (system) {
                    requestParams.system = system;
                }

                const response = await this.client.messages.create(requestParams);

                if (!response.content || response.content.length === 0) {
                    throw new Error('Пустой ответ от Claude API');
                }

                const content = response.content[0].text;

                console.log(`[Anthropic-Client] ✅ Получен ответ от Claude, попытка ${attempt}, длина: ${content.length} символов`);

                return {
                    success: true,
                    content: content,
                    metadata: {
                        model: response.model,
                        usage: response.usage,
                        stop_reason: response.stop_reason,
                        response_id: response.id,
                        attempts: attempt
                    }
                };

            } catch (error) {
                console.error(`[Anthropic-Client] Ошибка запроса к Claude API, попытка ${attempt}/${maxRetries}:`, error.message);

                // Детальная обработка ошибок
                let errorDetails = {
                    type: 'unknown_error',
                    message: error.message,
                    attempt: attempt
                };

                if (error.status) {
                    // API ошибки
                    errorDetails = {
                        type: 'api_error',
                        status: error.status,
                        message: error.message,
                        error_type: error.error?.type,
                        error_code: error.error?.code,
                        attempt: attempt
                    };
                } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                    // Ошибки сети
                    errorDetails = {
                        type: 'network_error',
                        message: 'Нет соединения с Anthropic API',
                        code: error.code,
                        attempt: attempt
                    };
                }

                // Проверяем, стоит ли повторить запрос
                const shouldRetry = this.shouldRetryError(error, attempt, maxRetries);
                
                if (shouldRetry) {
                    const delay = this.calculateRetryDelay(attempt, retryDelay, error.status);
                    console.log(`[Anthropic-Client] ⏳ Повтор через ${delay/1000} секунд... (попытка ${attempt}/${maxRetries})`);
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
                attempts: maxRetries
            }
        };
    }

    /**
     * Тест соединения с Anthropic API
     * @returns {object} Результат теста
     */
    async testConnection() {
        try {
            console.log('[Anthropic-Client] Тестирование соединения с Anthropic API...');

            const testPrompt = 'Привет! Ответь кратко: ты работаешь?';
            const result = await this.sendMessage(testPrompt, { max_tokens: 100 });

            if (result.success) {
                console.log('[Anthropic-Client] ✅ Соединение с Anthropic API успешно');
                return {
                    success: true,
                    message: 'Соединение с Anthropic API успешно',
                    test_response: result.content,
                    model: result.metadata.model
                };
            } else {
                console.log('[Anthropic-Client] ❌ Ошибка соединения с Anthropic API');
                return {
                    success: false,
                    message: 'Ошибка соединения с Anthropic API',
                    error: result.error
                };
            }

        } catch (error) {
            console.error('[Anthropic-Client] Критическая ошибка тестирования:', error);
            return {
                success: false,
                message: 'Критическая ошибка тестирования Anthropic API',
                error: error.message
            };
        }
    }

    /**
     * Анализ данных с помощью специфического промпта агента
     * @param {string} agentName - Название агента
     * @param {string} prompt - Промпт агента
     * @param {object} data - Данные для анализа
     * @param {object} options - Дополнительные параметры
     * @returns {object} Результат анализа
     */
    async analyzeWithAgent(agentName, prompt, data, options = {}) {
        try {
            console.log(`[Anthropic-Client] Запуск агента "${agentName}"`);

            // Формирование полного промпта с данными
            const dataString = JSON.stringify(data, null, 2);
            const fullPrompt = `${prompt}\n\nДанные для анализа:\n${dataString}`;

            // Системный промпт для контекста
            const systemPrompt = `Ты - AI-аналитик ресторанного бизнеса. Твоя роль: ${agentName}. 
Анализируй предоставленные данные профессионально и дай конкретные рекомендации.
Отвечай на русском языке, структурированно и по делу.`;

            const result = await this.sendMessage(fullPrompt, {
                ...options,
                system: systemPrompt
            });

            if (result.success) {
                console.log(`[Anthropic-Client] ✅ Агент "${agentName}" завершил анализ`);
                return {
                    success: true,
                    agent_name: agentName,
                    result: result.content,
                    metadata: {
                        ...result.metadata,
                        agent_name: agentName,
                        data_size: dataString.length,
                        prompt_size: prompt.length
                    }
                };
            } else {
                console.error(`[Anthropic-Client] ❌ Ошибка агента "${agentName}":`, result.error);
                return {
                    success: false,
                    agent_name: agentName,
                    error: result.error
                };
            }

        } catch (error) {
            console.error(`[Anthropic-Client] Критическая ошибка агента "${agentName}":`, error);
            return {
                success: false,
                agent_name: agentName,
                error: {
                    type: 'critical_error',
                    message: error.message
                }
            };
        }
    }

    /**
     * Получение статистики использования API
     * @returns {object} Статистика (если доступна)
     */
    getUsageStats() {
        // В текущей версии SDK статистика не всегда доступна
        // Это placeholder для будущего расширения
        return {
            message: 'Статистика использования API будет доступна в будущих версиях',
            api_key_status: this.apiKey ? 'configured' : 'missing'
        };
    }

    /**
     * Определяет, стоит ли повторить запрос при ошибке
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
            console.log(`[Anthropic-Client] 🔄 Ошибка 529 (Overloaded) - повторяем запрос`);
            return true;
        }

        // Повторяем для ошибок сервера (5xx)
        if (error.status >= 500 && error.status < 600) {
            console.log(`[Anthropic-Client] 🔄 Ошибка сервера ${error.status} - повторяем запрос`);
            return true;
        }

        // Повторяем для timeout ошибок
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            console.log(`[Anthropic-Client] 🔄 Ошибка timeout - повторяем запрос`);
            return true;
        }

        // Повторяем для сетевых ошибок
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
            console.log(`[Anthropic-Client] 🔄 Сетевая ошибка ${error.code} - повторяем запрос`);
            return true;
        }

        // Не повторяем для клиентских ошибок (4xx)
        if (error.status >= 400 && error.status < 500) {
            console.log(`[Anthropic-Client] ❌ Клиентская ошибка ${error.status} - не повторяем`);
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
        // Для ошибки 529 (Overloaded) используем агрессивные задержки с прогрессией
        if (errorStatus === 529) {
            // Более агрессивные задержки: 15s, 45s, 90s, 180s, 300s
            const delays = [15000, 45000, 90000, 180000, 300000];
            const delay = delays[attempt - 1] || 300000;
            
            // Добавляем большой jitter для распределения нагрузки
            const jitter = Math.random() * 10000; // До 10 секунд случайности
            return delay + jitter;
        }

        // Экспоненциальный backoff для остальных ошибок
        const delay = baseDelay * Math.pow(2, attempt - 1);
        
        // Добавляем случайный jitter для избежания thundering herd
        const jitter = Math.random() * 1000;
        
        return Math.min(delay + jitter, 30000); // Максимум 30 секунд
    }
}

module.exports = AnthropicClient;