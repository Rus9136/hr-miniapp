const MultiAgentSystem = require('./backend/services/multi-agent-system');

console.log('🤖 Тест AI провайдеров для проверки замены плейсхолдеров\n');

// Тестовые данные в формате MCP API
const testMcpData = {
    forecast: {
        data: [
            { date: '2025-01-01', plan: 850000, fact: 920000 },
            { date: '2025-01-02', plan: 900000, fact: 880000 }
        ]
    },
    hourly_sales: {
        data: [
            { hour: 10, weekday_avg: 125000, weekend_avg: 180000 },
            { hour: 11, weekday_avg: 150000, weekend_avg: 220000 }
        ]
    },
    reviews: {
        data: [
            { rating: 5, comment: 'Отличный сервис!' },
            { rating: 3, comment: 'Долгое ожидание заказа' }
        ]
    }
};

async function testSingleAgent(provider, agentName) {
    console.log(`\n🔍 Тестирование ${agentName} с провайдером: ${provider}`);
    
    const multiAgent = new MultiAgentSystem();
    
    try {
        // Тест методов подготовки данных
        const agent = multiAgent.agents[agentName];
        const agentData = multiAgent.prepareAgentData(agent, testMcpData, {});
        
        console.log(`✅ Подготовленные данные для ${agentName}:`);
        console.log(JSON.stringify(agentData, null, 2));
        
        // Тест замены плейсхолдеров
        const prompt = agent.default_prompt;
        const processedPrompt = multiAgent.processPromptPlaceholders(prompt, agentData);
        
        console.log(`\n🔄 Обработанный промпт для ${provider}:`);
        console.log(processedPrompt);
        
        // Проверка на оставшиеся плейсхолдеры
        const remainingPlaceholders = processedPrompt.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
        if (remainingPlaceholders && remainingPlaceholders.length > 0) {
            console.log(`❌ ОШИБКА: Остались незамененные плейсхолдеры:`, remainingPlaceholders);
            return false;
        } else {
            console.log(`✅ Все плейсхолдеры успешно заменены для ${provider}`);
        }
        
        // Проверка размера промпта
        const promptSize = processedPrompt.length;
        console.log(`📏 Размер промпта: ${promptSize} символов`);
        
        if (promptSize > 200000) {
            console.log(`⚠️ Внимание: Промпт очень большой (${promptSize} символов), может вызвать проблемы с API`);
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ Ошибка при тестировании ${agentName} с ${provider}:`, error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Запуск тестов AI провайдеров...\n');
    
    const providers = ['claude', 'openai'];
    const agents = ['SalesAnalysisAgent', 'PayrollAnalysisAgent', 'ReputationAgent'];
    const results = {};
    
    for (const provider of providers) {
        results[provider] = {};
        console.log(`\n🔧 Тестирование провайдера: ${provider}`);
        console.log('='.repeat(60));
        
        for (const agentName of agents) {
            const success = await testSingleAgent(provider, agentName);
            results[provider][agentName] = success;
            console.log('\n' + '-'.repeat(40));
        }
    }
    
    // Сводка результатов
    console.log('\n\n📊 Сводка результатов тестирования:');
    console.log('='.repeat(60));
    
    for (const provider of providers) {
        const successCount = Object.values(results[provider]).filter(Boolean).length;
        const totalCount = Object.keys(results[provider]).length;
        
        console.log(`\n${provider.toUpperCase()}: ${successCount}/${totalCount} агентов прошли тест`);
        
        for (const [agentName, success] of Object.entries(results[provider])) {
            const status = success ? '✅' : '❌';
            console.log(`  ${status} ${agentName}`);
        }
    }
    
    // Проверка общего результата
    const allPassed = Object.values(results).every(providerResults => 
        Object.values(providerResults).every(Boolean)
    );
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
        console.log('🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!');
        console.log('✅ Плейсхолдеры корректно заменяются для всех провайдеров');
    } else {
        console.log('❌ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ!');
        console.log('🔴 Есть проблемы с заменой плейсхолдеров');
    }
}

// Запуск тестов
runTests().catch(console.error);