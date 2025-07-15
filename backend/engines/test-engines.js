/**
 * Тестовый скрипт для проверки всех AI движков
 * Использование: node backend/engines/test-engines.js
 */

require('dotenv').config();

const { EngineDispatcher, validateAllProviders, getEnginesInfo } = require('./index');

async function testEngines() {
    console.log('🚀 Тестирование AI движков...\n');

    try {
        // 1. Информация о движках
        console.log('📋 Информация о движках:');
        const info = getEnginesInfo();
        console.log(JSON.stringify(info, null, 2));
        console.log('\n' + '='.repeat(80) + '\n');

        // 2. Создание диспетчера
        const dispatcher = new EngineDispatcher();
        
        // 3. Проверка всех провайдеров
        console.log('🔍 Проверка доступности провайдеров:');
        const validation = await validateAllProviders();
        
        for (const [provider, result] of Object.entries(validation.results)) {
            const status = result.available ? '✅' : '❌';
            console.log(`${status} ${provider.toUpperCase()}: ${result.available ? 'доступен' : 'недоступен'}`);
            
            if (!result.available && result.error) {
                console.log(`   Ошибка: ${result.error}`);
            }
        }
        
        console.log(`\nДоступно провайдеров: ${validation.available_providers}/${validation.total_providers}`);
        console.log('\n' + '='.repeat(80) + '\n');

        // 4. Тестирование каждого доступного провайдера
        for (const [provider, result] of Object.entries(validation.results)) {
            if (result.available) {
                await testProvider(dispatcher, provider);
                console.log('\n' + '-'.repeat(50) + '\n');
            }
        }

        console.log('🎉 Тестирование завершено!');

    } catch (error) {
        console.error('❌ Критическая ошибка тестирования:', error);
        process.exit(1);
    }
}

async function testProvider(dispatcher, provider) {
    console.log(`🧪 Тестирование провайдера: ${provider.toUpperCase()}`);
    
    try {
        // Создание движка
        const engine = dispatcher.getEngine(provider);
        console.log(`✅ Движок ${provider} создан: ${engine.constructor.name}`);
        
        // Информация о движке
        const stats = engine.getUsageStats();
        console.log(`📊 Модели: ${stats.supported_models.join(', ')}`);
        
        // Быстрый тест анализа
        const testPrompt = 'Проанализируй следующие данные продаж ресторана: выручка за день 850 000 тенге, количество чеков 127. Дай краткий вывод в 2-3 предложения.';
        
        console.log('⏳ Выполнение тестового анализа...');
        const startTime = Date.now();
        
        const result = await engine.run(testPrompt, {
            systemPrompt: 'Ты - AI аналитик ресторанного бизнеса. Отвечай кратко и по делу на русском языке.'
        }, {
            maxTokens: 200,
            maxRetries: 2
        });
        
        const duration = Date.now() - startTime;
        
        if (result.success) {
            console.log(`✅ Анализ успешен (${duration}ms)`);
            console.log(`📝 Ответ: ${result.content.substring(0, 200)}...`);
            
            if (result.metadata) {
                console.log(`📊 Использование: модель=${result.metadata.model}`);
                if (result.metadata.usage) {
                    console.log(`📊 Токены: ${JSON.stringify(result.metadata.usage)}`);
                }
            }
        } else {
            console.log(`❌ Ошибка анализа: ${result.error.message}`);
        }

        // Тест через агента
        console.log('⏳ Тестирование через агента...');
        const agentResult = await engine.analyzeWithAgent(
            'TestAgent',
            'Проанализируй данные продаж: {sales_data}',
            { sales_data: { revenue: 850000, checks: 127, date: '2025-07-15' } },
            { maxTokens: 150, maxRetries: 2 }
        );
        
        if (agentResult.success) {
            console.log(`✅ Агент тест успешен`);
            console.log(`📝 Результат агента: ${agentResult.result.substring(0, 150)}...`);
        } else {
            console.log(`❌ Ошибка агента: ${agentResult.error.message}`);
        }

    } catch (error) {
        console.error(`❌ Ошибка тестирования ${provider}:`, error.message);
    }
}

// Запуск тестирования
if (require.main === module) {
    testEngines().catch(error => {
        console.error('💥 Фатальная ошибка:', error);
        process.exit(1);
    });
}

module.exports = { testEngines };