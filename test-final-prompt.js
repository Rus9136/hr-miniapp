/**
 * 🔍 ТЕСТ ФИНАЛЬНОГО ПРОМПТА
 * Проверяем, как выглядит финальный промпт, который отправляется в AI
 */

const MultiAgentSystem = require('./backend/services/multi-agent-system');

// Тестовые данные
const testData = {
    forecast: {
        data: [
            { date: '2025-07-15', predicted_sales: 920000 },
            { date: '2025-07-16', predicted_sales: 750000 }
        ]
    },
    reviews: {
        data: [
            { rating: 5, text: 'Отличный ресторан!' },
            { rating: 2, text: 'Долго ждали заказ' }
        ]
    }
};

// Создаем модифицированный AnthropicClient для логирования
class TestAnthropicClient {
    constructor() {
        console.log('[TestClient] Инициализирован тестовый клиент');
    }

    async analyzeWithAgent(agentName, prompt, data, options = {}) {
        console.log('\n🔍 ФИНАЛЬНЫЙ ПРОМПТ ДЛЯ CLAUDE:');
        console.log('='.repeat(80));
        console.log(`Агент: ${agentName}`);
        console.log(`Размер данных: ${JSON.stringify(data).length} символов`);
        console.log('='.repeat(80));

        // Формирование полного промпта с данными (как в реальном коде)
        const dataString = JSON.stringify(data, null, 2);
        const fullPrompt = `${prompt}\n\nДанные для анализа:\n${dataString}`;

        console.log('📋 ОБРАБОТАННЫЙ ПРОМПТ:');
        console.log(fullPrompt);
        console.log('='.repeat(80));

        // Анализ промпта
        const hasPlaceholders = fullPrompt.includes('{');
        const hasData = fullPrompt.includes('"date":') || fullPrompt.includes('"rating":');
        
        console.log('🔍 АНАЛИЗ ПРОМПТА:');
        console.log(`❓ Есть необработанные плейсхолдеры: ${hasPlaceholders ? '❌ ДА' : '✅ НЕТ'}`);
        console.log(`📊 Есть данные в промпте: ${hasData ? '✅ ДА' : '❌ НЕТ'}`);
        
        if (hasPlaceholders) {
            const placeholders = fullPrompt.match(/\{[^}]+\}/g) || [];
            console.log(`🚨 Найдены плейсхолдеры: ${placeholders.join(', ')}`);
        }

        return {
            success: true,
            agent_name: agentName,
            result: 'Тестовый ответ - промпт проанализирован',
            metadata: {
                prompt_size: fullPrompt.length,
                data_size: dataString.length,
                has_placeholders: hasPlaceholders,
                has_data: hasData
            }
        };
    }
}

async function testFinalPrompt() {
    console.log('🔍 ТЕСТ ФИНАЛЬНОГО ПРОМПТА');
    console.log('='.repeat(60));

    try {
        // Создаем MultiAgentSystem с заменой клиента
        const multiAgent = new MultiAgentSystem();
        
        // Заменяем реальный клиент на тестовый
        multiAgent.apiClients.default = new TestAnthropicClient();

        // Тестируем SalesAnalysisAgent
        console.log('\n🎯 ТЕСТ: SalesAnalysisAgent');
        const result = await multiAgent.runSingleAgent(
            'SalesAnalysisAgent',
            testData,
            null,
            {},
            { provider: 'claude' }
        );

        console.log('\n📊 РЕЗУЛЬТАТ:');
        console.log(`✅ Успешно: ${result.success}`);
        console.log(`📏 Размер промпта: ${result.metadata?.prompt_size || 'N/A'}`);
        console.log(`📄 Размер данных: ${result.metadata?.data_size || 'N/A'}`);
        console.log(`🔍 Плейсхолдеры: ${result.metadata?.has_placeholders ? '❌ Есть' : '✅ Нет'}`);
        console.log(`📊 Данные: ${result.metadata?.has_data ? '✅ Есть' : '❌ Нет'}`);

    } catch (error) {
        console.error('💥 Ошибка:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Запуск теста
testFinalPrompt().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});