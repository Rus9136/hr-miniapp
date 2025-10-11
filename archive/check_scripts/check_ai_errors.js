const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkLastAnalysis() {
    try {
        // Получаем последние анализы
        const result = await pool.query(`
            SELECT 
                id,
                department_id,
                date_start,
                date_end,
                created_at,
                jsonb_extract_path_text(mcp_response, 'department_info', 'data', 'object_name') as department_name,
                agent_results,
                mcp_response
            FROM ai_recommendations 
            ORDER BY created_at DESC 
            LIMIT 3
        `);
        
        console.log('=== Последние анализы ===\n');
        
        for (const row of result.rows) {
            console.log(`📅 Анализ ID: ${row.id}`);
            console.log(`🏢 Подразделение: ${row.department_name || row.department_id}`);
            console.log(`📆 Период: ${row.date_start} - ${row.date_end}`);
            console.log(`🕐 Создан: ${new Date(row.created_at).toLocaleString('ru-RU')}`);
            console.log('\n📊 Результаты агентов:');
            
            const agentResults = row.agent_results;
            let errorAgents = [];
            
            for (const [agent, result] of Object.entries(agentResults)) {
                if (result && result.error) {
                    console.log(`❌ ${agent}: ОШИБКА - ${result.message || 'Unknown error'}`);
                    errorAgents.push(agent);
                } else {
                    console.log(`✅ ${agent}: Успешно (${typeof result === 'string' ? result.substring(0, 50) + '...' : 'data'})`);
                }
            }
            
            // Если есть ошибки, проверим MCP данные
            if (errorAgents.length > 0) {
                console.log('\n🔍 Проверка MCP данных для агентов с ошибками:');
                const mcpData = row.mcp_response;
                
                // Проверяем наличие ключевых данных
                console.log('- department_info:', mcpData.department_info ? '✅ Есть' : '❌ Отсутствует');
                console.log('- forecast:', mcpData.forecast ? '✅ Есть' : '❌ Отсутствует');
                console.log('- plan_vs_fact:', mcpData.plan_vs_fact ? '✅ Есть' : '❌ Отсутствует');
                console.log('- hourly_sales:', mcpData.hourly_sales ? '✅ Есть' : '❌ Отсутствует');
                console.log('- payroll:', mcpData.payroll ? '✅ Есть' : '❌ Отсутствует');
                console.log('- reviews:', mcpData.reviews ? `✅ Есть (${mcpData.reviews.length} отзывов)` : '❌ Отсутствует');
                
                // Для NarrativeAgent нужны результаты других агентов
                if (errorAgents.includes('NarrativeAgent')) {
                    console.log('\n⚠️  NarrativeAgent зависит от результатов других агентов');
                    const successfulAgents = Object.keys(agentResults).filter(a => !agentResults[a].error);
                    console.log(`   Успешные агенты: ${successfulAgents.join(', ')}`);
                }
            }
            
            console.log('\n' + '='.repeat(70) + '\n');
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
    } finally {
        pool.end();
    }
}

checkLastAnalysis();