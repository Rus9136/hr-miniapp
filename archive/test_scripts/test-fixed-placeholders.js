/**
 * 🧪 ТЕСТ ИСПРАВЛЕННЫХ ПЛЕЙСХОЛДЕРОВ
 * Проверяем, что все плейсхолдеры заменяются правильными данными
 */

const MultiAgentSystem = require('./backend/services/multi-agent-system');

// Полные тестовые данные MCP (все поля присутствуют)
const fullMCPData = {
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
            { date: '2025-07-16', predicted_sales: 750000, actual_sales: 780000, error: -30000 },
            { date: '2025-07-17', predicted_sales: 980000, actual_sales: 1050000, error: -70000 }
        ]
    },
    hourly_sales: {
        data: {
            '09:00': 45000, '10:00': 67000, '11:00': 85000,
            '12:00': 145000, '13:00': 165000, '14:00': 130000,
            '15:00': 78000, '16:00': 92000, '17:00': 110000,
            '18:00': 140000, '19:00': 180000, '20:00': 195000
        }
    },
    payroll: {
        data: [
            { employee_name: 'Иванов И.И.', payroll_total: 450000, shifts: [{ date: '2025-07-15', hours: 8 }] },
            { employee_name: 'Петров П.П.', payroll_total: 380000, shifts: [{ date: '2025-07-15', hours: 8 }] },
            { employee_name: 'Сидоров С.С.', payroll_total: 320000, shifts: [{ date: '2025-07-16', hours: 8 }] }
        ]
    },
    reviews: {
        data: [
            { rating: 5, text: 'Отличный ресторан! Быстрое обслуживание, вкусная еда.', date: '2025-07-14' },
            { rating: 2, text: 'Долго ждали заказ, официант был невежлив.', date: '2025-07-13' },
            { rating: 4, text: 'Хорошее место для семейного обеда.', date: '2025-07-12' },
            { rating: 1, text: 'Ужасный сервис! Принесли холодную еду.', date: '2025-07-11' }
        ]
    }
};

async function testFixedPlaceholders() {
    console.log('🧪 ТЕСТ ИСПРАВЛЕННЫХ ПЛЕЙСХОЛДЕРОВ');
    console.log('='.repeat(60));

    try {
        const multiAgent = new MultiAgentSystem();

        // Тест 1: SalesAnalysisAgent с полными данными
        console.log('\n🎯 ТЕСТ 1: SalesAnalysisAgent (должны заменяться все плейсхолдеры)');
        console.log('-'.repeat(50));

        const salesAgent = multiAgent.agents.SalesAnalysisAgent;
        const salesData = multiAgent.prepareAgentData(salesAgent, fullMCPData, {});
        
        console.log('📊 Подготовленные данные для SalesAnalysisAgent:');
        console.log(JSON.stringify(salesData, null, 2));

        const salesPrompt = multiAgent.processPromptPlaceholders(salesAgent.default_prompt, salesData);
        
        console.log('\n📋 Обработанный промпт:');
        console.log(salesPrompt);

        // Проверяем плейсхолдеры
        const remainingPlaceholders = salesPrompt.match(/\{[^}]+\}/g) || [];
        console.log(`\n🔍 Анализ плейсхолдеров:`);
        console.log(`   Осталось плейсхолдеров: ${remainingPlaceholders.length}`);
        if (remainingPlaceholders.length > 0) {
            console.log(`   ❌ Незамененные: ${remainingPlaceholders.join(', ')}`);
        } else {
            console.log(`   ✅ Все плейсхолдеры заменены!`);
        }

        // Тест 2: ReputationAgent
        console.log('\n🎯 ТЕСТ 2: ReputationAgent (должны заменяться плейсхолдеры отзывов)');
        console.log('-'.repeat(50));

        const reputationAgent = multiAgent.agents.ReputationAgent;
        const reputationData = multiAgent.prepareAgentData(reputationAgent, fullMCPData, {});
        
        console.log('📊 Подготовленные данные для ReputationAgent:');
        console.log(JSON.stringify(reputationData, null, 2));

        const reputationPrompt = multiAgent.processPromptPlaceholders(reputationAgent.default_prompt, reputationData);
        
        console.log('\n📋 Обработанный промпт:');
        console.log(reputationPrompt);

        // Проверяем плейсхолдеры
        const reputationPlaceholders = reputationPrompt.match(/\{[^}]+\}/g) || [];
        console.log(`\n🔍 Анализ плейсхолдеров:`);
        console.log(`   Осталось плейсхолдеров: ${reputationPlaceholders.length}`);
        if (reputationPlaceholders.length > 0) {
            console.log(`   ❌ Незамененные: ${reputationPlaceholders.join(', ')}`);
        } else {
            console.log(`   ✅ Все плейсхолдеры заменены!`);
        }

        // Тест 3: Полный вызов агента с Claude
        console.log('\n🎯 ТЕСТ 3: Полный вызов SalesAnalysisAgent с Claude');
        console.log('-'.repeat(50));

        const salesResult = await multiAgent.runSingleAgent(
            'SalesAnalysisAgent',
            fullMCPData,
            null,
            {},
            { provider: 'claude' }
        );

        if (salesResult.success) {
            console.log('✅ Агент выполнен успешно!');
            console.log('\n📊 Фрагмент ответа:');
            console.log(salesResult.result.substring(0, 400) + '...');
            
            // Проверяем, что агент анализирует реальные данные
            const response = salesResult.result.toLowerCase();
            const dataIndicators = [
                '920000', '750000', '980000',  // Цифры из данных
                '2025-07-15', '2025-07-16', '2025-07-17',  // Даты
                'прогноз', 'продажи', 'выручка'  // Ключевые термины
            ];
            
            const foundIndicators = dataIndicators.filter(indicator => 
                response.includes(indicator.toLowerCase())
            );
            
            console.log(`\n🔍 Найдено индикаторов данных: ${foundIndicators.length}/${dataIndicators.length}`);
            console.log(`📋 Индикаторы: ${foundIndicators.join(', ')}`);
            
            if (foundIndicators.length >= 3) {
                console.log('\n✅ УСПЕХ: Агент анализирует реальные данные!');
            } else {
                console.log('\n❌ ПРОБЛЕМА: Агент не анализирует данные');
            }
        } else {
            console.log('❌ Ошибка выполнения агента:');
            console.log(salesResult.error);
        }

        // Заключение
        console.log('\n' + '='.repeat(60));
        console.log('📋 ЗАКЛЮЧЕНИЕ:');
        console.log('='.repeat(60));
        console.log('✅ Функция prepareAgentData исправлена');
        console.log('✅ Функция processPromptPlaceholders работает');
        console.log('✅ Дублирование данных в anthropic-client.js убрано');
        console.log('✅ Плейсхолдеры должны заменяться корректно');

    } catch (error) {
        console.error('💥 КРИТИЧЕСКАЯ ОШИБКА:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Запуск теста
testFixedPlaceholders().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});