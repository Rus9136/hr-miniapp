const db = require('./backend/database_pg');

async function checkAIErrors() {
  try {
    console.log('=== Проверка AI анализов на ошибки ===');
    
    // Проверяем последние анализы с ошибками
    const errorAnalyses = await db.queryRows(`
      SELECT id, department_id, date_start, date_end, created_at,
             agent_results
      FROM ai_recommendations 
      WHERE agent_results::text LIKE '%error%' OR agent_results::text LIKE '%Error%'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`\n📊 Найдено анализов с ошибками: ${errorAnalyses.length}`);
    
    if (errorAnalyses.length > 0) {
      errorAnalyses.forEach(analysis => {
        console.log(`\n❌ Анализ #${analysis.id} (${analysis.created_at.toISOString().split('T')[0]})`);
        console.log(`   Подразделение: ${analysis.department_id}`);
        console.log(`   Период: ${analysis.date_start} - ${analysis.date_end}`);
        
        const agentResults = analysis.agent_results || {};
        Object.keys(agentResults).forEach(agent => {
          const result = agentResults[agent];
          if (typeof result === 'string' && (result.includes('error') || result.includes('Error'))) {
            console.log(`   ${agent}: ${result.substring(0, 200)}...`);
          } else if (result?.error) {
            console.log(`   ${agent}: ${result.error}`);
          }
        });
      });
    }
    
    // Проверяем все последние анализы на наличие ошибок 529
    const allAnalyses = await db.queryRows(`
      SELECT id, created_at, agent_results
      FROM ai_recommendations 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    console.log(`\n🔍 Проверка последних ${allAnalyses.length} анализов на ошибки 529:`);
    
    let error529Count = 0;
    let totalErrors = 0;
    
    allAnalyses.forEach(analysis => {
      const agentResults = analysis.agent_results || {};
      let hasError529 = false;
      let hasAnyError = false;
      
      Object.keys(agentResults).forEach(agent => {
        const result = agentResults[agent];
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        
        if (resultStr.includes('529')) {
          hasError529 = true;
          console.log(`   ❌ Анализ #${analysis.id}: ${agent} - ошибка 529`);
        }
        
        if (resultStr.includes('error') || resultStr.includes('Error')) {
          hasAnyError = true;
        }
      });
      
      if (hasError529) error529Count++;
      if (hasAnyError) totalErrors++;
    });
    
    console.log(`\n📊 Статистика ошибок:`);
    console.log(`   Анализов с ошибками 529: ${error529Count}`);
    console.log(`   Анализов с любыми ошибками: ${totalErrors}`);
    console.log(`   Всего проверено: ${allAnalyses.length}`);
    
    // Проверяем размеры промптов
    console.log(`\n📏 Проверка размеров промптов:`);
    const prompts = await db.queryRows(`
      SELECT agent_name, LENGTH(prompt_text) as prompt_length
      FROM ai_prompts 
      ORDER BY prompt_length DESC
    `);
    
    prompts.forEach(prompt => {
      const sizeKB = (prompt.prompt_length / 1024).toFixed(2);
      console.log(`   ${prompt.agent_name}: ${prompt.prompt_length} символов (${sizeKB} КБ)`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при проверке:', error);
    process.exit(1);
  }
}

checkAIErrors();