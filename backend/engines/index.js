/**
 * AI Engines Module
 * Централизованный экспорт всех AI движков и утилит
 */

const BaseEngine = require('./base-engine');
const ClaudeEngine = require('./claude-engine');
const GeminiEngine = require('./gemini-engine');
const EngineDispatcher = require('./engine-dispatcher');

// Импорт OpenAI движка
const OpenAIEngine = require('./openai-engine');

/**
 * Фабрика для создания движков
 * @param {string} provider - Название провайдера
 * @param {string} apiKey - API ключ
 * @param {object} options - Дополнительные параметры
 * @returns {BaseEngine} Экземпляр движка
 */
function createEngine(provider, apiKey, options = {}) {
    const dispatcher = new EngineDispatcher();
    return dispatcher.getEngine(provider, { apiKey, ...options });
}

/**
 * Создание движка для конкретного агента
 * @param {string} agentName - Название агента
 * @param {string} provider - Провайдер
 * @param {object} options - Дополнительные параметры
 * @returns {BaseEngine} Экземпляр движка
 */
function createEngineForAgent(agentName, provider = 'claude', options = {}) {
    const dispatcher = new EngineDispatcher();
    return dispatcher.getEngineForAgent(agentName, provider, options);
}

/**
 * Проверка доступности всех провайдеров
 * @returns {Promise<object>} Статус провайдеров
 */
async function validateAllProviders() {
    const dispatcher = new EngineDispatcher();
    return await dispatcher.validateAllProviders();
}

/**
 * Получение информации о всех доступных движках
 * @returns {object} Информация о движках
 */
function getEnginesInfo() {
    const dispatcher = new EngineDispatcher();
    const info = dispatcher.getProvidersInfo();
    
    return {
        ...info,
        available_engines: {
            BaseEngine: !!BaseEngine,
            ClaudeEngine: !!ClaudeEngine,
            OpenAIEngine: !!OpenAIEngine,
            GeminiEngine: !!GeminiEngine
        },
        version: '1.0.0',
        last_updated: '2025-07-15'
    };
}

module.exports = {
    // Основные классы
    BaseEngine,
    ClaudeEngine,
    OpenAIEngine,
    GeminiEngine,
    EngineDispatcher,
    
    // Фабричные методы
    createEngine,
    createEngineForAgent,
    
    // Утилиты
    validateAllProviders,
    getEnginesInfo,
    
    // Константы
    SUPPORTED_PROVIDERS: ['claude', 'openai', 'gemini'],
    DEFAULT_PROVIDER: 'claude'
};