#!/usr/bin/env node

/**
 * Тестирование улучшенной AI системы с защитой от ошибок 529
 * Используется для проверки работоспособности агентов после оптимизации
 */

const MultiAgentSystem = require('./backend/services/multi-agent-system');
const MCP_Client = require('./backend/services/mcp-client');

// Конфигурация тестирования
const TEST_CONFIG = {
    DEPARTMENT_ID: 'ff808e81-5a5e-4ee8-b0e4-c1e13e0d7a3b', // Тестовое подразделение
    DATE_START: '2025-07-01',
    DATE_END: '2025-07-14',
    REVIEWS_COUNT: 10 // Меньше отзывов для быстрого тестирования
};

async function testImprovedAISystem() {
    console.log('🚀 Тестирование улучшенной AI системы с защитой от ошибок 529');
    console.log('='.repeat(70));
    
    try {
        // Инициализация клиентов
        const multiAgentSystem = new MultiAgentSystem();
        const mcpClient = new MCP_Client();
        
        console.log('\n📊 Информация о системе:');
        const agentsInfo = multiAgentSystem.getAgentsInfo();
        console.log(`- Всего агентов: ${agentsInfo.total_agents}`);
        console.log(`- Circuit breaker: ${agentsInfo.circuit_breaker.state}`);
        console.log(`- Ошибок 529: ${agentsInfo.circuit_breaker.failure_count}`);
        
        // Получение данных от MCP API
        console.log('\n🔄 Получение данных от MCP API...');
        const mcpData = await mcpClient.getDashboardData(
            TEST_CONFIG.DEPARTMENT_ID,
            TEST_CONFIG.DATE_START,
            TEST_CONFIG.DATE_END,
            TEST_CONFIG.REVIEWS_COUNT
        );
        
        if (!mcpData.success) {
            throw new Error(`MCP API ошибка: ${mcpData.error}`);
        }
        
        console.log('✅ Данные получены успешно:');
        console.log(`- Прогноз: ${mcpData.data.forecast?.data?.length || 0} записей`);
        console.log(`- План/факт: ${mcpData.data.plan_vs_fact?.data?.length || 0} записей`);
        console.log(`- Почасовые: ${mcpData.data.hourly_sales?.data?.length || 0} записей`);
        console.log(`- ФОТ: ${mcpData.data.payroll?.data?.length || 0} записей`);
        console.log(`- Отзывы: ${mcpData.data.reviews?.data?.length || 0} записей`);
        
        // Запуск мультиагентного анализа
        console.log('\n🤖 Запуск мультиагентного анализа...');
        console.log('Ожидайте, система использует улучшенную логику retry и адаптивные паузы');
        
        const startTime = Date.now();
        const analysisResult = await multiAgentSystem.runAnalysis(mcpData.data);
        const endTime = Date.now();
        
        const analysisTime = Math.round((endTime - startTime) / 1000);
        console.log(`\n⏱️ Анализ завершен за ${analysisTime} секунд`);
        
        // Анализ результатов
        console.log('\n📈 Результаты анализа:');
        console.log('='.repeat(50));
        
        if (analysisResult.success) {
            console.log('✅ Анализ завершен успешно');
            
            const { metadata, results } = analysisResult;
            console.log(`\n📊 Статистика:`);
            console.log(`- Всего агентов: ${metadata.total_agents}`);
            console.log(`- Первичных агентов: ${metadata.primary_agents}`);
            console.log(`- Вторичных агентов: ${metadata.secondary_agents}`);
            console.log(`- Успешных: ${metadata.successful_agents}`);
            console.log(`- Неуспешных: ${metadata.failed_agents}`);
            console.log(`- Завершено в: ${metadata.completed_at}`);
            
            // Детальный анализ каждого агента
            console.log('\n🔍 Детальные результаты агентов:');
            for (const [agentName, result] of Object.entries(results)) {
                if (result.error) {
                    console.log(`❌ ${agentName}: ОШИБКА - ${result.message}`);
                } else {
                    const responseLength = result.length || 0;
                    console.log(`✅ ${agentName}: УСПЕХ - ${responseLength} символов`);
                }
            }
            
            // Проверка эффективности улучшений
            console.log('\n📊 Оценка эффективности улучшений:');
            const successRate = (metadata.successful_agents / metadata.total_agents) * 100;
            
            if (successRate >= 90) {
                console.log(`🎉 ОТЛИЧНО! Успешность: ${successRate.toFixed(1)}%`);
            } else if (successRate >= 75) {
                console.log(`👍 ХОРОШО! Успешность: ${successRate.toFixed(1)}%`);
            } else {
                console.log(`⚠️ ТРЕБУЕТ УЛУЧШЕНИЙ! Успешность: ${successRate.toFixed(1)}%`);
            }
            
        } else {
            console.log(`❌ Анализ завершен с ошибкой: ${analysisResult.error.message}`);
        }
        
        // Финальная информация о Circuit Breaker
        console.log('\n🔒 Финальное состояние Circuit Breaker:');
        const finalInfo = multiAgentSystem.getAgentsInfo();
        console.log(`- Состояние: ${finalInfo.circuit_breaker.state}`);
        console.log(`- Количество ошибок: ${finalInfo.circuit_breaker.failure_count}`);
        if (finalInfo.circuit_breaker.last_failure_time) {
            const lastFailure = new Date(finalInfo.circuit_breaker.last_failure_time);
            console.log(`- Последняя ошибка: ${lastFailure.toLocaleString()}`);
        }
        
        // Рекомендации
        console.log('\n💡 Рекомендации по дальнейшему улучшению:');
        if (metadata.failed_agents > 0) {
            console.log('1. Увеличить паузы между проблемными агентами');
            console.log('2. Добавить более агрессивные retry стратегии');
            console.log('3. Рассмотреть разделение больших промптов на части');
        } else {
            console.log('1. Система работает стабильно');
            console.log('2. Можно попробовать уменьшить паузы для ускорения');
            console.log('3. Мониторить производительность в продакшн');
        }
        
    } catch (error) {
        console.error('\n❌ Критическая ошибка тестирования:');
        console.error(error.message);
        console.error(error.stack);
    }
}

// Запуск тестирования
if (require.main === module) {
    testImprovedAISystem().catch(console.error);
}

module.exports = { testImprovedAISystem };