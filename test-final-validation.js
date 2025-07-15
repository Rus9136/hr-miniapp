#!/usr/bin/env node

const MultiAgentSystem = require('./backend/services/multi-agent-system');
const anthropicClient = require('./backend/services/anthropic-client');

// Цвета для консоли
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Полные тестовые данные MCP в правильном формате
const testMcpData = {
    department: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Ресторан на Абая",
        address: "ул. Абая, 123"
    },
    forecast: {
        data: [
            { date: "2025-01-10", revenue: 2500000, orders: 180 },
            { date: "2025-01-11", revenue: 2800000, orders: 210 },
            { date: "2025-01-12", revenue: 3200000, orders: 245 },
            { date: "2025-01-13", revenue: 2900000, orders: 220 },
            { date: "2025-01-14", revenue: 2600000, orders: 195 }
        ]
    },
    plan_vs_fact: {
        data: [
            { date: "2025-01-10", planned_revenue: 2400000, actual_revenue: 2500000, variance_percent: 4.17 },
            { date: "2025-01-11", planned_revenue: 2700000, actual_revenue: 2800000, variance_percent: 3.70 },
            { date: "2025-01-12", planned_revenue: 3000000, actual_revenue: 3200000, variance_percent: 6.67 },
            { date: "2025-01-13", planned_revenue: 2850000, actual_revenue: 2900000, variance_percent: 1.75 },
            { date: "2025-01-14", planned_revenue: 2550000, actual_revenue: 2600000, variance_percent: 1.96 }
        ]
    },
    hourly_sales: {
        data: [
            { hour: "10:00", revenue: 150000, orders: 12 },
            { hour: "11:00", revenue: 280000, orders: 22 },
            { hour: "12:00", revenue: 450000, orders: 35 },
            { hour: "13:00", revenue: 520000, orders: 42 },
            { hour: "14:00", revenue: 380000, orders: 30 },
            { hour: "15:00", revenue: 220000, orders: 18 },
            { hour: "16:00", revenue: 180000, orders: 14 },
            { hour: "17:00", revenue: 250000, orders: 20 },
            { hour: "18:00", revenue: 380000, orders: 31 },
            { hour: "19:00", revenue: 490000, orders: 40 },
            { hour: "20:00", revenue: 420000, orders: 34 },
            { hour: "21:00", revenue: 280000, orders: 23 }
        ]
    },
    reviews: {
        data: [
            {
                date: "2025-01-14",
                rating: 5,
                text: "Отличное обслуживание! Еда была превосходной, особенно стейк. Официант Алексей был очень внимателен.",
                author: "Мария К."
            },
            {
                date: "2025-01-13",
                rating: 2,
                text: "Долгое ожидание заказа (больше 40 минут). Еда была холодной. Персонал извинялся, но это не исправило ситуацию.",
                author: "Иван П."
            },
            {
                date: "2025-01-13",
                rating: 4,
                text: "Хорошая кухня, но немного шумно. Салаты свежие, паста аль денте. Цены соответствуют качеству.",
                author: "Елена С."
            },
            {
                date: "2025-01-12",
                rating: 1,
                text: "Ужасный опыт! Забыли половину заказа, принесли не то блюдо. Менеджер был груб. Больше не вернусь.",
                author: "Дмитрий Л."
            },
            {
                date: "2025-01-12",
                rating: 5,
                text: "Прекрасная атмосфера, вкусная еда. Особенно понравился десерт тирамису. Обязательно приду еще!",
                author: "Анна Р."
            }
        ]
    }
};

// Пустые данные по персоналу (для других агентов)
const testTimeRecords = [];
const testSchedules = [];

