#!/usr/bin/env node

const MultiAgentSystem = require('./backend/services/multi-agent-system');

async function checkAIStatus() {
    console.log('📊 Быстрая проверка состояния AI системы');
    console.log('='.repeat(50));
    
    const multiAgentSystem = new MultiAgentSystem();
    const agentsInfo = multiAgentSystem.getAgentsInfo();
    
    console.log(`✅ Всего агентов: ${agentsInfo.total_agents}`);
    console.log(`🔒 Circuit breaker: ${agentsInfo.circuit_breaker.state}`);
    console.log(`❌ Ошибок 529: ${agentsInfo.circuit_breaker.failure_count}`);
    
    if (agentsInfo.circuit_breaker.last_failure_time) {
        const lastFailure = new Date(agentsInfo.circuit_breaker.last_failure_time);
        console.log(`⏰ Последняя ошибка: ${lastFailure.toLocaleString()}`);
    } else {
        console.log('✅ Ошибок 529 не зафиксировано');
    }
    
    console.log('\n🛡️ Улучшения защиты от ошибок 529:');
    console.log('1. ✅ Агрессивные задержки retry: 15s, 45s, 90s, 180s, 300s');
    console.log('2. ✅ Адаптивные паузы между агентами: 10s-25s');
    console.log('3. ✅ Специальные настройки для проблемных агентов: 7 попыток');
    console.log('4. ✅ Circuit breaker: защита от 3+ ошибок подряд');
    console.log('5. ✅ Дополнительные паузы при обнаружении ошибок 529');
}

checkAIStatus().catch(console.error);