/**
 * Test with ТОО Tary Astana - real data
 */

const http = require('http');

const organization = 'ТОО Tary Astana';
const date = '2025-11-17';

console.log(`🧪 Testing with: ${organization}, date: ${date}\n`);

const options = {
    hostname: 'localhost',
    port: 3030,
    path: `/api/admin/reports/payroll-overtime?organization=${encodeURIComponent(organization)}&date=${date}`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);

            const totalPlanned = json.departments.reduce((sum, d) => sum + d.summary.plannedCount, 0);
            const totalActual = json.departments.reduce((sum, d) => sum + d.summary.actualCount, 0);
            const totalPlannedPayroll = json.departments.reduce((sum, d) => sum + d.summary.plannedPayroll, 0);
            const totalActualPayroll = json.departments.reduce((sum, d) => sum + d.summary.actualPayroll, 0);

            console.log('✅ SUCCESS!\n');
            console.log(`Departments: ${json.departments.length}`);
            console.log(`Total Planned: ${totalPlanned} employees`);
            console.log(`Total Actual: ${totalActual} employees`);
            console.log(`Total Planned Payroll: ${totalPlannedPayroll.toFixed(2)}₸`);
            console.log(`Total Actual Payroll: ${totalActualPayroll.toFixed(2)}₸`);
            console.log(`Difference: ${(totalActualPayroll - totalPlannedPayroll).toFixed(2)}₸`);

            if (totalPlanned > 0) {
                console.log('\n🎉 ПЛАНОВЫЕ ДАННЫЕ НАЙДЕНЫ!');
                console.log('\nПримеры плановых:');
                json.departments.slice(0, 3).forEach(dept => {
                    if (dept.summary.plannedCount > 0) {
                        console.log(`\n  ${dept.departmentName}:`);
                        console.log(`    План: ${dept.summary.plannedCount} чел, ${dept.summary.plannedPayroll}₸`);
                        console.log(`    Факт: ${dept.summary.actualCount} чел, ${dept.summary.actualPayroll}₸`);
                    }
                });
            } else {
                console.log('\n⚠️ Плановые данные = 0');
            }

        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
});

req.end();
