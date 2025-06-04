const puppeteer = require('puppeteer');

async function testMainSchedulesPage() {
    console.log('🚀 Тестирование основной админ-панели...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Включаем логирование консоли
        page.on('console', msg => console.log('🖥️ Console:', msg.text()));
        page.on('pageerror', error => console.log('❌ Page Error:', error.message));
        
        // Открываем главную страницу
        console.log('📄 Открытие главной страницы...');
        await page.goto('http://localhost/', { waitUntil: 'networkidle0' });
        
        // Входим как админ
        console.log('🔐 Вход как администратор...');
        await page.type('#employeeId', 'admin12qw');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // Проверяем, что попали в админ-панель
        const isAdminPanel = await page.$('#adminScreen');
        if (isAdminPanel) {
            console.log('✅ Успешный вход в админ-панель');
        } else {
            console.log('❌ Не удалось войти в админ-панель');
            return;
        }
        
        // Переходим в секцию графиков
        console.log('📋 Переход в секцию графиков...');
        await page.click('a[data-section="schedules"]');
        await page.waitForTimeout(2000);
        
        // Проверяем загрузку графиков
        const schedulesLoaded = await page.$eval('#schedules-tbody', el => {
            return el.children.length > 0 && !el.innerHTML.includes('Загрузка');
        });
        
        if (schedulesLoaded) {
            console.log('✅ Графики загружены успешно');
        } else {
            console.log('❌ Графики не загрузились');
        }
        
        // Тестируем кнопку создания графика
        console.log('➕ Тест кнопки создания графика...');
        const createButton = await page.$('#create-schedule-btn');
        if (createButton) {
            await page.click('#create-schedule-btn');
            await page.waitForTimeout(2000);
            
            // Проверяем, открылась ли карточка
            const cardSection = await page.$('#schedule-card-section');
            const isCardVisible = await page.evaluate(el => {
                return el && window.getComputedStyle(el).display !== 'none';
            }, cardSection);
            
            if (isCardVisible) {
                console.log('✅ Карточка графика успешно открылась');
                
                // Проверяем элементы формы
                const elements = ['schedule-card-name', 'schedule-card-check-in', 'schedule-card-check-out'];
                for (const elementId of elements) {
                    const element = await page.$(`#${elementId}`);
                    if (element) {
                        console.log(`✅ Элемент ${elementId} найден`);
                    } else {
                        console.log(`❌ Элемент ${elementId} не найден`);
                    }
                }
                
                // Тестируем заполнение формы
                await page.type('#schedule-card-name', 'Автотест график');
                await page.type('#schedule-card-description', 'График созданный автотестом');
                
                console.log('✅ Форма заполнена');
                
                // Тестируем добавление даты
                const addDateBtn = await page.$('#add-work-date-btn');
                if (addDateBtn) {
                    console.log('➕ Тестирование добавления даты...');
                    await page.click('#add-work-date-btn');
                    await page.waitForTimeout(1000);
                    
                    const dateInput = await page.$('#temp-date-input');
                    if (dateInput) {
                        console.log('✅ Поле ввода даты появилось');
                        await page.type('#temp-date-input', '2025-06-10');
                        await page.click('button[onclick="confirmAddDate()"]');
                        await page.waitForTimeout(1000);
                        console.log('✅ Дата добавлена');
                    } else {
                        console.log('❌ Поле ввода даты не появилось');
                    }
                } else {
                    console.log('❌ Кнопка добавления даты не найдена');
                }
                
            } else {
                console.log('❌ Карточка графика не открылась');
            }
        } else {
            console.log('❌ Кнопка создания графика не найдена');
        }
        
        console.log('🎉 Тестирование завершено');
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.message);
    } finally {
        await browser.close();
    }
}

testMainSchedulesPage();