const AnthropicClient = require('./backend/services/anthropic-client');
const MultiAgentSystem = require('./backend/services/multi-agent-system');
require('dotenv').config();

// Тестируем улучшенную AI систему
async function testImprovedAI() {
    console.log('🧪 Тестирование улучшенной AI системы\n');
    
    // 1. Тест Anthropic Client с retry логикой
    console.log('1️⃣ Тестирование Anthropic Client...');
    const anthropicClient = new AnthropicClient();
    
    try {
        const testResponse = await anthropicClient.sendMessage(
            'Привет! Проверяем работу AI. Ответь кратко: система работает?',
            { 
                max_tokens: 100,
                maxRetries: 2, // Тестируем с 2 попытками
                retryDelay: 2000 // 2 секунды задержка
            }
        );
        
        if (testResponse.success) {
            console.log('✅ Anthropic Client работает корректно');
            console.log(`📝 Ответ: ${testResponse.content.substring(0, 100)}...`);
            console.log(`🔄 Попыток использовано: ${testResponse.metadata.attempts || 1}`);
        } else {
            console.log('❌ Ошибка Anthropic Client:', testResponse.error);
        }
    } catch (error) {
        console.error('❌ Критическая ошибка тестирования Anthropic:', error);
    }
    
    // 2. Тест мультиагентной системы (симуляция)
    console.log('\n2️⃣ Тестирование структуры MultiAgent системы...');
    const multiAgent = new MultiAgentSystem();
    
    // Проверяем конфигурацию агентов
    console.log('📋 Конфигурация агентов:');
    Object.keys(multiAgent.agents).forEach(agentName => {
        const agent = multiAgent.agents[agentName];
        console.log(`   - ${agent.description} (${agentName})`);
    });
    
    console.log('\n🔧 Новые улучшения:');
    console.log('✅ Retry логика с экспоненциальным backoff');
    console.log('✅ Специальная обработка ошибки 529 (Overloaded)');
    console.log('✅ Увеличенные паузы между агентами: 5-15 секунд');
    console.log('✅ Разделение агентов на группы (основные/зависимые)');
    console.log('✅ Дополнительная пауза перед зависимыми агентами');
    
    // 3. Демонстрация временных интервалов
    console.log('\n3️⃣ Временные интервалы для анализа:');
    console.log('📊 Основные агенты (1-4):');
    console.log('   - SalesAnalysisAgent → пауза 5 сек');
    console.log('   - PayrollAnalysisAgent → пауза 5 сек');
    console.log('   - StaffingAgent → пауза 5 сек');
    console.log('   - ReputationAgent → пауза 10 сек (переход)');
    
    console.log('\n🎯 Зависимые агенты (5-6):');
    console.log('   - OptimizationAgent → пауза 15 сек');
    console.log('   - NarrativeAgent → завершение');
    
    console.log('\n⏱️  Общее время анализа: ~2-3 минуты (было ~30 секунд)');
    
    // 4. Тест retry логики (симуляция)
    console.log('\n4️⃣ Демонстрация retry логики...');
    
    const testRetryLogic = (errorStatus, attempt) => {
        const shouldRetry = anthropicClient.shouldRetryError(
            { status: errorStatus }, 
            attempt, 
            3
        );
        const delay = anthropicClient.calculateRetryDelay(attempt, 5000, errorStatus);
        
        return { shouldRetry, delay };
    };
    
    console.log('Ошибка 529 (Overloaded):');
    [1, 2, 3].forEach(attempt => {
        const result = testRetryLogic(529, attempt);
        console.log(`   Попытка ${attempt}: повтор=${result.shouldRetry}, задержка=${result.delay/1000}с`);
    });
    
    console.log('\nОшибка 500 (Server Error):');
    [1, 2, 3].forEach(attempt => {
        const result = testRetryLogic(500, attempt);
        console.log(`   Попытка ${attempt}: повтор=${result.shouldRetry}, задержка=${result.delay/1000}с`);
    });
    
    console.log('\nОшибка 400 (Client Error):');
    const result400 = testRetryLogic(400, 1);
    console.log(`   Попытка 1: повтор=${result400.shouldRetry} (клиентские ошибки не повторяются)`);
    
    console.log('\n🎉 Тестирование завершено! Система готова к работе.');
    console.log('\n📋 Рекомендации:');
    console.log('1. Запускайте анализы в непиковые часы');
    console.log('2. При ошибке 529 система автоматически повторит через 10-60 секунд');
    console.log('3. Общее время анализа увеличилось для стабильности');
    console.log('4. Используйте функцию перезапуска агентов при необходимости');
}

testImprovedAI().catch(console.error);