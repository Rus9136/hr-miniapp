#!/usr/bin/env node

/**
 * 🔑 Тестирование системы с множественными API ключами
 * 
 * Этот скрипт проверяет:
 * - Правильность загрузки всех API ключей
 * - Маппинг агентов к соответствующим ключам
 * - Изоляцию лимитов между ключами
 * - Работу полного анализа с 3 разными ключами
 */

require('dotenv').config({ path: '.env.production' });

const MultiAgentSystem = require('./backend/services/multi-agent-system');
const AnthropicClient = require('./backend/services/anthropic-client');

async function testMultipleApiKeys() {
    console.log('🔑 ТЕСТИРОВАНИЕ СИСТЕМЫ С МНОЖЕСТВЕННЫМИ API КЛЮЧАМИ');
    console.log('=' * 50);
    
    // 1. Проверка загрузки ключей из environment
    console.log('\n1️⃣ Проверка загрузки API ключей:');
    
    const keys = {
        default: process.env.ANTHROPIC_API_KEY,
        staffing: process.env.ANTHROPIC_API_KEY_STAFFING,
        payroll: process.env.ANTHROPIC_API_KEY_PAYROLL
    };
    
    for (const [name, key] of Object.entries(keys)) {
        if (key) {
            const preview = key.substring(0, 20) + '...' + key.substring(key.length - 10);
            console.log(`   ✅ ${name.toUpperCase()}: ${preview}`);
        } else {
            console.log(`   ❌ ${name.toUpperCase()}: НЕ НАЙДЕН!`);
        }
    }
    
    // 2. Проверка создания клиентов
    console.log('\n2️⃣ Проверка создания API клиентов:');
    
    try {
        const defaultClient = new AnthropicClient();
        console.log('   ✅ Default клиент создан');
        
        const staffingClient = new AnthropicClient(keys.staffing);
        console.log('   ✅ Staffing клиент создан');
        
        const payrollClient = new AnthropicClient(keys.payroll);
        console.log('   ✅ Payroll клиент создан');
        
    } catch (error) {
        console.error('   ❌ Ошибка создания клиентов:', error.message);
        return;
    }
    
    // 3. Проверка маппинга в MultiAgentSystem
    console.log('\n3️⃣ Проверка маппинга агентов к ключам:');
    
    const multiAgent = new MultiAgentSystem();
    
    const agentMapping = [
        { agent: 'SalesAnalysisAgent', expectedKey: 'default' },
        { agent: 'PayrollAnalysisAgent', expectedKey: 'PayrollAnalysisAgent' },
        { agent: 'StaffingAgent', expectedKey: 'StaffingAgent' },
        { agent: 'ReputationAgent', expectedKey: 'default' },
        { agent: 'OptimizationAgent', expectedKey: 'default' },
        { agent: 'NarrativeAgent', expectedKey: 'default' }
    ];
    
    for (const { agent, expectedKey } of agentMapping) {
        const hasSpecialKey = multiAgent.apiClients[agent] ? true : false;
        const actualKey = hasSpecialKey ? agent : 'default';
        
        if (actualKey === expectedKey || (expectedKey === 'default' && !hasSpecialKey)) {
            console.log(`   ✅ ${agent}: использует ${actualKey} ключ`);
        } else {
            console.log(`   ❌ ${agent}: ожидался ${expectedKey}, но использует ${actualKey}`);
        }
    }
    
    // 4. Тест изоляции лимитов
    console.log('\n4️⃣ Тест изоляции лимитов (параллельные запросы):');
    
    const testPromises = [];
    const testAgents = ['SalesAnalysisAgent', 'PayrollAnalysisAgent', 'StaffingAgent'];
    
    // Минимальные тестовые данные
    const testData = {
        forecast: [{ date: '2025-07-14', plan: 800000, fact: 850000 }],
        payroll: [{ employee_name: 'Тест', shifts: 20, total_payroll: 250000 }],
        hourly_sales: [{ hour: 12, weekday_avg: 50000, weekend_avg: 60000 }],
        reviews: [{ rating: 5, comment: 'Отлично' }]
    };
    
    console.log('   🚀 Запуск 3 агентов параллельно с разными ключами...');
    
    const startTime = Date.now();
    
    for (const agentName of testAgents) {
        testPromises.push(
            multiAgent.runSingleAgent(agentName, testData).then(result => ({
                agentName,
                success: result.success,
                error: result.error
            }))
        );
    }
    
    try {
        const results = await Promise.all(testPromises);
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log(`\n   ⏱️  Время выполнения: ${duration}с`);
        
        for (const result of results) {
            if (result.success) {
                console.log(`   ✅ ${result.agentName}: УСПЕШНО`);
            } else {
                console.log(`   ❌ ${result.agentName}: ОШИБКА - ${result.error?.message || 'Unknown'}`);
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        
        if (successCount === 3) {
            console.log('\n   🎉 ОТЛИЧНО! Все агенты выполнены параллельно без ошибок 529!');
            console.log('   💡 Множественные ключи полностью решают проблему лимитов!');
        } else if (successCount >= 2) {
            console.log('\n   ⚠️  Частичный успех. Возможно нужна дополнительная настройка.');
        } else {
            console.log('\n   ❌ Проблемы остаются. Проверьте ключи и лимиты.');
        }
        
    } catch (error) {
        console.error('   ❌ Ошибка параллельного теста:', error.message);
    }
    
    // 5. Рекомендации
    console.log('\n5️⃣ РЕКОМЕНДАЦИИ:');
    
    console.log('\n📋 Распределение агентов по ключам:');
    console.log('   • Ключ 1 (основной): Sales, Reputation, Optimization, Narrative');
    console.log('   • Ключ 2 (PAYROLL): PayrollAnalysisAgent');
    console.log('   • Ключ 3 (STAFFING): StaffingAgent');
    
    console.log('\n⚡ Преимущества текущей конфигурации:');
    console.log('   • Каждый ключ имеет полный лимит 4,000 OTPM');
    console.log('   • Проблемные агенты изолированы на отдельных ключах');
    console.log('   • Основной ключ обслуживает 4 легких агента');
    console.log('   • Возможность параллельного выполнения без конкуренции');
    
    console.log('\n🚀 Следующие шаги:');
    console.log('   1. Протестировать полный анализ через админ-панель');
    console.log('   2. Уменьшить паузы между агентами (можно до 30-60с)');
    console.log('   3. Включить параллельное выполнение первых 4 агентов');
    console.log('   4. Мониторить использование каждого ключа отдельно');
}

// Запуск тестирования
if (require.main === module) {
    testMultipleApiKeys().catch(console.error);
}

module.exports = { testMultipleApiKeys };