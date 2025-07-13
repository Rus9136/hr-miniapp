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
     * Отправка запроса к Claude API
     * @param {string} prompt - Промпт для анализа
     * @param {object} options - Дополнительные параметры
     * @returns {object} Результат анализа или ошибка
     */
    async sendMessage(prompt, options = {}) {
        try {
            const {
                model = this.defaultModel,
                max_tokens = this.maxTokens,
                temperature = this.temperature,
                system = null
            } = options;

            console.log(`[Anthropic-Client] Отправка запроса к Claude (${model}), длина промпта: ${prompt.length} символов`);

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

            console.log(`[Anthropic-Client] ✅ Получен ответ от Claude, длина: ${content.length} символов`);

            return {
                success: true,
                content: content,
                metadata: {
                    model: response.model,
                    usage: response.usage,
                    stop_reason: response.stop_reason,
                    response_id: response.id
                }
            };

        } catch (error) {
            console.error('[Anthropic-Client] Ошибка запроса к Claude API:', error.message);

            // Детальная обработка ошибок
            let errorDetails = {
                type: 'unknown_error',
                message: error.message
            };

            if (error.status) {
                // API ошибки
                errorDetails = {
                    type: 'api_error',
                    status: error.status,
                    message: error.message,
                    error_type: error.error?.type,
                    error_code: error.error?.code
                };
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                // Ошибки сети
                errorDetails = {
                    type: 'network_error',
                    message: 'Нет соединения с Anthropic API',
                    code: error.code
                };
            }

            return {
                success: false,
                error: errorDetails
            };
        }
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
}

module.exports = AnthropicClient;