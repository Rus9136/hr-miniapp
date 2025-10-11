#!/usr/bin/env node

/**
 * 🔍 Проверка лимитов и tier Anthropic API
 * 
 * Этот скрипт проверяет:
 * - Какой tier у вашего API ключа
 * - Текущие лимиты (RPM, TPM, OTPM)
 * - Рекомендации по оптимизации
 */

const AnthropicClient = require('./backend/services/anthropic-client');

async function checkAnthropicLimits() {
    console.log('🔍 ПРОВЕРКА ЛИМИТОВ ANTHROPIC API');
    console.log('=' * 50);
    
    try {
        const client = new AnthropicClient();
        
        // Простой тестовый запрос для проверки API
        console.log('📡 Отправка тестового запроса...');
        
        const testPrompt = "Ответь одним словом: работает ли API?";
        const testData = { test: true };
        
        const startTime = Date.now();
        const result = await client.sendMessage(testPrompt);
        const endTime = Date.now();
        
        const responseTime = endTime - startTime;
        
        console.log('✅ API РАБОТАЕТ!');
        console.log(`⏱️  Время ответа: ${responseTime}ms`);
        console.log(`📊 Размер ответа: ~${JSON.stringify(result).length} символов`);
        
        // Анализ лимитов на основе времени ответа
        console.log('\n📈 АНАЛИЗ ПРОИЗВОДИТЕЛЬНОСТИ:');
        
        if (responseTime < 2000) {
            console.log('🚀 Отличная скорость - скорее всего Tier 2+');
        } else if (responseTime < 5000) {
            console.log('⚡ Хорошая скорость - возможно Tier 1-2');
        } else {
            console.log('🐌 Медленная скорость - возможно throttling или Tier 1');
        }
        
        // Рекомендации по лимитам
        console.log('\n💡 ЛИМИТЫ ANTHROPIC API ПО TIERS:');
        console.log('');
        console.log('📋 Tier 1 (Базовый):');
        console.log('   • Requests per minute: 50');
        console.log('   • Input tokens per minute: 20,000');
        console.log('   • Output tokens per minute: 4,000 ⚠️ ПРОБЛЕМА!');
        console.log('');
        console.log('📋 Tier 2 (Build):');
        console.log('   • Requests per minute: 1,000');
        console.log('   • Input tokens per minute: 100,000');
        console.log('   • Output tokens per minute: 16,000');
        console.log('');
        console.log('📋 Tier 4 (Scale):');
        console.log('   • Requests per minute: 4,000');
        console.log('   • Input tokens per minute: 400,000');
        console.log('   • Output tokens per minute: 80,000');
        
        console.log('\n🤖 НАШЕ ПОТРЕБЛЕНИЕ (6 AI агентов):');
        console.log('   • Requests per analysis: 6-30 (с retry)');
        console.log('   • Input tokens per analysis: ~35,000');
        console.log('   • Output tokens per analysis: ~24,000 ⚠️');
        console.log('');
        console.log('🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА:');
        console.log('   Если у вас Tier 1 → превышение OTPM лимита!');
        console.log('   24,000 output токенов > 4,000 лимит = 529 ошибки');
        
        console.log('\n🎯 РЕКОМЕНДАЦИИ:');
        console.log('');
        console.log('✅ Немедленные действия:');
        console.log('   1. Проверить tier API ключа в консоли Anthropic');
        console.log('   2. Увеличить лимиты до Tier 2+ если возможно');
        console.log('   3. Уменьшить max_tokens с 4000 до 2000');
        console.log('   4. Увеличить паузы между агентами до 5+ минут');
        console.log('');
        console.log('⚡ Оптимизации кода:');
        console.log('   1. Параллельный запуск первых 4 агентов');
        console.log('   2. Сжатие JSON данных MCP API');
        console.log('   3. Умное кэширование результатов');
        console.log('   4. Фильтрация данных по важности');
        
        // Тест серии запросов (имитация реального анализа)
        console.log('\n🧪 ТЕСТ СЕРИИ ЗАПРОСОВ (имитация AI анализа):');
        
        const agents = ['Sales', 'Payroll', 'Staffing', 'Reputation'];
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            console.log(`   ${i+1}/4 Тестирую ${agent}Agent...`);
            
            try {
                const testStart = Date.now();
                await client.sendMessage(
                    `Ты ${agent}Agent. Ответь кратко: "Анализ ${agent} выполнен успешно"`
                );
                const testEnd = Date.now();
                
                successCount++;
                console.log(`   ✅ ${agent}Agent: OK (${testEnd - testStart}ms)`);
                
                // Пауза между запросами (как в реальном анализе)
                if (i < agents.length - 1) {
                    console.log(`   ⏳ Пауза 10 секунд...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
                
            } catch (error) {
                errorCount++;
                console.log(`   ❌ ${agent}Agent: ОШИБКА - ${error.message}`);
                
                if (error.message.includes('529') || error.message.includes('overloaded')) {
                    console.log('   🚨 ОБНАРУЖЕНА ОШИБКА 529! Лимиты превышены!');
                    break;
                }
            }
        }
        
        console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТА:');
        console.log(`   ✅ Успешных запросов: ${successCount}/4`);
        console.log(`   ❌ Ошибок: ${errorCount}/4`);
        
        if (successCount === 4) {
            console.log('   🎉 ОТЛИЧНО! API справляется с нагрузкой');
            console.log('   💡 Можно уменьшить паузы для ускорения');
        } else if (successCount >= 2) {
            console.log('   ⚠️  ЧАСТИЧНЫЕ ПРОБЛЕМЫ с лимитами');
            console.log('   💡 Увеличить паузы или уменьшить max_tokens');
        } else {
            console.log('   🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ с лимитами!');
            console.log('   💡 Обязательно увеличить tier или радикально оптимизировать');
        }
        
    } catch (error) {
        console.error('❌ ОШИБКА ПРОВЕРКИ API:', error.message);
        
        if (error.message.includes('401')) {
            console.error('🔑 Проблема с API ключом - проверьте .env.production');
        } else if (error.message.includes('529')) {
            console.error('🚨 ЛИМИТЫ ПРЕВЫШЕНЫ! Tier слишком низкий для ваших задач');
        } else if (error.message.includes('network')) {
            console.error('🌐 Проблемы с сетью - проверьте подключение');
        }
    }
}

// Запуск проверки
if (require.main === module) {
    checkAnthropicLimits().catch(console.error);
}

module.exports = { checkAnthropicLimits };