const axios = require('axios');

async function testPayrollFilters() {
    try {
        console.log('=== Тестирование фильтров отчета по ФОТ ===\n');
        
        // 1. Тест загрузки организаций
        console.log('1. Тестирование API organizations...');
        const orgsResponse = await axios.get('http://localhost:3030/api/admin/organizations');
        console.log(`Загружено организаций: ${orgsResponse.data.length}`);
        
        if (orgsResponse.data.length > 0) {
            console.log(`Первая организация: ${orgsResponse.data[0].object_company} (${orgsResponse.data[0].object_bin})`);
        }
        
        // 2. Тест загрузки подразделений
        console.log('\n2. Тестирование API departments...');
        const deptsResponse = await axios.get('http://localhost:3030/api/admin/departments');
        console.log(`Загружено подразделений: ${deptsResponse.data.length}`);
        
        if (deptsResponse.data.length > 0) {
            console.log(`Первое подразделение: ${deptsResponse.data[0].object_name} (${deptsResponse.data[0].object_company})`);
        }
        
        // 3. Тест фильтрации подразделений по организации
        if (orgsResponse.data.length > 0) {
            const testOrgBin = orgsResponse.data[0].object_bin;
            console.log(`\n3. Тестирование фильтрации подразделений по организации: ${testOrgBin}...`);
            
            const filteredDepts = deptsResponse.data.filter(dept => dept.object_bin === testOrgBin);
            console.log(`Подразделений для организации ${testOrgBin}: ${filteredDepts.length}`);
            
            if (filteredDepts.length > 0) {
                console.log('Примеры подразделений:');
                filteredDepts.slice(0, 3).forEach(dept => {
                    console.log(`  - ${dept.object_name}`);
                });
            }
        }
        
        // 4. Тест отчета по ФОТ
        console.log('\n4. Тестирование API payroll report...');
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const params = {
            dateFrom: firstDay.toISOString().split('T')[0],
            dateTo: lastDay.toISOString().split('T')[0]
        };
        
        const payrollResponse = await axios.get('http://localhost:3030/api/admin/reports/payroll', { params });
        
        if (payrollResponse.data.success) {
            console.log(`Найдено записей в отчете: ${payrollResponse.data.data.length}`);
            console.log(`Итоговая сумма: ${payrollResponse.data.summary.total} тенге`);
            
            if (payrollResponse.data.data.length > 0) {
                console.log('Пример записи:');
                const example = payrollResponse.data.data[0];
                console.log(`  Дата: ${example.work_date}`);
                console.log(`  ФИО: ${example.full_name}`);
                console.log(`  Организация: ${example.organization_name}`);
                console.log(`  Подразделение: ${example.department_name}`);
                console.log(`  ФОТ на день: ${example.daily_payroll} тенге`);
            }
        } else {
            console.log('Ошибка в отчете:', payrollResponse.data.error);
        }
        
        console.log('\n✅ Все тесты завершены успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
    }
}

testPayrollFilters();