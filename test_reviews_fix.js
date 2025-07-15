#!/usr/bin/env node

const MCPClient = require('./backend/services/mcp-client');
const MultiAgentSystem = require('./backend/services/multi-agent-system');

async function testReviewsProcessing() {
    console.log('🧪 Тестирование обработки отзывов после исправления...\n');
    
    // Тестовые параметры
    const testParams = {
        department_id: '923819ab-f759-419e-af6a-019f0a822a3d', // Тот же department_id что в вашем тесте
        date_start: '2025-07-14',
        date_end: '2025-07-14',
        reviews_count: 50 // Запрашиваем 50 отзывов
    };
    
    console.log('📋 Параметры теста:', testParams);
    console.log('─'.repeat(50));
    
    try {
        // 1. Тест MCP API
        console.log('1️⃣ Тестирование MCP API...');
        const mcpClient = new MCPClient();
        const mcpResponse = await mcpClient.getDashboardData(
            testParams.department_id,
            testParams.date_start,
            testParams.date_end,
            testParams.reviews_count
        );
        
        if (!mcpResponse.success) {
            console.error('❌ MCP API вернул ошибку:', mcpResponse.error);
            return;
        }
        
        console.log('✅ MCP API успешно отвечает');
        
        // Проверяем секцию отзывов
        const reviewsData = mcpResponse.data.reviews;
        if (reviewsData) {
            if (reviewsData.data && Array.isArray(reviewsData.data)) {
                console.log(`📊 Получено отзывов из MCP: ${reviewsData.data.length}`);
                
                // Показываем первые 3 отзыва
                console.log('🔍 Первые 3 отзыва:');
                reviewsData.data.slice(0, 3).forEach((review, index) => {
                    console.log(`   ${index + 1}. Рейтинг: ${review.rating || 'N/A'}`);
                    console.log(`      Текст: "${(review.text || review.comment || '').substring(0, 100)}..."`);
                    console.log(`      Поля: ${Object.keys(review).join(', ')}`);
                    console.log('');
                });
            } else {
                console.log('⚠️ Отзывы не найдены или не являются массивом');
                console.log('📋 Структура reviews:', typeof reviewsData, Object.keys(reviewsData || {}));
            }
        } else {
            console.log('❌ Секция reviews отсутствует в ответе MCP');
        }
        
        console.log('─'.repeat(50));
        
        // 2. Тест сжатия данных
        console.log('2️⃣ Тестирование сжатия данных...');
        const multiAgent = new MultiAgentSystem();
        const compressedData = multiAgent.compressDataForTokens(mcpResponse.data);
        
        if (compressedData.reviews) {
            console.log(`📊 После сжатия отзывов: ${compressedData.reviews.length}`);
            
            // Показываем первые 3 сжатых отзыва
            console.log('🔍 Первые 3 сжатых отзыва:');
            compressedData.reviews.slice(0, 3).forEach((review, index) => {
                console.log(`   ${index + 1}. Рейтинг: ${review.rating}`);
                console.log(`      Текст: "${review.text}"`);
                console.log(`      Длина текста: ${review.text.length} символов`);
                console.log('');
            });
        } else {
            console.log('❌ Отзывы не найдены после сжатия');
        }
        
        console.log('─'.repeat(50));
        
        // 3. Тест формирования промпта для ReputationAgent
        console.log('3️⃣ Тестирование формирования промпта для ReputationAgent...');
        
        const reputationAgent = multiAgent.agents.ReputationAgent;
        const agentData = multiAgent.prepareAgentData(reputationAgent, compressedData, {});
        
        if (agentData.reviews) {
            console.log(`📊 Данные для ReputationAgent: ${agentData.reviews.length} отзывов`);
            
            // Формируем промпт
            const prompt = multiAgent.processPromptPlaceholders(reputationAgent.default_prompt, agentData);
            
            console.log('📝 Фрагмент промпта:');
            console.log(prompt.substring(0, 500) + '...');
            
            // Проверяем, есть ли текст в промпте
            const hasText = prompt.includes('"text":') && !prompt.includes('"text": ""');
            console.log(`✅ В промпте ${hasText ? 'ЕСТЬ' : 'НЕТ'} текст отзывов`);
            
            // Считаем количество отзывов в промпте
            const reviewsInPrompt = (prompt.match(/"rating":/g) || []).length;
            console.log(`📊 Количество отзывов в промпте: ${reviewsInPrompt}`);
            
        } else {
            console.log('❌ Данные отзывов не переданы в агент');
        }
        
        console.log('─'.repeat(50));
        console.log('🎯 Тестирование завершено!');
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Запуск теста
testReviewsProcessing().then(() => {
    console.log('\n✅ Тест завершен');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
});