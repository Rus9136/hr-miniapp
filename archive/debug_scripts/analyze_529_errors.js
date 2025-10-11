const db = require('./backend/database_pg');

async function analyze529Errors() {
  try {
    console.log('=== Анализ ошибок 529 в AI системе ===\n');
    
    // 1. Проверяем общую статистику анализов
    const totalAnalyses = await db.queryRows(`
      SELECT COUNT(*) as total, 
             COUNT(*) FILTER (WHERE agent_results IS NOT NULL) as with_results,
             COUNT(*) FILTER (WHERE agent_results::text LIKE '%529%') as with_529_errors
      FROM ai_recommendations
    `);
    
    console.log('📊 Общая статистика:');
    console.log(`   Всего анализов: ${totalAnalyses[0].total}`);
    console.log(`   С результатами: ${totalAnalyses[0].with_results}`);
    console.log(`   С ошибками 529: ${totalAnalyses[0].with_529_errors}`);
    
    // 2. Анализируем последние записи логов Docker
    console.log('\n🔍 Анализ логов Docker (последние ошибки 529):');
    
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      const { stdout } = await execPromise('docker logs hr-miniapp --tail 500 --timestamps | grep -i "529\\|overloaded"');
      const lines = stdout.split('\n').filter(line => line.trim());
      
      console.log(`   Найдено ${lines.length} записей с ошибками 529`);
      
      // Группируем по агентам
      const agentErrors = {};
      const timePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/;
      
      lines.forEach(line => {
        const timeMatch = line.match(timePattern);
        const time = timeMatch ? timeMatch[1] : 'unknown';
        
        if (line.includes('PayrollAnalysisAgent')) {
          agentErrors['PayrollAnalysisAgent'] = (agentErrors['PayrollAnalysisAgent'] || 0) + 1;
        } else if (line.includes('StaffingAgent')) {
          agentErrors['StaffingAgent'] = (agentErrors['StaffingAgent'] || 0) + 1;
        } else if (line.includes('NarrativeAgent')) {
          agentErrors['NarrativeAgent'] = (agentErrors['NarrativeAgent'] || 0) + 1;
        } else if (line.includes('SalesAnalysisAgent')) {
          agentErrors['SalesAnalysisAgent'] = (agentErrors['SalesAnalysisAgent'] || 0) + 1;
        } else if (line.includes('ReputationAgent')) {
          agentErrors['ReputationAgent'] = (agentErrors['ReputationAgent'] || 0) + 1;
        } else if (line.includes('OptimizationAgent')) {
          agentErrors['OptimizationAgent'] = (agentErrors['OptimizationAgent'] || 0) + 1;
        }
      });
      
      console.log('\n   Ошибки 529 по агентам:');
      Object.entries(agentErrors).forEach(([agent, count]) => {
        console.log(`     ${agent}: ${count} ошибок`);
      });
      
      // Показываем последние 10 ошибок с временными метками
      console.log('\n   Последние 10 ошибок 529:');
      lines.slice(-10).forEach(line => {
        const timeMatch = line.match(timePattern);
        const time = timeMatch ? timeMatch[1] : 'unknown';
        const agentMatch = line.match(/агента "([^"]+)"/);
        const agent = agentMatch ? agentMatch[1] : 'unknown';
        console.log(`     ${time}: ${agent}`);
      });
      
    } catch (error) {
      console.log('   Ошибок 529 в логах не найдено или проблема с доступом к логам');
    }
    
    // 3. Проверяем размеры промптов
    console.log('\n📏 Размеры промптов агентов:');
    const prompts = await db.queryRows(`
      SELECT agent_name, LENGTH(prompt_text) as prompt_length, prompt_text
      FROM ai_prompts 
      ORDER BY prompt_length DESC
    `);
    
    prompts.forEach(prompt => {
      const sizeKB = (prompt.prompt_length / 1024).toFixed(2);
      console.log(`   ${prompt.agent_name}: ${prompt.prompt_length} символов (${sizeKB} КБ)`);
    });
    
    // 4. Анализируем частоту ошибок по времени
    console.log('\n⏰ Анализ времени ошибок:');
    try {
      const { stdout: timeAnalysis } = await execPromise('docker logs hr-miniapp --timestamps | grep -i "529" | cut -d"T" -f2 | cut -d":" -f1,2 | sort | uniq -c | sort -nr');
      
      if (timeAnalysis.trim()) {
        console.log('   Частота ошибок по времени (формат: количество время):');
        timeAnalysis.split('\n').slice(0, 10).forEach(line => {
          if (line.trim()) {
            console.log(`     ${line.trim()}`);
          }
        });
      } else {
        console.log('   Данных о времени ошибок не найдено');
      }
    } catch (error) {
      console.log('   Не удалось проанализировать время ошибок');
    }
    
    // 5. Проверяем текущие настройки retry
    console.log('\n⚙️ Текущие настройки retry:');
    console.log('   Базовые настройки anthropic-client.js:');
    console.log('     - maxRetries: 5');
    console.log('     - Задержки для 529: 15s, 45s, 90s, 180s, 300s');
    console.log('     - Jitter: до 10 секунд');
    console.log('     - Circuit breaker: 3 ошибки подряд');
    console.log('     - Пауза между агентами: 10-25 секунд');
    
    // 6. Рекомендации
    console.log('\n💡 Рекомендации по улучшению:');
    console.log('   1. Увеличить задержки для 529 ошибок:');
    console.log('      - Первая попытка: 30s (вместо 15s)');
    console.log('      - Вторая попытка: 90s (вместо 45s)');
    console.log('      - Третья попытка: 180s (вместо 90s)');
    console.log('      - Четвертая попытка: 360s (вместо 180s)');
    console.log('      - Пятая попытка: 600s (вместо 300s)');
    console.log('   2. Увеличить паузы между агентами до 30-60 секунд');
    console.log('   3. Добавить адаптивную логику: если 529 ошибки участились, увеличить все задержки в 2 раза');
    console.log('   4. Рассмотреть возможность использования более легкой модели для некоторых агентов');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при анализе:', error);
    process.exit(1);
  }
}

analyze529Errors();