const axios = require('axios');

async function testFullAISystem() {
    console.log('🚀 Тестирование полной AI системы...\n');

    const API_BASE = 'https://madlen.space/api';
    
    try {
        // 1. Тест получения подразделений
        console.log('1️⃣ Тестирование получения подразделений...');
        const deptsResponse = await axios.get(`${API_BASE}/admin/departments`);
        
        if (deptsResponse.data.success && deptsResponse.data.data.length > 0) {
            console.log('✅ Подразделения получены:', deptsResponse.data.data.length);
            
            // Найдем подразделение с id_iiko
            const deptWithIiko = deptsResponse.data.data.find(dept => dept.id_iiko);
            
            if (deptWithIiko) {
                console.log('✅ Найдено подразделение с id_iiko:', deptWithIiko.object_name);
                
                // 2. Тест запуска AI анализа
                console.log('\n2️⃣ Тестирование AI анализа...');
                
                const analysisData = {
                    department_id: deptWithIiko.id_iiko,
                    date_start: '2025-07-10',
                    date_end: '2025-07-12',
                    reviews_count: 20
                };
                
                console.log('📊 Отправка запроса на анализ:', analysisData);
                
                const analysisResponse = await axios.post(
                    `${API_BASE}/admin/ai-recommendations/analyze`,
                    analysisData,
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 120000 // 2 минуты
                    }
                );
                
                if (analysisResponse.data.success) {
                    console.log('✅ AI анализ выполнен успешно!');
                    console.log('📊 ID анализа:', analysisResponse.data.data.analysis_id);
                    console.log('🤖 Количество агентов:', Object.keys(analysisResponse.data.data.agent_results).length);
                    
                    // Показать результаты агентов
                    console.log('\n📋 Результаты агентов:');
                    Object.entries(analysisResponse.data.data.agent_results).forEach(([agent, result]) => {
                        const status = result.error ? '❌ Ошибка' : '✅ Успех';
                        const preview = result.error ? result.message : result.substring(0, 100) + '...';
                        console.log(`  ${agent}: ${status}`);
                        console.log(`    ${preview}`);
                    });
                    
                    // 3. Тест получения истории
                    console.log('\n3️⃣ Тестирование истории анализов...');
                    const historyResponse = await axios.get(`${API_BASE}/admin/ai-recommendations/history`);
                    
                    if (historyResponse.data.success) {
                        console.log('✅ История получена:', historyResponse.data.data.length, 'записей');
                    } else {
                        console.log('⚠️ Проблема с историей:', historyResponse.data.error);
                    }
                    
                    // 4. Тест получения промптов
                    console.log('\n4️⃣ Тестирование промптов...');
                    const promptsResponse = await axios.get(`${API_BASE}/admin/ai-recommendations/prompts`);
                    
                    if (promptsResponse.data.success) {
                        console.log('✅ Промпты получены для', promptsResponse.data.data.length, 'агентов');
                    } else {
                        console.log('⚠️ Проблема с промптами:', promptsResponse.data.error);
                    }
                    
                } else {
                    console.log('❌ Ошибка AI анализа:', analysisResponse.data.error);
                }
                
            } else {
                console.log('⚠️ Не найдено подразделение с id_iiko');
            }
            
        } else {
            console.log('❌ Ошибка получения подразделений');
        }
        
        console.log('\n🎉 Тестирование завершено!');
        
    } catch (error) {
        console.error('💥 Критическая ошибка тестирования:', error.message);
        
        if (error.response) {
            console.error('📄 Ответ сервера:', error.response.status, error.response.data);
        }
    }
}

// Запуск тестирования
testFullAISystem();