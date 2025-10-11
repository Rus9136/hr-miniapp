const axios = require('axios');
require('dotenv').config();

// Тестируем реальный анализ с улучшенной системой
async function testRealAnalysis() {
    console.log('🧪 Тестирование реального AI-анализа с улучшениями\n');
    
    const analysisData = {
        "department_id": "82e76bf2-903b-4ed9-9491-b875a33089ae",
        "date_start": "2025-07-06", 
        "date_end": "2025-07-13",
        "reviews_count": 10
    };
    
    const API_BASE = process.env.API_BASE_URL || 'https://madlen.space/api';
    
    console.log('📋 Параметры анализа:');
    console.log(`   🏢 Department ID: ${analysisData.department_id}`);
    console.log(`   📅 Период: ${analysisData.date_start} — ${analysisData.date_end}`);
    console.log(`   ⭐ Количество отзывов: ${analysisData.reviews_count}`);
    
    console.log('\n🚀 Запуск анализа...');
    console.log('⏱️  Ожидаемое время: 2-3 минуты (с новыми паузами)');
    console.log('🔄 Retry логика: активна для ошибок 529/5xx');
    
    const startTime = Date.now();
    
    try {
        console.log('\n📡 Отправка запроса на анализ...');
        
        const response = await axios.post(
            `${API_BASE}/admin/ai-recommendations/analyze`,
            analysisData,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 300000 // 5 минут таймаут
            }
        );
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log(`\n✅ Анализ завершен за ${duration.toFixed(1)} секунд`);
        
        if (response.data.success) {
            const result = response.data.data;
            
            console.log('\n📊 Результаты анализа:');
            console.log(`   🆔 Analysis ID: ${result.analysis_id}`);
            console.log(`   🏢 Department: ${result.department_id}`);
            console.log(`   📅 Период: ${result.period.start} — ${result.period.end}`);
            
            console.log('\n🤖 Статус агентов:');
            let successCount = 0;
            let errorCount = 0;
            
            for (const [agentName, agentResult] of Object.entries(result.agent_results)) {
                if (agentResult && agentResult.error) {
                    console.log(`   ❌ ${agentName}: ОШИБКА - ${agentResult.message}`);
                    errorCount++;
                } else {
                    console.log(`   ✅ ${agentName}: Успешно (${typeof agentResult === 'string' ? agentResult.length + ' символов' : 'данные'})`);
                    successCount++;
                }
            }
            
            console.log(`\n📈 Итоговая статистика:`);
            console.log(`   ✅ Успешных агентов: ${successCount}/6`);
            console.log(`   ❌ Ошибок: ${errorCount}/6`);
            console.log(`   🎯 Успешность: ${(successCount/6*100).toFixed(1)}%`);
            
            // Сравнение с предыдущими результатами
            console.log(`\n🔍 Анализ улучшений:`);
            if (errorCount === 0) {
                console.log(`   🎉 Отлично! Все 6 агентов выполнены успешно`);
                console.log(`   ✅ Проблема 529 решена благодаря retry-логике`);
            } else if (errorCount < 2) {
                console.log(`   👍 Хорошо! Только ${errorCount} ошибка(и), было 2`);
                console.log(`   📈 Значительное улучшение стабильности`);
            } else {
                console.log(`   ⚠️  Все еще есть ${errorCount} ошибок, но система повторит попытки`);
                console.log(`   🔄 Можно использовать перезапуск агентов в админ-панели`);
            }
            
            console.log(`\n⏱️  Временные характеристики:`);
            console.log(`   📊 Время выполнения: ${duration.toFixed(1)} секунд`);
            console.log(`   🎯 Плановое время: 120-180 секунд`);
            console.log(`   📈 Соотношение: ${duration < 120 ? 'быстрее плана' : duration > 180 ? 'медленнее плана' : 'в пределах плана'}`);
            
            // Детали MCP данных
            if (result.mcp_data) {
                console.log(`\n📦 MCP API данные:`);
                console.log(`   📊 Forecast: ${result.mcp_data.forecast ? '✅' : '❌'}`);
                console.log(`   📈 Plan vs Fact: ${result.mcp_data.plan_vs_fact ? '✅' : '❌'}`);
                console.log(`   🕐 Hourly Sales: ${result.mcp_data.hourly_sales ? '✅' : '❌'}`);
                console.log(`   💰 Payroll: ${result.mcp_data.payroll ? '✅' : '❌'}`);
                console.log(`   ⭐ Reviews: ${result.mcp_data.reviews ? `✅ (${result.mcp_data.reviews.length || 0})` : '❌'}`);
            }
            
        } else {
            console.log(`❌ Ошибка анализа: ${response.data.error}`);
            if (response.data.details) {
                console.log(`   📋 Детали: ${response.data.details}`);
            }
        }
        
    } catch (error) {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log(`\n❌ Ошибка выполнения анализа за ${duration.toFixed(1)} секунд:`);
        
        if (error.response) {
            console.log(`   📡 HTTP Status: ${error.response.status}`);
            console.log(`   📋 Response: ${JSON.stringify(error.response.data, null, 2)}`);
            
            if (error.response.status === 504) {
                console.log(`\n⏳ Ошибка 504 (Gateway Timeout):`);
                console.log(`   🔄 Анализ может выполняться в фоновом режиме`);
                console.log(`   📋 Проверьте историю анализов через 2-3 минуты`);
                console.log(`   🎯 Новые паузы могут привести к превышению nginx timeout`);
            }
        } else if (error.code === 'ECONNABORTED') {
            console.log(`   ⏱️  Timeout: анализ занимает больше 5 минут`);
            console.log(`   🔄 Это нормально для улучшенной системы с паузами`);
        } else {
            console.log(`   📋 Ошибка: ${error.message}`);
        }
        
        console.log(`\n💡 Рекомендации:`);
        console.log(`   1. Проверьте историю анализов в админ-панели`);
        console.log(`   2. Возможно анализ выполняется в фоне`);
        console.log(`   3. При timeout - увеличьте nginx timeout или используйте асинхронный режим`);
    }
    
    console.log(`\n🏁 Тест завершен. Проверьте результаты в админ-панели:`);
    console.log(`   🌐 https://madlen.space/HR (admin12qw)`);
    console.log(`   📋 Раздел: AI-рекомендации → История анализов`);
}

testRealAnalysis().catch(console.error);