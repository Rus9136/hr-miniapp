const MultiAgentSystem = require('./backend/services/multi-agent-system');
const fs = require('fs');
const path = require('path');

// Цветной вывод для лучшей читаемости
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Тестовые данные MCP (соответствуют полям data_fields агентов)
const testMcpData = {
    // Для SalesAnalysisAgent: ['forecast', 'plan_vs_fact', 'hourly_sales']
    "forecast": [
        {"date": "2025-07-15", "plan": 850000, "fact": 920000},
        {"date": "2025-07-16", "plan": 780000, "fact": 750000},
        {"date": "2025-07-17", "plan": 900000, "fact": 980000},
        {"date": "2025-07-18", "plan": 1200000, "fact": 1350000},
        {"date": "2025-07-19", "plan": 1300000, "fact": 1180000}
    ],
    "plan_vs_fact": {
        "total_plan": 5030000,
        "total_fact": 5180000,
        "variance": 150000,
        "variance_percentage": 2.98
    },
    "hourly_sales": [
        {"hour": "09:00", "sales": 45000},
        {"hour": "10:00", "sales": 67000},
        {"hour": "11:00", "sales": 85000},
        {"hour": "12:00", "sales": 145000},
        {"hour": "13:00", "sales": 165000},
        {"hour": "14:00", "sales": 130000},
        {"hour": "15:00", "sales": 78000},
        {"hour": "16:00", "sales": 92000},
        {"hour": "17:00", "sales": 110000},
        {"hour": "18:00", "sales": 140000},
        {"hour": "19:00", "sales": 180000},
        {"hour": "20:00", "sales": 195000},
        {"hour": "21:00", "sales": 175000},
        {"hour": "22:00", "sales": 120000}
    ],
    
    // Для PayrollAnalysisAgent: ['payroll', 'forecast']
    "payroll": [
        {"employee_name": "Иванов И.И.", "shifts": 22, "total_payroll": 450000},
        {"employee_name": "Петров П.П.", "shifts": 20, "total_payroll": 380000},
        {"employee_name": "Сидоров С.С.", "shifts": 18, "total_payroll": 320000},
        {"employee_name": "Козлов К.К.", "shifts": 24, "total_payroll": 520000},
        {"employee_name": "Смирнов С.М.", "shifts": 19, "total_payroll": 360000}
    ],
    
    // Для ReputationAgent: ['reviews']
    "reviews": [
        {
            "rating": 5,
            "text": "Отличный ресторан! Быстрое обслуживание, вкусная еда. Особенно понравились манты!",
            "date": "2025-07-14"
        },
        {
            "rating": 2,
            "text": "Долго ждали заказ, официант был невежлив. Качество блюд оставляет желать лучшего.",
            "date": "2025-07-13"
        },
        {
            "rating": 4,
            "text": "Хорошее место для семейного обеда. Приятная атмосфера, но цены немного высоковаты.",
            "date": "2025-07-12"
        },
        {
            "rating": 1,
            "text": "Ужасный сервис! Принесли холодную еду, персонал грубый. Больше не придем.",
            "date": "2025-07-11"
        },
        {
            "rating": 5,
            "text": "Великолепный плов! Обслуживание на высоте. Рекомендую всем друзьям.",
            "date": "2025-07-10"
        }
    ],
    
    // Дополнительные данные для контекста
    "unit": {
        "id": "bf1e6f73-1b89-4bb1-90eb-3b5ea9b03c8b",
        "name": "Ресторан Adem (Кулан 7)",
        "type": "restaurant",
        "work_hours": "09:00-23:00",
        "average_check": 4200,
        "seating_capacity": 120,
        "location": {
            "address": "ул. Кулан, 7",
            "coordinates": {
                "lat": 51.1694,
                "lng": 71.4491
            }
        }
    },
    "analytics": {
        "labor_cost_percentage": 97.6,
        "table_turnover_rate": 3.2,
        "seat_occupancy_rate": 75.5,
        "waste_percentage": 2.8,
        "customer_satisfaction": 4.2
    }
};

