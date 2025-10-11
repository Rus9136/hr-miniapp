#!/usr/bin/env node

/**
 * 🧪 Тест оптимизированной AI системы
 */

const MultiAgentSystem = require('./backend/services/multi-agent-system');

async function testOptimizedSystem() {
    console.log('🧪 ТЕСТ ОПТИМИЗИРОВАННОЙ AI СИСТЕМЫ');
    console.log('=' * 40);
    
    const testData = {
        forecast: Array.from({length: 7}, (_, i) => ({
            date: `2025-07-${14+i}`,
            plan: 800000 + Math.random() * 200000,
            fact: 750000 + Math.random() * 300000
        })),
        payroll: Array.from({length: 10}, (_, i) => ({
            employee_name: `Сотрудник ${i+1}`,
            shifts: 20 + Math.random() * 10,
            total_payroll: 200000 + Math.random() * 150000
        })),
        hourly_sales: Array.from({length: 24}, (_, hour) => ({
            hour: hour,
            weekday_avg: 20000 + Math.random() * 40000,
            weekend_avg: 25000 + Math.random() * 35000
        })),
        reviews: Array.from({length: 15}, (_, i) => ({
            rating: 3 + Math.random() * 2,
            comment: `Отзыв ${i+1}: Общее впечатление от заведения`
        }))
    };
    
    const multiAgent = new MultiAgentSystem();
    
    try {
        console.log('🚀 Запуск быстрого режима (2 агента)...');
        const startTime = Date.now();
        
        const result = await multiAgent.runFastAnalysis(testData);
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log(`\n📊 РЕЗУЛЬТАТЫ (время: ${duration}с):`);
        console.log(`✅ Успешных: ${result.metadata.successful_agents}`);
        console.log(`❌ Ошибок: ${result.metadata.failed_agents}`);
        
        if (result.metadata.failed_agents === 0) {
            console.log('\n🎉 ОПТИМИЗАЦИЯ УСПЕШНА!');
            console.log('💡 Можно запускать полный анализ');
        } else {
            console.log('\n⚠️  Нужны дополнительные оптимизации');
        }
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error.message);
    }
}

if (require.main === module) {
    testOptimizedSystem().catch(console.error);
}