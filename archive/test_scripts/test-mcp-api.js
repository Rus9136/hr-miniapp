/**
 * 🔍 Тест реального MCP API
 * Проверка какие данные приходят от MCP API
 */

const MCPClient = require('./backend/services/mcp-client');

async function testMCPAPI() {
    console.log('🔍 ТЕСТ РЕАЛЬНОГО MCP API');
    console.log('=' .repeat(50));
    
    try {
        const mcpClient = new MCPClient();
        
        // Используем реальный department_id из последнего анализа
        const departmentId = '923819ab-f759-419e-af6a-019f0a822a3d';
        const startDate = '2025-07-01';
        const endDate = '2025-07-15';
        
        console.log(`📊 Запрос данных для подразделения: ${departmentId}`);
        console.log(`📅 Период: ${startDate} - ${endDate}`);
        
        const mcpData = await mcpClient.getDashboardData(departmentId, startDate, endDate);
        
        if (mcpData.success) {
            console.log('✅ MCP API ответил успешно');
            console.log(`📋 Доступные поля: ${Object.keys(mcpData.data).join(', ')}`);
            
            // Проверяем ключевые поля
            const keyFields = ['forecast', 'plan_vs_fact', 'hourly_sales', 'payroll', 'reviews'];
            
            for (const field of keyFields) {
                if (mcpData.data[field]) {
                    const fieldData = mcpData.data[field];
                    console.log(`\n🔍 Поле ${field}:`);
                    console.log(`   📊 Тип: ${typeof fieldData}`);
                    
                    if (fieldData.data) {
                        console.log(`   📈 Данные: ${Array.isArray(fieldData.data) ? fieldData.data.length + ' элементов' : 'объект'}`);
                        
                        // Показываем первый элемент если это массив
                        if (Array.isArray(fieldData.data) && fieldData.data.length > 0) {
                            console.log(`   📄 Первый элемент: ${JSON.stringify(fieldData.data[0], null, 2)}`);
                        }
                    } else {
                        console.log(`   📈 Данные: ${JSON.stringify(fieldData, null, 2)}`);
                    }
                } else {
                    console.log(`\n❌ Поле ${field}: отсутствует`);
                }
            }
            
            // Проверяем department_info
            if (mcpData.data.department_info) {
                console.log('\n🏢 Информация о подразделении:');
                console.log(JSON.stringify(mcpData.data.department_info, null, 2));
            }
            
        } else {
            console.log('❌ MCP API вернул ошибку:');
            console.log(mcpData.error);
        }
        
    } catch (error) {
        console.error('💥 Ошибка тестирования MCP API:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Запуск теста
testMCPAPI().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});