/**
 * 🧪 ТЕСТ РЕАЛЬНОГО ВЫЗОВА AI с проверкой данных
 * Проверяем, что AI действительно получает данные в промпте
 */

const MultiAgentSystem = require('./backend/services/multi-agent-system');
const MCPClient = require('./backend/services/mcp-client');

// Тестовые данные MCP (структура как в реальном API)
const testMCPData = {
    forecast: {
        data: [
            { date: '2025-07-15', predicted_sales: 920000 },
            { date: '2025-07-16', predicted_sales: 750000 },
            { date: '2025-07-17', predicted_sales: 980000 }
        ]
    },
    plan_vs_fact: {
        data: [
            { date: '2025-07-15', predicted_sales: 920000, actual_sales: 850000, error: 70000 },
            { date: '2025-07-16', predicted_sales: 750000, actual_sales: 780000, error: -30000 }
        ]
    },
    hourly_sales: {
        data: {
            morning: { '09:00': 45000, '10:00': 67000, '11:00': 85000 },
            afternoon: { '12:00': 145000, '13:00': 165000, '14:00': 130000 },
            evening: { '18:00': 140000, '19:00': 180000, '20:00': 195000 }
        }
    },
    reviews: {
        data: [
            { rating: 5, text: 'Отличный ресторан! Быстрое обслуживание', date: '2025-07-14' },
            { rating: 2, text: 'Долго ждали заказ, официант был невежлив', date: '2025-07-13' },
            { rating: 4, text: 'Хорошее место для семейного обеда', date: '2025-07-12' }
        ]
    },
    payroll: {
        data: [
            { employee_name: 'Иванов И.И.', payroll_total: 450000, shifts: [{ date: '2025-07-15', hours: 8 }] },
            { employee_name: 'Петров П.П.', payroll_total: 380000, shifts: [{ date: '2025-07-15', hours: 8 }] }
        ]
    }
};

async function testRealAICall() {
    console.log('🧪 ТЕСТ РЕАЛЬНОГО ВЫЗОВА AI С ПРОВЕРКОЙ ДАННЫХ');
    console.log('='.repeat(60));

    try {
        const multiAgent = new MultiAgentSystem();

        // Тестируем SalesAnalysisAgent с Claude
        console.log('\n🎯 ТЕСТ 1: SalesAnalysisAgent с Claude');
        console.log('-'.repeat(40));

        const salesResult = await multiAgent.runSingleAgent(
            'SalesAnalysisAgent',
            testMCPData,
            null,
            {},
            { provider: 'claude' }
        );

        if (salesResult.success) {
            console.log('✅ SalesAnalysisAgent (Claude) - УСПЕШНО');
            console.log('📊 Ответ агента:');
            console.log(salesResult.result.substring(0, 300) + '...');
            
            // Проверяем, содержит ли ответ признаки анализа данных
            const response = salesResult.result.toLowerCase();
            const dataIndicators = [
                'продажи', 'выручка', 'план', 'факт', 'прогноз', 
                '2025-07-15', '2025-07-16', '920000', '750000', '980000'
            ];
            
            const foundIndicators = dataIndicators.filter(indicator => response.includes(indicator));
            console.log(`🔍 Найдено индикаторов данных: ${foundIndicators.length}/${dataIndicators.length}`);
            console.log(`📋 Индикаторы: ${foundIndicators.join(', ')}`);
            
            if (foundIndicators.length > 3) {
                console.log('✅ ДАННЫЕ ПЕРЕДАНЫ КОРРЕКТНО - агент анализирует реальные данные');
            } else {
                console.log('❌ ДАННЫЕ НЕ ПЕРЕДАНЫ - агент отвечает общими фразами');
            }
        } else {
            console.log('❌ SalesAnalysisAgent (Claude) - ОШИБКА');
            console.log('Ошибка:', salesResult.error);
        }

        // Тестируем ReputationAgent с OpenAI
        console.log('\n🎯 ТЕСТ 2: ReputationAgent с OpenAI');
        console.log('-'.repeat(40));

        const reputationResult = await multiAgent.runSingleAgent(
            'ReputationAgent',
            testMCPData,
            null,
            {},
            { provider: 'openai' }
        );

        if (reputationResult.success) {
            console.log('✅ ReputationAgent (OpenAI) - УСПЕШНО');
            console.log('📊 Ответ агента:');
            console.log(reputationResult.result.substring(0, 300) + '...');
            
            // Проверяем, содержит ли ответ признаки анализа отзывов
            const response = reputationResult.result.toLowerCase();
            const reviewIndicators = [
                'отзыв', 'рейтинг', 'обслуживание', 'ресторан', 
                'быстрое', 'долго', 'официант', 'семейный'
            ];
            
            const foundIndicators = reviewIndicators.filter(indicator => response.includes(indicator));
            console.log(`🔍 Найдено индикаторов отзывов: ${foundIndicators.length}/${reviewIndicators.length}`);
            console.log(`📋 Индикаторы: ${foundIndicators.join(', ')}`);
            
            if (foundIndicators.length > 3) {
                console.log('✅ ДАННЫЕ ПЕРЕДАНЫ КОРРЕКТНО - агент анализирует реальные отзывы');
            } else {
                console.log('❌ ДАННЫЕ НЕ ПЕРЕДАНЫ - агент отвечает общими фразами');
            }
        } else {
            console.log('❌ ReputationAgent (OpenAI) - ОШИБКА');
            console.log('Ошибка:', reputationResult.error);
        }

        // Тестируем пустой промпт без данных для сравнения
        console.log('\n🎯 ТЕСТ 3: Тест без данных (должен просить данные)');
        console.log('-'.repeat(40));

        const emptyResult = await multiAgent.runSingleAgent(
            'SalesAnalysisAgent',
            {},  // Пустые данные
            'Проанализируй продажи ресторана',
            {},
            { provider: 'claude' }
        );

        if (emptyResult.success) {
            console.log('✅ Тест без данных - УСПЕШНО');
            console.log('📊 Ответ агента:');
            console.log(emptyResult.result.substring(0, 300) + '...');
            
            const response = emptyResult.result.toLowerCase();
            const requestIndicators = [
                'предоставьте данные', 'нужны данные', 'данные для анализа',
                'предоставьте информацию', 'отсутствуют данные'
            ];
            
            const foundRequests = requestIndicators.filter(indicator => response.includes(indicator));
            console.log(`🔍 Найдено запросов данных: ${foundRequests.length}/${requestIndicators.length}`);
            
            if (foundRequests.length > 0) {
                console.log('✅ ПРАВИЛЬНО - агент запрашивает данные при их отсутствии');
            } else {
                console.log('❌ НЕПРАВИЛЬНО - агент не запрашивает данные');
            }
        } else {
            console.log('❌ Тест без данных - ОШИБКА');
            console.log('Ошибка:', emptyResult.error);
        }

        // Заключение
        console.log('\n' + '='.repeat(60));
        console.log('📋 ЗАКЛЮЧЕНИЕ ТЕСТИРОВАНИЯ');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('💥 КРИТИЧЕСКАЯ ОШИБКА ТЕСТИРОВАНИЯ:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Запуск теста
testRealAICall().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});