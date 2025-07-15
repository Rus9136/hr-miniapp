const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Проверяем и предлагаем решения для ошибки 529 Overloaded

async function analyzeOverloadIssue() {
    console.log('🔍 Анализ проблемы с перегрузкой Anthropic API\n');
    
    try {
        // Получаем все анализы с ошибками
        const result = await pool.query(`
            SELECT 
                id,
                department_id,
                created_at,
                agent_results
            FROM ai_recommendations 
            ORDER BY created_at DESC
        `);
        
        let totalAnalyses = result.rows.length;
        let analysesWithErrors = 0;
        let errorStats = {};
        
        result.rows.forEach(row => {
            const agentResults = row.agent_results;
            let hasError = false;
            
            for (const [agent, result] of Object.entries(agentResults)) {
                if (result && result.error) {
                    hasError = true;
                    const errorType = result.message?.includes('529') ? 'overloaded' : 
                                    result.message?.includes('500') ? 'server_error' :
                                    result.message?.includes('timeout') ? 'timeout' : 'other';
                    
                    if (!errorStats[agent]) {
                        errorStats[agent] = { total: 0, overloaded: 0, other: 0 };
                    }
                    errorStats[agent].total++;
                    errorStats[agent][errorType] = (errorStats[agent][errorType] || 0) + 1;
                }
            }
            
            if (hasError) analysesWithErrors++;
        });
        
        console.log(`📊 Статистика анализов:`);
        console.log(`- Всего анализов: ${totalAnalyses}`);
        console.log(`- Анализов с ошибками: ${analysesWithErrors} (${(analysesWithErrors/totalAnalyses*100).toFixed(1)}%)\n`);
        
        console.log(`📈 Статистика ошибок по агентам:`);
        for (const [agent, stats] of Object.entries(errorStats)) {
            console.log(`\n${agent}:`);
            console.log(`  - Всего ошибок: ${stats.total}`);
            if (stats.overloaded > 0) console.log(`  - Ошибок 529 (перегрузка): ${stats.overloaded}`);
            if (stats.other > 0) console.log(`  - Других ошибок: ${stats.other}`);
        }
        
        console.log('\n\n💡 РЕКОМЕНДАЦИИ ПО РЕШЕНИЮ:\n');
        
        console.log('1. НЕМЕДЛЕННЫЕ ДЕЙСТВИЯ:');
        console.log('   - Используйте функцию перезапуска агентов в админ-панели');
        console.log('   - Подождите 5-10 минут перед повторным запуском\n');
        
        console.log('2. УЛУЧШЕНИЯ В КОДЕ (для разработчиков):');
        console.log('   a) Увеличить паузу между агентами:');
        console.log('      В файле backend/services/multi-agent-system.js строка 122:');
        console.log('      await new Promise(resolve => setTimeout(resolve, 3000)); // было 1000\n');
        
        console.log('   b) Добавить retry логику с экспоненциальной задержкой:');
        console.log('      - При ошибке 529 ждать 30 секунд и повторить');
        console.log('      - Максимум 3 попытки\n');
        
        console.log('   c) Оптимизировать запуск агентов:');
        console.log('      - Запускать OptimizationAgent и NarrativeAgent с большей задержкой');
        console.log('      - Или запускать их отдельно после основных агентов\n');
        
        console.log('3. МОНИТОРИНГ:');
        console.log('   - Следить за статусом Anthropic API: https://status.anthropic.com/');
        console.log('   - Запускать анализы в непиковые часы (раннее утро по UTC)\n');
        
        // Проверяем последний анализ
        const lastAnalysis = result.rows[0];
        if (lastAnalysis) {
            const failedAgents = [];
            for (const [agent, result] of Object.entries(lastAnalysis.agent_results)) {
                if (result && result.error && result.message?.includes('529')) {
                    failedAgents.push(agent);
                }
            }
            
            if (failedAgents.length > 0) {
                console.log(`\n⚠️  В ПОСЛЕДНЕМ АНАЛИЗЕ (ID: ${lastAnalysis.id}) ЕСТЬ ОШИБКИ 529:`);
                console.log(`   Неудачные агенты: ${failedAgents.join(', ')}`);
                console.log(`   Рекомендуется перезапустить их через админ-панель`);
            }
        }
        
    } catch (error) {
        console.error('Ошибка анализа:', error);
    } finally {
        pool.end();
    }
}

// Запускаем анализ
analyzeOverloadIssue();