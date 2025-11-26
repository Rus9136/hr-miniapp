const { pool, queryRows, query } = require('./backend/database_pg');

async function testDirectImport() {
    const КодГрафика = `TEST-DIRECT-${Date.now()}`;
    const Организации = ['230540000699', '221040029729', '240940023852'];
    
    console.log('Тестирование прямой логики импорта');
    console.log('Код графика:', КодГрафика);
    console.log('Организации:', Организации);
    console.log('');
    
    try {
        // Шаг 1: Проверка организаций (как в коде)
        console.log('Шаг 1: Проверка организаций в departments...');
        const placeholders = Организации.map((_, i) => `$${i + 1}`).join(',');
        const orgCheckResult = await queryRows(
            `SELECT DISTINCT object_bin FROM departments WHERE object_bin IN (${placeholders})`,
            Организации
        );
        console.log(`Найдено организаций: ${orgCheckResult.length}`);
        orgCheckResult.forEach(r => console.log(`  - ${r.object_bin}`));
        
        const existingBins = new Set(orgCheckResult.map(row => row.object_bin));
        const validOrgBins = Array.from(existingBins);
        console.log(`Валидных БИНов: ${validOrgBins.length}`);
        console.log(`Валидные БИНы:`, validOrgBins);
        console.log('');
        
        if (validOrgBins.length === 0) {
            console.log('❌ Нет валидных организаций!');
            await pool.end();
            return;
        }
        
        // Шаг 2: Начало транзакции
        console.log('Шаг 2: Начало транзакции...');
        await query('BEGIN');
        
        // Шаг 3: Удаление существующих связей
        console.log('Шаг 3: Удаление существующих связей...');
        await query('DELETE FROM schedule_organizations WHERE schedule_code = $1', [КодГрафика]);
        
        // Шаг 4: Вставка новых связей
        console.log('Шаг 4: Вставка новых связей...');
        for (const orgBin of validOrgBins) {
            const insertResult = await query(
                'INSERT INTO schedule_organizations (schedule_code, organization_bin) VALUES ($1, $2) ON CONFLICT (schedule_code, organization_bin) DO NOTHING RETURNING id',
                [КодГрафика, orgBin]
            );
            if (insertResult.rows.length > 0) {
                console.log(`  ✅ Связана организация ${orgBin} (id: ${insertResult.rows[0].id})`);
            } else {
                console.log(`  ⚠️  Организация ${orgBin} уже связана (conflict)`);
            }
        }
        
        // Шаг 5: Коммит транзакции
        console.log('Шаг 5: Коммит транзакции...');
        await query('COMMIT');
        
        // Шаг 6: Проверка результата
        console.log('Шаг 6: Проверка результата...');
        const checkResult = await queryRows(
            'SELECT so.*, d.object_company FROM schedule_organizations so JOIN departments d ON so.organization_bin = d.object_bin WHERE so.schedule_code = $1',
            [КодГрафика]
        );
        
        console.log(`Найдено связей после коммита: ${checkResult.length}`);
        checkResult.forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.object_company} (БИН: ${r.organization_bin})`);
        });
        
        // Очистка
        console.log('');
        console.log('Очистка тестовых данных...');
        await query('DELETE FROM schedule_organizations WHERE schedule_code = $1', [КодГрафика]);
        
        if (checkResult.length === validOrgBins.length) {
            console.log('');
            console.log('✅ Тест пройден! Все организации успешно связаны.');
        } else {
            console.log('');
            console.log(`❌ Тест не пройден! Ожидалось ${validOrgBins.length} связей, получено ${checkResult.length}`);
        }
        
        await pool.end();
    } catch (error) {
        await query('ROLLBACK').catch(() => {});
        console.error('❌ Ошибка:', error.message);
        console.error(error.stack);
        await pool.end();
    }
}

testDirectImport();






