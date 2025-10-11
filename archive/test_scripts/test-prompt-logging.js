const axios = require('axios');

console.log('🧪 Тестирование логирования промптов AI системы\n');

async function testPromptLogging() {
    try {
        console.log('📋 Запускаем анализ для тестирования логирования...');
        
        // Запускаем анализ с OpenAI
        const analysisResponse = await axios.post('http://localhost:3030/api/admin/ai-recommendations/analyze', {
            department_id: '923819ab-f759-419e-af6a-019f0a822a3d',
            date_start: '2025-07-15',
            date_end: '2025-07-31',
            reviews_count: 10,
            provider: 'openai'
        });

        const analysisId = analysisResponse.data.data.analysis_id;
        console.log(`✅ Анализ запущен с ID: ${analysisId}`);
        
        // Ждем завершения анализа
        console.log('⏳ Ожидание завершения анализа...');
        await new Promise(resolve => setTimeout(resolve, 120000)); // 2 минуты
        
        // Проверяем залогированные промпты
        console.log('🔍 Проверяем залогированные промпты...');
        const promptsResponse = await axios.get(`http://localhost:3030/api/admin/ai-recommendations/prompts/${analysisId}`);
        
        const { analysis, prompts } = promptsResponse.data.data;
        
        console.log(`\n📊 Результаты логирования для анализа ${analysisId}:`);
        console.log(`📅 Анализ: ${analysis.date_start} - ${analysis.date_end}`);
        console.log(`🤖 Провайдер: ${analysis.provider}`);
        console.log(`📝 Количество залогированных промптов: ${prompts.length}`);
        
        prompts.forEach((prompt, index) => {
            console.log(`\n🔍 Промпт ${index + 1}:`);
            console.log(`   👤 Агент: ${prompt.agent_name}`);
            console.log(`   🤖 Провайдер: ${prompt.provider}`);
            console.log(`   📏 Длина промпта: ${prompt.prompt_length} символов`);
            console.log(`   💬 Длина ответа: ${prompt.response_length} символов`);
            console.log(`   🎯 Токены: ${prompt.tokens_used}`);
            console.log(`   ⏱️  Время ответа: ${prompt.response_time_seconds?.toFixed(2) || 'N/A'} секунд`);
            console.log(`   ✅ Успех: ${prompt.success}`);
            
            // Показываем начало промпта
            if (prompt.full_prompt) {
                const promptPreview = prompt.full_prompt.substring(0, 200);
                console.log(`   📋 Начало промпта: ${promptPreview}...`);
            }
            
            // Показываем начало ответа
            if (prompt.response_text) {
                const responsePreview = prompt.response_text.substring(0, 200);
                console.log(`   💭 Начало ответа: ${responsePreview}...`);
            }
        });
        
        // Проверяем, что в промптах есть реальные данные, а не плейсхолдеры
        console.log('\n🔍 Проверка замены плейсхолдеров:');
        const promptsWithPlaceholders = prompts.filter(p => 
            p.full_prompt && p.full_prompt.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g)
        );
        
        if (promptsWithPlaceholders.length > 0) {
            console.log('❌ Найдены промпты с незамененными плейсхолдерами:');
            promptsWithPlaceholders.forEach(p => {
                const placeholders = p.full_prompt.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
                console.log(`   - ${p.agent_name}: ${placeholders.join(', ')}`);
            });
        } else {
            console.log('✅ Все плейсхолдеры заменены корректно!');
        }
        
        // Проверяем наличие данных в промптах
        console.log('\n📊 Проверка наличия данных в промптах:');
        const promptsWithData = prompts.filter(p => 
            p.full_prompt && (
                p.full_prompt.includes('forecast') || 
                p.full_prompt.includes('payroll') || 
                p.full_prompt.includes('reviews')
            )
        );
        
        console.log(`✅ Промпты с данными: ${promptsWithData.length}/${prompts.length}`);
        
        console.log('\n🎉 Тест логирования завершен!');
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error.message);
        if (error.response) {
            console.error('📋 Детали ответа:', error.response.data);
        }
    }
}

testPromptLogging();