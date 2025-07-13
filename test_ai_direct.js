const axios = require('axios');

async function testDirectAI() {
    console.log('🚀 Прямое тестирование AI системы...\n');

    const API_BASE = 'https://madlen.space/api';
    
    try {
        // Тест с конкретным подразделением, который точно есть в базе
        const analysisData = {
            department_id: '4cb558ca-a8bc-4b81-871e-043f65218c50', // 11мкр/MG
            date_start: '2025-07-10',
            date_end: '2025-07-12',
            reviews_count: 20
        };
        
        console.log('📊 Отправка запроса на AI анализ:', analysisData);
        console.log('⏳ Ожидание результата (может занять до 2 минут)...\n');
        
        const startTime = Date.now();
        
        const analysisResponse = await axios.post(
            `${API_BASE}/admin/ai-recommendations/analyze`,
            analysisData,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000 // 2 минуты
            }
        );
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log(`⏱️ Анализ завершен за ${duration} секунд`);
        
        if (analysisResponse.data.success) {
            console.log('✅ AI анализ выполнен успешно!');
            console.log('📊 ID анализа:', analysisResponse.data.data.analysis_id);
            console.log('🏢 Подразделение:', analysisResponse.data.data.department_id);
            console.log('📅 Период:', analysisResponse.data.data.period.start, '-', analysisResponse.data.data.period.end);
            console.log('🤖 Количество агентов:', Object.keys(analysisResponse.data.data.agent_results).length);
            
            // Показать результаты агентов
            console.log('\n📋 Результаты агентов:');
            Object.entries(analysisResponse.data.data.agent_results).forEach(([agent, result]) => {
                const status = result.error ? '❌ Ошибка' : '✅ Успех';
                const preview = result.error ? result.message : result.substring(0, 150) + '...';
                console.log(`\n🤖 ${agent}: ${status}`);
                console.log(`   ${preview}`);
            });
            
            // Тест получения конкретного анализа
            console.log('\n\n📖 Тестирование получения анализа по ID...');
            const getAnalysisResponse = await axios.get(
                `${API_BASE}/admin/ai-recommendations/${analysisResponse.data.data.analysis_id}`
            );
            
            if (getAnalysisResponse.data.success) {
                console.log('✅ Анализ успешно получен по ID');
            } else {
                console.log('❌ Ошибка получения анализа:', getAnalysisResponse.data.error);
            }
            
        } else {
            console.log('❌ Ошибка AI анализа:', analysisResponse.data.error);
        }
        
    } catch (error) {
        console.error('💥 Ошибка тестирования:', error.message);
        
        if (error.response) {
            console.error('📄 Статус:', error.response.status);
            console.error('📄 Данные:', error.response.data);
        }
        
        if (error.code === 'ECONNABORTED') {
            console.error('⏰ Превышен таймаут - анализ может занимать больше времени');
        }
    }
}

// Запуск тестирования
testDirectAI();