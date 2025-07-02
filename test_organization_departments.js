const axios = require('axios');

async function testOrganizationDepartments() {
    try {
        console.log('=== Тестирование фильтрации подразделений по организации ===\n');
        
        // 1. Получаем все организации
        console.log('1. Получение списка организаций...');
        const orgsResponse = await axios.get('http://localhost:3030/api/admin/organizations');
        const organizations = orgsResponse.data;
        
        // Ищем ТОО Madlen Group
        const madlenGroup = organizations.find(org => org.object_company === 'ТОО Madlen Group');
        
        if (!madlenGroup) {
            console.log('❌ ТОО Madlen Group не найдена в списке организаций');
            console.log('Доступные организации:');
            organizations.slice(0, 5).forEach(org => {
                console.log(`  ${org.object_company} (${org.object_bin})`);
            });
            return;
        }
        
        console.log(`✅ Найдена организация: ${madlenGroup.object_company}`);
        console.log(`   БИН: ${madlenGroup.object_bin}\n`);
        
        // 2. Получаем все подразделения
        console.log('2. Получение всех подразделений...');
        const allDeptsResponse = await axios.get('http://localhost:3030/api/admin/departments');
        const allDepartments = allDeptsResponse.data;
        
        console.log(`Всего подразделений в системе: ${allDepartments.length}`);
        
        // 3. Фильтруем подразделения для ТОО Madlen Group
        console.log('\n3. Фильтрация подразделений для ТОО Madlen Group...');
        const madlenDepartments = allDepartments.filter(dept => dept.object_bin === madlenGroup.object_bin);
        
        console.log(`Подразделений для ТОО Madlen Group: ${madlenDepartments.length}`);
        
        if (madlenDepartments.length > 0) {
            console.log('\nПодразделения ТОО Madlen Group:');
            madlenDepartments.forEach((dept, index) => {
                console.log(`  ${index + 1}. ${dept.object_name} (${dept.object_code})`);
            });
            
            // Проверяем, есть ли Kitchen room
            const kitchenRooms = madlenDepartments.filter(dept => 
                dept.object_name && dept.object_name.toLowerCase().includes('kitchen')
            );
            
            console.log(`\n4. Поиск "Kitchen room" в подразделениях:`);
            if (kitchenRooms.length > 0) {
                console.log(`✅ Найдено ${kitchenRooms.length} подразделений с "Kitchen":`);
                kitchenRooms.forEach(dept => {
                    console.log(`  - ${dept.object_name} (${dept.object_code})`);
                });
            } else {
                console.log(`❌ Подразделения с "Kitchen" не найдены`);
                
                // Поищем другие варианты названий
                const cookingDepts = madlenDepartments.filter(dept => 
                    dept.object_name && (
                        dept.object_name.toLowerCase().includes('кухн') ||
                        dept.object_name.toLowerCase().includes('цех') ||
                        dept.object_name.toLowerCase().includes('cook') ||
                        dept.object_name.toLowerCase().includes('kitchen')
                    )
                );
                
                if (cookingDepts.length > 0) {
                    console.log(`Найдены похожие подразделения:`);
                    cookingDepts.forEach(dept => {
                        console.log(`  - ${dept.object_name} (${dept.object_code})`);
                    });
                }
            }
        } else {
            console.log('❌ Не найдено подразделений для ТОО Madlen Group');
            
            // Проверим, может ли быть проблема с БИН
            console.log('\nПроверка альтернативных вариантов БИН:');
            const madlenVariants = allDepartments.filter(dept => 
                dept.object_company && dept.object_company.toLowerCase().includes('madlen')
            );
            
            if (madlenVariants.length > 0) {
                console.log('Найдены подразделения с "Madlen" в названии компании:');
                const uniqueCompanies = [...new Set(madlenVariants.map(d => `${d.object_company} (${d.object_bin})`))];
                uniqueCompanies.forEach(company => {
                    console.log(`  ${company}`);
                });
            }
        }
        
        // 5. Проверяем логику фильтрации на фронтенде
        console.log('\n5. Проверка логики фильтрации (как на фронтенде):');
        console.log(`Организация БИН: ${madlenGroup.object_bin}`);
        console.log('Условие фильтра: dept.object_bin === organizationBin');
        
        const frontendFiltered = allDepartments.filter(dept => dept.object_bin === madlenGroup.object_bin);
        console.log(`Результат фильтрации: ${frontendFiltered.length} подразделений`);
        
        // 6. Ищем Kitchen room во всех подразделениях
        console.log('\n6. Поиск "Kitchen room" во всех подразделениях системы:');
        const allKitchenRooms = allDepartments.filter(dept => 
            dept.object_name && dept.object_name.toLowerCase().includes('kitchen room')
        );
        
        if (allKitchenRooms.length > 0) {
            console.log(`Найдено ${allKitchenRooms.length} подразделений "Kitchen room":`);
            allKitchenRooms.forEach(dept => {
                console.log(`  - ${dept.object_name} (${dept.object_code}) - ${dept.object_company} (БИН: ${dept.object_bin})`);
            });
        } else {
            console.log('Подразделения "Kitchen room" не найдены в системе');
        }
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
    }
}

testOrganizationDepartments();