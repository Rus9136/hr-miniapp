const BaseEngine = require('./base-engine');
const AnthropicClient = require('../services/anthropic-client');

/**
 * Claude (Anthropic) AI Engine
 * Wrapper для существующего AnthropicClient
 */
class ClaudeEngine extends BaseEngine {
    constructor(apiKey, options = {}) {
        super(apiKey, options);
        
        // Инициализация существующего AnthropicClient
        this.anthropicClient = new AnthropicClient(apiKey);
        
        this.defaultModel = 'claude-sonnet-4-20250514';
        this.supportedModels = [
            'claude-sonnet-4-20250514',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229'
        ];
    }

    /**
     * Основной метод выполнения AI анализа через Claude
     * @param {string} prompt - Промпт для анализа
     * @param {object} context - Контекстные данные
     * @param {object} options - Дополнительные параметры
     * @returns {Promise<object>} Результат анализа
     */
    async run(prompt, context = {}, options = {}) {
        try {
            const mergedOptions = {
                ...this.options,
                ...options,
                system: context.systemPrompt || null
            };

            console.log(`[Claude-Engine] Отправка запроса, длина промпта: ${prompt.length} символов`);

            // Используем существующий AnthropicClient
            const result = await this.anthropicClient.sendMessage(prompt, mergedOptions);

            if (result.success) {
                return {
                    success: true,
                    content: result.content,
                    metadata: {
                        ...result.metadata,
                        provider: 'claude',
                        engine: 'claude-engine'
                    }
                };
            } else {
                return {
                    success: false,
                    error: {
                        ...result.error,
                        provider: 'claude',
                        engine: 'claude-engine'
                    }
                };
            }

        } catch (error) {
            console.error('[Claude-Engine] Критическая ошибка:', error);
            return {
                success: false,
                error: {
                    type: 'critical_error',
                    message: error.message,
                    provider: 'claude',
                    engine: 'claude-engine'
                }
            };
        }
    }

    /**
     * Анализ данных с помощью агента (совместимость с существующим кодом)
     * @param {string} agentName - Название агента
     * @param {string} prompt - Промпт агента
     * @param {object} data - Данные для анализа
     * @param {object} options - Дополнительные параметры
     * @returns {Promise<object>} Результат анализа
     */
    async analyzeWithAgent(agentName, prompt, data, options = {}) {
        try {
            console.log(`[Claude-Engine] Прямой вызов через AnthropicClient для агента "${agentName}"`);
            
            // Используем существующий метод AnthropicClient для максимальной совместимости
            const result = await this.anthropicClient.analyzeWithAgent(agentName, prompt, data, options);
            
            // Добавляем информацию о провайдере
            if (result.metadata) {
                result.metadata.provider = 'claude';
                result.metadata.engine = 'claude-engine';
            }
            
            return result;

        } catch (error) {
            console.error(`[Claude-Engine] Критическая ошибка агента "${agentName}":`, error);
            return {
                success: false,
                agent_name: agentName,
                error: {
                    type: 'critical_error',
                    message: error.message,
                    provider: 'claude',
                    engine: 'claude-engine'
                }
            };
        }
    }

    /**
     * Проверка подключения к Anthropic API
     * @returns {Promise<object>} Результат теста
     */
    async validateConnection() {
        try {
            console.log('[Claude-Engine] Тестирование соединения с Anthropic API...');
            
            // Используем существующий метод testConnection
            const result = await this.anthropicClient.testConnection();
            
            // Добавляем информацию о провайдере
            result.provider = 'claude';
            result.engine = 'claude-engine';
            
            return result;

        } catch (error) {
            console.error('[Claude-Engine] Критическая ошибка тестирования:', error);
            return {
                success: false,
                provider: 'claude',
                engine: 'claude-engine',
                message: 'Критическая ошибка тестирования Claude API',
                error: error.message
            };
        }
    }

    /**
     * Получение имени провайдера
     * @returns {string} Название провайдера
     */
    getProviderName() {
        return 'claude';
    }

    /**
     * Получение поддерживаемых моделей
     * @returns {array} Список моделей
     */
    getSupportedModels() {
        return this.supportedModels;
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
            anthropic_client_stats: this.anthropicClient.getUsageStats()
        };
    }

    /**
     * Установка кастомной модели
     * @param {string} model - Название модели
     */
    setModel(model) {
        if (this.supportedModels.includes(model)) {
            this.anthropicClient.defaultModel = model;
            console.log(`[Claude-Engine] Модель изменена на: ${model}`);
        } else {
            throw new Error(`Модель ${model} не поддерживается. Доступные: ${this.supportedModels.join(', ')}`);
        }
    }

    /**
     * Получение текущей модели
     * @returns {string} Название модели
     */
    getCurrentModel() {
        return this.anthropicClient.defaultModel || this.defaultModel;
    }
}

module.exports = ClaudeEngine;