async function validatePlaceholderReplacement() {
    console.log(`${colors.cyan}=== ФИНАЛЬНЫЙ ТЕСТ ВАЛИДАЦИИ ИСПРАВЛЕНИЯ ПЛЕЙСХОЛДЕРОВ ===${colors.reset}\n`);
    
    const results = {
        salesAgent: { passed: false, issues: [] },
        reputationAgent: { passed: false, issues: [] },
        overall: { passed: false }
    };

    try {
        const multiAgentSystem = new MultiAgentSystem();
        
        console.log(`${colors.blue}1. Инициализация системы...${colors.reset}`);
        console.log(`${colors.green}✓ Система инициализирована${colors.reset}\n`);

        // Тест SalesAnalysisAgent
        console.log(`${colors.blue}2. Тестирование SalesAnalysisAgent...${colors.reset}`);
        
        const salesAgent = multiAgentSystem.agents.SalesAnalysisAgent;
        if (!salesAgent) {
            throw new Error('SalesAnalysisAgent не найден');
        }

        // Получаем промпт с подставленными данными
        const salesData = multiAgentSystem.prepareAgentData(salesAgent, testMcpData, {});
        const salesPrompt = multiAgentSystem.processPromptPlaceholders(salesAgent.default_prompt, salesData);
        
        console.log(`${colors.yellow}Проверка промпта SalesAnalysisAgent:${colors.reset}`);
        
        // Проверяем наличие плейсхолдеров
        const salesPlaceholders = ['{forecast}', '{plan_vs_fact}', '{hourly_sales}'];
        let salesHasPlaceholders = false;
        
        for (const placeholder of salesPlaceholders) {
            if (salesPrompt.includes(placeholder)) {
                console.log(`${colors.red}✗ Найден незамененный плейсхолдер: ${placeholder}${colors.reset}`);
                results.salesAgent.issues.push(`Незамененный плейсхолдер: ${placeholder}`);
                salesHasPlaceholders = true;
            }
        }
        
        if (!salesHasPlaceholders) {
            console.log(`${colors.green}✓ Все плейсхолдеры заменены${colors.reset}`);
        }

        // Проверяем наличие реальных данных (только те, которые должны быть в промпте SalesAnalysisAgent)
        const expectedSalesData = [
            '2500000',
            '3200000',
            'план',
            '450000',
            '520000'
        ];
        
        console.log(`${colors.yellow}Проверка наличия данных в промпте:${colors.reset}`);
        for (const data of expectedSalesData) {
            if (salesPrompt.includes(data)) {
                console.log(`${colors.green}✓ Найдены данные: ${data}${colors.reset}`);
            } else {
                console.log(`${colors.red}✗ Не найдены данные: ${data}${colors.reset}`);
                results.salesAgent.issues.push(`Отсутствуют данные: ${data}`);
            }
        }

        // Выполняем анализ с Claude
        console.log(`\n${colors.yellow}Выполнение анализа SalesAnalysisAgent...${colors.reset}`);
        const salesResult = await multiAgentSystem.runSingleAgent('SalesAnalysisAgent', testMcpData, null, {});
        
        if (salesResult && salesResult.success && salesResult.result) {
            console.log(`${colors.green}✓ Анализ выполнен успешно${colors.reset}`);
            
            // Проверяем, что агент проанализировал данные, а не попросил их предоставить
            const problematicPhrases = [
                'предоставьте данные',
                'нужны данные',
                'отсутствуют данные',
                'provide data',
                'need data',
                'missing data'
            ];
            
            let hasProblematicPhrases = false;
            for (const phrase of problematicPhrases) {
                if (salesResult.result.toLowerCase().includes(phrase)) {
                    console.log(`${colors.red}✗ Агент запрашивает данные: "${phrase}"${colors.reset}`);
                    results.salesAgent.issues.push(`Агент запрашивает данные: "${phrase}"`);
                    hasProblematicPhrases = true;
                }
            }
            
            if (!hasProblematicPhrases) {
                console.log(`${colors.green}✓ Агент анализирует предоставленные данные${colors.reset}`);
            }
            
            // Проверяем упоминание конкретных данных в ответе
            const expectedMentions = ['2,5 млн', '3,2 млн', '520', '13:00', 'обед'];
            let mentionCount = 0;
            
            console.log(`${colors.yellow}Проверка упоминаний данных в анализе:${colors.reset}`);
            for (const mention of expectedMentions) {
                if (salesResult.result.includes(mention)) {
                    console.log(`${colors.green}✓ Упоминается: ${mention}${colors.reset}`);
                    mentionCount++;
                }
            }
            
            if (mentionCount >= 3) {
                console.log(`${colors.green}✓ Агент использует конкретные данные (${mentionCount}/${expectedMentions.length})${colors.reset}`);
                results.salesAgent.passed = results.salesAgent.issues.length === 0;
            } else {
                console.log(`${colors.red}✗ Недостаточно упоминаний данных (${mentionCount}/${expectedMentions.length})${colors.reset}`);
                results.salesAgent.issues.push('Недостаточно упоминаний конкретных данных');
            }
        } else {
            console.log(`${colors.red}✗ Анализ не выполнен${colors.reset}`);
            if (salesResult && salesResult.error) {
                console.log(`${colors.red}Ошибка: ${salesResult.error.message}${colors.reset}`);
            }
            results.salesAgent.issues.push('Анализ не выполнен');
        }

        // Тест ReputationAgent
        console.log(`\n${colors.blue}3. Тестирование ReputationAgent...${colors.reset}`);
        
        const reputationAgent = multiAgentSystem.agents.ReputationAgent;
        if (!reputationAgent) {
            throw new Error('ReputationAgent не найден');
        }

        // Получаем промпт с подставленными данными
        const reputationData = multiAgentSystem.prepareAgentData(reputationAgent, testMcpData, {});
        const reputationPrompt = multiAgentSystem.processPromptPlaceholders(reputationAgent.default_prompt, reputationData);
        
        console.log(`${colors.yellow}Проверка промпта ReputationAgent:${colors.reset}`);
        
        // Проверяем наличие плейсхолдера {reviews}
        if (reputationPrompt.includes('{reviews}')) {
            console.log(`${colors.red}✗ Найден незамененный плейсхолдер: {reviews}${colors.reset}`);
            results.reputationAgent.issues.push('Незамененный плейсхолдер: {reviews}');
        } else {
            console.log(`${colors.green}✓ Плейсхолдер {reviews} заменен${colors.reset}`);
        }

        // Проверяем наличие реальных отзывов
        const expectedReviews = [
            'Отличное обслуживание',
            'Долгое ожидание заказа',
            'Ужасный опыт',
            'тирамису',
            'Алексей'
        ];
        
        console.log(`${colors.yellow}Проверка наличия отзывов в промпте:${colors.reset}`);
        for (const review of expectedReviews) {
            if (reputationPrompt.includes(review)) {
                console.log(`${colors.green}✓ Найден отзыв: ${review}${colors.reset}`);
            } else {
                console.log(`${colors.red}✗ Не найден отзыв: ${review}${colors.reset}`);
                results.reputationAgent.issues.push(`Отсутствует отзыв: ${review}`);
            }
        }

        // Выполняем анализ с Claude
        console.log(`\n${colors.yellow}Выполнение анализа ReputationAgent...${colors.reset}`);
        const reputationResult = await multiAgentSystem.runSingleAgent('ReputationAgent', testMcpData, null, {});
        
        if (reputationResult && reputationResult.success && reputationResult.result) {
            console.log(`${colors.green}✓ Анализ выполнен успешно${colors.reset}`);
            
            // Проверяем, что агент проанализировал отзывы
            const reputationMentions = ['40 минут', 'холодн', 'Алексей', 'тирамису', 'менеджер'];
            let reputationMentionCount = 0;
            
            console.log(`${colors.yellow}Проверка упоминаний отзывов в анализе:${colors.reset}`);
            for (const mention of reputationMentions) {
                if (reputationResult.result.toLowerCase().includes(mention.toLowerCase())) {
                    console.log(`${colors.green}✓ Упоминается: ${mention}${colors.reset}`);
                    reputationMentionCount++;
                }
            }
            
            if (reputationMentionCount >= 3) {
                console.log(`${colors.green}✓ Агент анализирует конкретные отзывы (${reputationMentionCount}/${reputationMentions.length})${colors.reset}`);
                results.reputationAgent.passed = results.reputationAgent.issues.length === 0;
            } else {
                console.log(`${colors.red}✗ Недостаточно упоминаний отзывов (${reputationMentionCount}/${reputationMentions.length})${colors.reset}`);
                results.reputationAgent.issues.push('Недостаточно упоминаний конкретных отзывов');
            }
        } else {
            console.log(`${colors.red}✗ Анализ не выполнен${colors.reset}`);
            if (reputationResult && reputationResult.error) {
                console.log(`${colors.red}Ошибка: ${reputationResult.error.message}${colors.reset}`);
            }
            results.reputationAgent.issues.push('Анализ не выполнен');
        }

        // Итоговая оценка
        results.overall.passed = results.salesAgent.passed && results.reputationAgent.passed;

    } catch (error) {
        console.error(`${colors.red}Ошибка при выполнении теста:${colors.reset}`, error);
        results.overall.error = error.message;
    }

    // Финальный отчет
    console.log(`\n${colors.cyan}=== ФИНАЛЬНЫЙ ОТЧЕТ ===${colors.reset}\n`);
    
    console.log(`${colors.yellow}SalesAnalysisAgent:${colors.reset}`);
    if (results.salesAgent.passed) {
        console.log(`${colors.green}✓ ТЕСТ ПРОЙДЕН${colors.reset}`);
    } else {
        console.log(`${colors.red}✗ ТЕСТ НЕ ПРОЙДЕН${colors.reset}`);
        results.salesAgent.issues.forEach(issue => {
            console.log(`  ${colors.red}- ${issue}${colors.reset}`);
        });
    }
    
    console.log(`\n${colors.yellow}ReputationAgent:${colors.reset}`);
    if (results.reputationAgent.passed) {
        console.log(`${colors.green}✓ ТЕСТ ПРОЙДЕН${colors.reset}`);
    } else {
        console.log(`${colors.red}✗ ТЕСТ НЕ ПРОЙДЕН${colors.reset}`);
        results.reputationAgent.issues.forEach(issue => {
            console.log(`  ${colors.red}- ${issue}${colors.reset}`);
        });
    }
    
    console.log(`\n${colors.magenta}=== ФИНАЛЬНОЕ ЗАКЛЮЧЕНИЕ ===${colors.reset}\n`);
    
    if (results.overall.passed) {
        console.log(`${colors.green}✅ ПРОБЛЕМА С ПЛЕЙСХОЛДЕРАМИ ПОЛНОСТЬЮ ИСПРАВЛЕНА!${colors.reset}`);
        console.log(`${colors.green}Все агенты корректно получают и анализируют реальные данные.${colors.reset}`);
        console.log(`${colors.green}Система готова к использованию в продакшене.${colors.reset}`);
    } else {
        console.log(`${colors.red}❌ ПРОБЛЕМА С ПЛЕЙСХОЛДЕРАМИ НЕ ИСПРАВЛЕНА${colors.reset}`);
        console.log(`${colors.red}Требуется дополнительная отладка системы.${colors.reset}`);
        
        if (results.overall.error) {
            console.log(`${colors.red}Критическая ошибка: ${results.overall.error}${colors.reset}`);
        }
    }
    
    console.log(`\n${colors.cyan}=== ТЕСТ ЗАВЕРШЕН ===${colors.reset}`);
}

// Запуск теста
validatePlaceholderReplacement().catch(console.error);