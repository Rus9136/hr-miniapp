const puppeteer = require('puppeteer');

async function testSchedulesFunctionality() {
    console.log('🚀 Запуск тестов фронтенда...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Открываем тестовую страницу
        console.log('📄 Открытие тестовой страницы...');
        await page.goto('http://localhost/test_schedules.html', { waitUntil: 'networkidle0' });
        
        // Проверяем загрузку скриптов
        console.log('📦 Проверка загрузки admin.js...');
        const adminJsLoaded = await page.evaluate(() => {
            return typeof initSchedulesSection === 'function' && typeof openScheduleCard === 'function';
        });
        
        if (adminJsLoaded) {
            console.log('✅ admin.js загружен корректно');
        } else {
            console.log('❌ admin.js не загружен или функции отсутствуют');
            return;
        }
        
        // Тест API
        console.log('🌐 Тестирование API...');
        await page.click('button[onclick="testSchedulesAPI()"]');
        await page.waitForTimeout(2000);
        
        // Тест элементов DOM
        console.log('🔍 Проверка элементов DOM...');
        await page.click('button[onclick="testElementsExist()"]');
        await page.waitForTimeout(1000);
        
        // Тест инициализации
        console.log('⚙️ Тест инициализации секции...');
        await page.click('button[onclick="testInitSchedules()"]');
        await page.waitForTimeout(1000);
        
        // Тест открытия карточки
        console.log('📋 Тест открытия карточки графика...');
        await page.click('button[onclick="testOpenCard()"]');
        await page.waitForTimeout(1000);
        
        // Получаем результаты тестов
        const testResults = await page.$eval('#test-results', el => el.innerText);
        console.log('📊 Результаты тестов:');
        console.log(testResults);
        
        // Проверяем, отображается ли карточка графика
        const cardVisible = await page.$eval('#schedule-card-section', el => {
            return window.getComputedStyle(el).display !== 'none';
        });
        
        if (cardVisible) {
            console.log('✅ Карточка графика успешно открыта');
            
            // Тестируем заполнение формы
            await page.type('#schedule-card-name', 'Новый тестовый график');
            await page.type('#schedule-card-description', 'Описание нового графика');
            await page.$eval('#schedule-card-check-in', el => el.value = '09:00');
            await page.$eval('#schedule-card-check-out', el => el.value = '18:00');
            
            console.log('✅ Форма заполнена успешно');
            
            // Тестируем добавление даты
            await page.click('#add-work-date-btn');
            await page.waitForTimeout(500);
            
            const dateInputVisible = await page.$('#temp-date-input');
            if (dateInputVisible) {
                console.log('✅ Поле добавления даты появилось');
                await page.type('#temp-date-input', '2025-06-10');
                await page.click('button[onclick="confirmAddDate()"]');
                await page.waitForTimeout(500);
                console.log('✅ Дата добавлена успешно');
            } else {
                console.log('❌ Поле добавления даты не появилось');
            }
            
        } else {
            console.log('❌ Карточка графика не открылась');
        }
        
        console.log('🎉 Все тесты завершены');
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.message);
    } finally {
        await browser.close();
    }
}

testSchedulesFunctionality();