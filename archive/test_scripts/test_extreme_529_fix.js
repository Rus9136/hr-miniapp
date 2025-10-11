#!/usr/bin/env node

/**
 * 🚨 Тестирование экстремальных улучшений против ошибок 529
 * 
 * Этот скрипт запускает полный AI анализ с новыми настройками:
 * - Удвоенные задержки retry: 30s-600s
 * - Увеличенные паузы между агентами: 45s-120s
 * - Экспоненциальное увеличение при накоплении ошибок
 * - Максимальные паузы до 20 минут для критических случаев
 */

const AnthropicClient = require('./backend/services/anthropic-client');
const MultiAgentSystem = require('./backend/services/multi-agent-system');

async function testExtremeFixFor529() {
    console.log('🚨 ТЕСТИРОВАНИЕ ЭКСТРЕМАЛЬНЫХ УЛУЧШЕНИЙ ПРОТИВ ОШИБОК 529');
    console.log('=' * 60);
    
    // Тестовые данные для анализа
    const testMcpData = {
        forecast: [
            { date: '2025-07-14', plan: 850000, fact: 920000 },
            { date: '2025-07-15', plan: 800000, fact: 750000 }
        ],
        payroll: [
            { employee_name: 'Тест Сотрудник', shifts: 5, total_payroll: 250000 }
        ],
        hourly_sales: [
            { hour: 12, weekday_avg: 45000, weekend_avg: 52000 },
            { hour: 13, weekday_avg: 55000, weekend_avg: 48000 }
        ],
        reviews: [
            { rating: 4, comment: 'Хороший сервис, но кофе мог быть лучше' },
            { rating: 5, comment: 'Отличная выпечка!' }
        ]
    };

    try {
        console.log('📊 Новые настройки задержек:');
        console.log('   • Retry для 529: 30s → 90s → 180s → 360s → 600s');
        console.log('   • Паузы между агентами: 45s-120s');
        console.log('   • Прогрессивное увеличение при накоплении ошибок');
        console.log('   • Максимальные паузы до 20 минут\n');

        const startTime = Date.now();
        const multiAgent = new MultiAgentSystem();
        
        console.log('🎯 Запуск полного анализа с экстремальными улучшениями...\n');
        
        const result = await multiAgent.runFullAnalysis(testMcpData);
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log('\n' + '=' * 60);
        console.log('📈 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
        console.log('=' * 60);
        
        if (result.success) {
            console.log('✅ АНАЛИЗ ЗАВЕРШЕН УСПЕШНО!');
            console.log(`⏱️  Время выполнения: ${duration} секунд (${Math.round(duration/60)} минут)`);
            console.log(`📊 Всего агентов: ${result.metadata.total_agents}`);
            console.log(`✅ Успешных агентов: ${result.metadata.successful_agents}`);
            console.log(`❌ Проваленных агентов: ${result.metadata.failed_agents}`);
            
            if (result.metadata.failed_agents === 0) {
                console.log('\n🎉 ПОЛНЫЙ УСПЕХ! Все агенты выполнены без ошибок 529!');
                console.log('💡 Экстремальные улучшения РАБОТАЮТ!');
            } else {
                console.log('\n⚠️  Есть проваленные агенты. Анализируем...');
                
                Object.keys(result.results).forEach(agentName => {
                    const agentResult = result.results[agentName];
                    if (agentResult.error) {
                        console.log(`❌ ${agentName}: ${agentResult.message}`);
                    } else {
                        console.log(`✅ ${agentName}: Успешно`);
                    }
                });
            }
        } else {
            console.log('❌ АНАЛИЗ ПРОВАЛЕН');
            console.log(`🔥 Ошибка: ${result.error.message}`);
            console.log('\n💡 Нужны еще более экстремальные настройки!');
        }

        console.log('\n📋 РЕКОМЕНДАЦИИ:');
        if (result.success && result.metadata.failed_agents === 0) {
            console.log('✅ Текущие настройки ОПТИМАЛЬНЫ!');
            console.log('✅ Можно постепенно уменьшать паузы для ускорения');
        } else if (result.success && result.metadata.failed_agents < 2) {
            console.log('⚠️  Настройки почти идеальны, небольшие корректировки');
            console.log('💡 Рассмотрить увеличение пауз для проблемных агентов');
        } else {
            console.log('🚨 Нужны еще более агрессивные настройки!');
            console.log('💡 Рассмотрить: увеличение задержек в 1.5 раза');
            console.log('💡 Альтернатива: временное отключение проблемных агентов');
        }

    } catch (error) {
        console.error('💥 КРИТИЧЕСКАЯ ОШИБКА ТЕСТИРОВАНИЯ:', error.message);
        console.error('🔧 Проверьте конфигурацию API и переменные окружения');
    }
}

// Функция для анализа производительности
function analyzePerformance(duration, failedCount) {
    console.log('\n📊 АНАЛИЗ ПРОИЗВОДИТЕЛЬНОСТИ:');
    
    if (duration < 300) { // < 5 минут
        console.log('⚡ Быстрое выполнение (отлично!)');
    } else if (duration < 900) { // < 15 минут  
        console.log('⏰ Среднее время выполнения (приемлемо)');
    } else {
        console.log('🐌 Медленное выполнение (нужна оптимизация)');
    }
    
    if (failedCount === 0) {
        console.log('🎯 100% надежность (идеально!)');
    } else if (failedCount <= 1) {
        console.log('✅ Высокая надежность (хорошо)');
    } else {
        console.log('⚠️  Низкая надежность (требует доработки)');
    }
}

// Запуск тестирования
if (require.main === module) {
    testExtremeFixFor529().catch(console.error);
}

module.exports = { testExtremeFixFor529 };