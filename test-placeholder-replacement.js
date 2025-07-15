const MultiAgentSystem = require('./backend/services/multi-agent-system');

console.log('🧪 Тест замены плейсхолдеров в промптах AI системы\n');

// Создаем экземпляр системы
const multiAgent = new MultiAgentSystem();

// Тестовые данные
const testData = {
    forecast: [
        { date: '2025-01-01', plan: 850000, fact: 920000 },
        { date: '2025-01-02', plan: 900000, fact: 880000 }
    ],
    hourly_sales: [
        { hour: 10, weekday_avg: 125000, weekend_avg: 180000 },
        { hour: 11, weekday_avg: 150000, weekend_avg: 220000 }
    ],
    payroll: [
        { employee_name: 'Иванов И.И.', shifts: 12, total_payroll: 300000 },
        { employee_name: 'Петров П.П.', shifts: 10, total_payroll: 250000 }
    ],
    reviews: [
        { rating: 5, comment: 'Отличный сервис!' },
        { rating: 3, comment: 'Долгое ожидание заказа' }
    ]
};

// Тестовые промпты с плейсхолдерами
const testPrompts = [
    {
        name: 'SalesAnalysisAgent',
        prompt: `Анализируй прогноз продаж:
— Прогноз: {forecast}
— Почасовые продажи: {hourly_sales}`,
        data: { forecast: testData.forecast, hourly_sales: testData.hourly_sales }
    },
    {
        name: 'PayrollAnalysisAgent', 
        prompt: `Анализируй затраты на персонал:
— ФОТ и смены: {payroll}
— Прогноз продаж: {forecast}`,
        data: { payroll: testData.payroll, forecast: testData.forecast }
    },
    {
        name: 'ReputationAgent',
        prompt: `Анализируй отзывы клиентов:
— Отзывы: {reviews}`,
        data: { reviews: testData.reviews }
    }
];

console.log('📋 Тестирование метода processPromptPlaceholders:\n');

// Тестируем каждый промпт
testPrompts.forEach((test, index) => {
    console.log(`\n🔍 Тест ${index + 1}: ${test.name}`);
    console.log('➡️  Исходный промпт:');
    console.log(test.prompt);
    
    // Вызываем метод замены плейсхолдеров
    const processedPrompt = multiAgent.processPromptPlaceholders(test.prompt, test.data);
    
    console.log('\n✅ Обработанный промпт:');
    console.log(processedPrompt);
    
    // Проверяем, что плейсхолдеры заменены (исключая JSON скобки)
    const remainingPlaceholders = processedPrompt.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
    
    if (remainingPlaceholders && remainingPlaceholders.length > 0) {
        console.log('\n❌ ОШИБКА: В промпте остались незамененные плейсхолдеры!');
        console.log('🔴 Незамененные плейсхолдеры:', remainingPlaceholders);
    } else {
        console.log('\n✅ Все плейсхолдеры успешно заменены!');
    }
    
    // Проверяем, что данные действительно вставлены
    const dataKeys = Object.keys(test.data);
    const allDataIncluded = dataKeys.every(key => {
        const jsonData = JSON.stringify(test.data[key]);
        return processedPrompt.includes(jsonData) || processedPrompt.includes(jsonData.substring(0, 50));
    });
    
    if (allDataIncluded) {
        console.log('✅ Все данные включены в промпт');
    } else {
        console.log('⚠️  Некоторые данные могут отсутствовать в промпте');
    }
    
    console.log('\n' + '='.repeat(80));
});

// Тест сжатия данных
console.log('\n\n📦 Тестирование метода compressDataForTokens:\n');

const compressedData = multiAgent.compressDataForTokens({
    forecast: { data: testData.forecast },
    payroll: { data: testData.payroll },
    hourly_sales: { data: testData.hourly_sales },
    reviews: { data: testData.reviews }
});

console.log('Сжатые данные:');
console.log(JSON.stringify(compressedData, null, 2));

// Тест подготовки данных для агента
console.log('\n\n🔧 Тестирование метода prepareAgentData:\n');

const agent = multiAgent.agents.SalesAnalysisAgent;
const mcpData = {
    forecast: { data: testData.forecast },
    hourly_sales: { data: testData.hourly_sales },
    plan_vs_fact: { data: [] }
};

const preparedData = multiAgent.prepareAgentData(agent, mcpData, {});

console.log('Подготовленные данные для SalesAnalysisAgent:');
console.log(JSON.stringify(preparedData, null, 2));

// Проверка правильности извлечения данных
const hasCorrectData = preparedData.forecast && preparedData.hourly_sales;
console.log(`\n✅ Данные извлечены корректно: ${hasCorrectData}`);

// Финальный тест: полная цепочка обработки
console.log('\n\n🚀 Финальный тест: полная цепочка обработки промпта\n');

const agentName = 'SalesAnalysisAgent';
const customPrompt = multiAgent.agents[agentName].default_prompt;
const agentData = multiAgent.prepareAgentData(multiAgent.agents[agentName], mcpData, {});
const finalPrompt = multiAgent.processPromptPlaceholders(customPrompt, agentData);

console.log('Финальный промпт для отправки в AI:');
console.log(finalPrompt);

// Проверка финального промпта (исключая JSON скобки)
const finalRemainingPlaceholders = finalPrompt.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
console.log(`\n✅ Финальный промпт готов к отправке: ${!finalRemainingPlaceholders || finalRemainingPlaceholders.length === 0}`);

if (finalRemainingPlaceholders && finalRemainingPlaceholders.length > 0) {
    console.log('❌ КРИТИЧЕСКАЯ ОШИБКА: В финальном промпте остались плейсхолдеры:', finalRemainingPlaceholders);
}

console.log('\n\n✅ Тест завершен!');