// Функция для глубокого сравнения промптов
function findPlaceholders(text) {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;
    
    while ((match = placeholderRegex.exec(text)) !== null) {
        matches.push({
            full: match[0],
            key: match[1].trim(),
            position: match.index
        });
    }
    
    return matches;
}

// Функция для красивого вывода
function logSection(title, color = 'bright') {
    console.log(`\n${colors[color]}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors[color]}${title}${colors.reset}`);
    console.log(`${colors[color]}${'='.repeat(80)}${colors.reset}\n`);
}

function logAgent(agentName) {
    console.log(`\n${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}Агент: ${agentName}${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}\n`);
}

async function debugPlaceholders() {
    logSection('ТЕСТИРОВАНИЕ СИСТЕМЫ ПЛЕЙСХОЛДЕРОВ AI', 'magenta');
    
    const system = new MultiAgentSystem();
    
    // Список всех агентов
    const agents = [
        'SalesAnalysisAgent',
        'PayrollAnalysisAgent',
        'StaffingAgent',
        'ReputationAgent',
        'OptimizationAgent',
        'NarrativeAgent'
    ];
    
    // Загружаем промпты
    const prompts = {};
    for (const agent of agents) {
        try {
            const promptPath = path.join(__dirname, 'backend', 'prompts', `${agent}.txt`);
            prompts[agent] = fs.readFileSync(promptPath, 'utf8');
        } catch (error) {
            console.log(`${colors.red}Ошибка загрузки промпта для ${agent}: ${error.message}${colors.reset}`);
        }
    }
    
    // Тестируем prepareAgentData для каждого агента
    logSection('1. ТЕСТИРОВАНИЕ prepareAgentData', 'blue');
    
    for (const agent of agents) {
        logAgent(agent);
        
        console.log(`${colors.yellow}Вызов prepareAgentData...${colors.reset}`);
        const agentConfig = system.agents[agent];
        if (!agentConfig) {
            console.log(`${colors.red}Конфигурация агента ${agent} не найдена!${colors.reset}`);
            continue;
        }
        const agentData = system.prepareAgentData(agentConfig, testMcpData);
        
        console.log(`${colors.green}Результат:${colors.reset}`);
        console.log(JSON.stringify(agentData, null, 2));
        
        // Проверяем наличие ключевых полей
        const requiredFields = ['departmentName', 'period', 'revenue', 'employeeCount'];
        const missingFields = requiredFields.filter(field => !agentData[field]);
        
        if (missingFields.length > 0) {
            console.log(`${colors.red}⚠️  Отсутствуют обязательные поля: ${missingFields.join(', ')}${colors.reset}`);
        } else {
            console.log(`${colors.green}✓ Все обязательные поля присутствуют${colors.reset}`);
        }
    }
    
    // Тестируем processPromptPlaceholders
    logSection('2. ТЕСТИРОВАНИЕ processPromptPlaceholders', 'blue');
    
    for (const agent of agents) {
        logAgent(agent);
        
        // Находим плейсхолдеры в исходном промпте
        const promptToCheck = prompts[agent] || system.agents[agent].default_prompt;
        const placeholdersBefore = findPlaceholders(promptToCheck);
        console.log(`${colors.yellow}Найдено плейсхолдеров: ${placeholdersBefore.length}${colors.reset}`);
        
        if (placeholdersBefore.length > 0) {
            console.log('\nПлейсхолдеры в промпте:');
            placeholdersBefore.forEach(p => {
                console.log(`  - ${colors.cyan}${p.full}${colors.reset} (позиция: ${p.position})`);
            });
        }
        
        // Подготавливаем данные для агента
        const agentConfig = system.agents[agent];
        if (!agentConfig) {
            console.log(`${colors.red}Конфигурация агента ${agent} не найдена!${colors.reset}`);
            continue;
        }
        const agentData = system.prepareAgentData(agentConfig, testMcpData);
        
        // Обрабатываем промпт (используем дефолтный промпт, если файл не найден)
        console.log(`\n${colors.yellow}Обработка промпта...${colors.reset}`);
        const promptToUse = prompts[agent] || agentConfig.default_prompt;
        const processedPrompt = system.processPromptPlaceholders(promptToUse, agentData);
        
        // Находим оставшиеся плейсхолдеры
        const placeholdersAfter = findPlaceholders(processedPrompt);
        console.log(`\n${colors.yellow}Осталось плейсхолдеров: ${placeholdersAfter.length}${colors.reset}`);
        
        if (placeholdersAfter.length > 0) {
            console.log(`${colors.red}⚠️  Незамененные плейсхолдеры:${colors.reset}`);
            placeholdersAfter.forEach(p => {
                console.log(`  - ${colors.red}${p.full}${colors.reset}`);
            });
        } else {
            console.log(`${colors.green}✓ Все плейсхолдеры успешно заменены${colors.reset}`);
        }
        
        // Показываем примеры замен
        console.log(`\n${colors.yellow}Примеры замен:${colors.reset}`);
        
        // Показываем какие поля были подготовлены для агента
        Object.entries(agentData).forEach(([key, value]) => {
            const placeholder = `{${key}}`;
            if (promptToCheck.includes(placeholder)) {
                const displayValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) + '...' : value;
                console.log(`  ${placeholder} → ${colors.green}${displayValue}${colors.reset}`);
            }
        });
        
        // Показываем фрагмент обработанного промпта
        console.log(`\n${colors.yellow}Фрагмент обработанного промпта:${colors.reset}`);
        const fragment = processedPrompt.substring(0, 500) + '...';
        console.log(colors.green + fragment + colors.reset);
    }
    
    // Тестируем полный процесс для одного агента
    logSection('3. ДЕТАЛЬНЫЙ ТЕСТ ДЛЯ SalesAnalysisAgent', 'blue');
    
    const testAgent = 'SalesAnalysisAgent';
    const testPrompt = prompts[testAgent];
    
    if (testPrompt) {
        console.log(`${colors.yellow}Исходный промпт (первые 300 символов):${colors.reset}`);
        console.log(testPrompt.substring(0, 300) + '...\n');
        
        const agentConfig = system.agents[testAgent];
        if (!agentConfig) {
            console.log(`${colors.red}Конфигурация агента ${testAgent} не найдена!${colors.reset}`);
            return;
        }
        const agentData = system.prepareAgentData(agentConfig, testMcpData);
        console.log(`${colors.yellow}Подготовленные данные:${colors.reset}`);
        console.log(JSON.stringify(agentData, null, 2));
        
        const processedPrompt = system.processPromptPlaceholders(testPrompt, agentData);
        console.log(`\n${colors.yellow}Обработанный промпт (первые 300 символов):${colors.reset}`);
        console.log(`${colors.green}${processedPrompt.substring(0, 300)}...${colors.reset}`);
        
        // Проверяем конкретные замены
        console.log(`\n${colors.yellow}Проверка конкретных замен:${colors.reset}`);
        const checks = [
            { original: '{{departmentName}}', expected: 'Ресторан Adem (Кулан 7)' },
            { original: '{{revenue}}', expected: '8750000' },
            { original: '{{averageCheck}}', expected: '4200' }
        ];
        
        checks.forEach(check => {
            const found = processedPrompt.includes(check.expected);
            const status = found ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
            console.log(`  ${status} ${check.original} → ${check.expected}`);
        });
    }
    
    logSection('ТЕСТИРОВАНИЕ ЗАВЕРШЕНО', 'magenta');
}

// Запускаем тестирование
debugPlaceholders().catch(error => {
    console.error(`${colors.red}Критическая ошибка: ${error}${colors.reset}`);
    console.error(error.stack);
});