const axios = require('axios');

console.log('🧪 Тестирование API для получения логов промптов\n');

async function testPromptLogsAPI() {
    try {
        // Проверяем последний анализ
        const historyResponse = await axios.get('http://localhost:3030/api/admin/ai-recommendations/history?limit=1');
        const lastAnalysis = historyResponse.data.data[0];
        
        if (!lastAnalysis) {
            console.log('❌ Анализы не найдены');
            return;
        }
        
        console.log(`📋 Последний анализ: ID ${lastAnalysis.id}, дата: ${lastAnalysis.created_at}`);
        
        // Получаем логи промптов для последнего анализа
        const promptsResponse = await axios.get(`http://localhost:3030/api/admin/ai-recommendations/prompts/${lastAnalysis.id}`);
        const { analysis, prompts } = promptsResponse.data.data;
        
        console.log(`\n📊 Анализ ${analysis.id}:`);
        console.log(`📅 Период: ${analysis.date_start} - ${analysis.date_end}`);
        console.log(`🤖 Провайдер: ${analysis.provider}`);
        console.log(`📝 Количество промптов: ${prompts.length}`);
        
        prompts.forEach((prompt, index) => {
            console.log(`\n🔍 Промпт ${index + 1}:`);
            console.log(`   👤 Агент: ${prompt.agent_name}`);
            console.log(`   🤖 Провайдер: ${prompt.provider}`);
            console.log(`   📏 Длина промпта: ${prompt.prompt_length.toLocaleString()} символов`);
            console.log(`   💬 Длина ответа: ${prompt.response_length.toLocaleString()} символов`);
            console.log(`   🎯 Токены: ${prompt.tokens_used?.toLocaleString() || 'N/A'}`);
            console.log(`   ✅ Успех: ${prompt.success ? 'Да' : 'Нет'}`);
            console.log(`   ⏱️  Время ответа: ${prompt.response_time_seconds ? Number(prompt.response_time_seconds).toFixed(2) : 'N/A'} секунд`);
            
            // Проверяем наличие плейсхолдеров
            const hasPlaceholders = prompt.full_prompt.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
            console.log(`   🔄 Плейсхолдеры: ${hasPlaceholders ? '❌ Найдены: ' + hasPlaceholders.join(', ') : '✅ Все заменены'}`);
            
            // Проверяем обработку отсутствующих данных
            const hasMissingData = prompt.full_prompt.includes('отсутствуют в MCP API');
            console.log(`   📋 Отсутствующие данные: ${hasMissingData ? '⚠️ Есть' : '✅ Все данные присутствуют'}`);
        });
        
        // Проверяем наличие реальных данных
        console.log('\n🔍 Проверка содержимого данных:');
        prompts.forEach((prompt, index) => {
            const hasRealData = prompt.full_prompt.includes('employee_name') || 
                              prompt.full_prompt.includes('payroll_for_shift') || 
                              prompt.full_prompt.includes('date') ||
                              prompt.full_prompt.includes('plan') ||
                              prompt.full_prompt.includes('fact');
            
            console.log(`   ${index + 1}. ${prompt.agent_name}: ${hasRealData ? '✅ Реальные данные' : '❌ Нет реальных данных'}`);
        });
        
        console.log('\n🎉 Тест API завершен!');
        
    } catch (error) {
        console.error('❌ Ошибка тестирования API:', error.message);
        if (error.response) {
            console.error('📋 Детали ответа:', error.response.data);
        }
    }
}

testPromptLogsAPI();