const axios = require('axios');

async function testUpdateIIN() {
    try {
        // Тестовые данные как из 1С
        const testData = [
            {
                "iin": "880204400849",
                "table_number": "АП00-00002",
                "payroll": "371 838"
            },
            {
                "iin": "123456789012",
                "table_number": "0000000001", 
                "payroll": "250 000"
            }
        ];
        
        console.log('Отправка тестовых данных на API...');
        console.log('Данные:', JSON.stringify(testData, null, 2));
        
        const response = await axios.post('https://madlen.space/api/admin/employees/update-iin', testData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\nОтвет сервера:');
        console.log('Статус:', response.status);
        console.log('Данные:', JSON.stringify(response.data, null, 2));
        
        // Проверяем результат в БД
        const db = require('./backend/database_pg');
        
        console.log('\n=== Проверка в базе данных ===');
        
        for (const emp of testData) {
            const result = await db.queryRows(
                'SELECT table_number, iin, payroll FROM employees WHERE table_number = $1',
                [emp.table_number]
            );
            
            if (result.length > 0) {
                console.log(`\nСотрудник ${emp.table_number}:`);
                console.log(`  ИИН в БД: ${result[0].iin}`);
                console.log(`  ИИН отправленный: ${emp.iin}`);
                console.log(`  Payroll в БД: ${result[0].payroll}`);
                console.log(`  Payroll отправленный: ${emp.payroll}`);
            } else {
                console.log(`\nСотрудник ${emp.table_number} НЕ НАЙДЕН в БД!`);
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Ошибка:', error.response?.data || error.message);
        process.exit(1);
    }
}

testUpdateIIN();