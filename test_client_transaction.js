// Тест транзакции с использованием клиента из пула
const { pool } = require('./backend/database_pg');

async function testTransaction() {
    const client = await pool.connect();
    const TEST_CODE = `CLIENT-TEST-${Date.now()}`;
    const orgBins = ['230540000699', '221040029729'];
    
    try {
        console.log('Начало транзакции...');
        await client.query('BEGIN');
        
        console.log('Проверка организаций...');
        const placeholders = orgBins.map((_, i) => `$${i + 1}`).join(',');
        const orgCheck = await client.query(
            `SELECT DISTINCT object_bin FROM departments WHERE object_bin IN (${placeholders})`,
            orgBins
        );
        console.log(`Найдено организаций: ${orgCheck.rows.length}`);
        
        const validBins = orgCheck.rows.map(r => r.object_bin);
        console.log(`Валидные БИНы:`, validBins);
        
        console.log('Удаление старых связей...');
        await client.query('DELETE FROM schedule_organizations WHERE schedule_code = $1', [TEST_CODE]);
        
        console.log('Вставка новых связей...');
        for (const bin of validBins) {
            const result = await client.query(
                'INSERT INTO schedule_organizations (schedule_code, organization_bin) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
                [TEST_CODE, bin]
            );
            console.log(`  Вставлена связь ${bin}:`, result.rows.length > 0 ? `id=${result.rows[0].id}` : 'conflict');
        }
        
        console.log('Проверка перед коммитом...');
        const verify = await client.query(
            'SELECT COUNT(*) as count FROM schedule_organizations WHERE schedule_code = $1',
            [TEST_CODE]
        );
        console.log(`Связей перед коммитом: ${verify.rows[0].count}`);
        
        console.log('Коммит транзакции...');
        await client.query('COMMIT');
        
        console.log('Проверка после коммита...');
        const afterCommit = await pool.query(
            'SELECT * FROM schedule_organizations WHERE schedule_code = $1',
            [TEST_CODE]
        );
        console.log(`Связей после коммита: ${afterCommit.rows.length}`);
        afterCommit.rows.forEach(r => console.log(`  - ${r.organization_bin}`));
        
        // Очистка
        await pool.query('DELETE FROM schedule_organizations WHERE schedule_code = $1', [TEST_CODE]);
        
        if (afterCommit.rows.length === validBins.length) {
            console.log('✅ Тест пройден!');
        } else {
            console.log(`❌ Тест не пройден! Ожидалось ${validBins.length}, получено ${afterCommit.rows.length}`);
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

testTransaction();






