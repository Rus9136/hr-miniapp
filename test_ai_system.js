const MCPClient = require('./backend/services/mcp-client');
const AnthropicClient = require('./backend/services/anthropic-client');
const MultiAgentSystem = require('./backend/services/multi-agent-system');

async function testAISystem() {
    console.log('🚀 Тестирование AI системы...\n');

    try {
        // 1. Тест MCP Client
        console.log('1️⃣ Тестирование MCP Client...');
        const mcpClient = new MCPClient();
        const mcpTest = await mcpClient.testConnection();
        
        if (mcpTest.success) {
            console.log('✅ MCP API работает корректно');
        } else {
            console.log('❌ Проблема с MCP API:', mcpTest.error);
            return;
        }

        // 2. Тест Anthropic Client
        console.log('\n2️⃣ Тестирование Anthropic Client...');
        const anthropicClient = new AnthropicClient();
        const anthropicTest = await anthropicClient.testConnection();
        
        if (anthropicTest.success) {
            console.log('✅ Anthropic API работает корректно');
            console.log('🤖 Тестовый ответ:', anthropicTest.test_response);
        } else {
            console.log('❌ Проблема с Anthropic API:', anthropicTest.error);
            return;
        }

        // 3. Инициализация промптов
        console.log('\n3️⃣ Инициализация промптов по умолчанию...');
        const multiAgentSystem = new MultiAgentSystem();
        const initResult = await multiAgentSystem.initializeDefaultPrompts();
        
        if (initResult.success) {
            console.log('✅ Промпты инициализированы');
        } else {
            console.log('⚠️ Проблема с инициализацией промптов:', initResult.error);
        }

        // 4. Информация об агентах
        console.log('\n4️⃣ Информация об агентах:');
        const agentsInfo = multiAgentSystem.getAgentsInfo();
        agentsInfo.agents.forEach(agent => {
            console.log(`• ${agent.name}: ${agent.description}`);
            console.log(`  Данные: ${agent.data_fields.join(', ')}`);
        });

        // 5. Тест полного анализа (с ограниченными данными)
        console.log('\n5️⃣ Тестирование быстрого анализа...');
        
        const testData = await mcpClient.getDashboardData(
            '4cb558ca-a8bc-4b81-871e-043f65218c50',
            '2025-07-10',
            '2025-07-11',
            5
        );

        if (testData.success) {
            console.log('✅ Получены тестовые данные от MCP');
            
            // Тест одного агента для быстроты
            console.log('🧪 Тестирование агента SalesAnalysisAgent...');
            const agentResult = await multiAgentSystem.runSingleAgent(
                'SalesAnalysisAgent',
                testData.data
            );
            
            if (agentResult.success) {
                console.log('✅ Агент отработал успешно');
                console.log('📊 Результат анализа:');
                console.log(agentResult.result.substring(0, 200) + '...');
            } else {
                console.log('❌ Ошибка агента:', agentResult.error);
            }
        }

        console.log('\n🎉 Тестирование завершено!');

    } catch (error) {
        console.error('💥 Критическая ошибка тестирования:', error);
    }
}

// Запуск тестирования
testAISystem();