const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testTelegramAPI() {
    try {
        console.log('🧪 Тестируем Telegram API напрямую...');
        
        const API_BASE_URL = 'http://localhost:3030/api';
        const testIIN = '951026301058';
        
        // Тестируем /telegram/link эндпоинт
        console.log('📡 Тестируем /telegram/link...');
        
        const linkResponse = await fetch(`${API_BASE_URL}/telegram/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                initData: 'dev_mode', // Используем dev mode
                employeeIIN: testIIN 
            })
        });
        
        console.log('Status:', linkResponse.status);
        console.log('Headers:', Object.fromEntries(linkResponse.headers.entries()));
        
        const linkResult = await linkResponse.json();
        console.log('Response body:', JSON.stringify(linkResult, null, 2));
        
        if (linkResult.success) {
            console.log('✅ Привязка прошла успешно');
            
            // Теперь тестируем /telegram/auth
            console.log('\\n📡 Тестируем /telegram/auth...');
            
            const authResponse = await fetch(`${API_BASE_URL}/telegram/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: 'dev_mode' })
            });
            
            console.log('Auth Status:', authResponse.status);
            const authResult = await authResponse.json();
            console.log('Auth Response:', JSON.stringify(authResult, null, 2));
            
            if (authResult.success) {
                console.log('✅ Автоматическая авторизация прошла успешно');
            } else {
                console.log('❌ Автоматическая авторизация не удалась');
            }
        } else {
            console.log('❌ Привязка не удалась:', linkResult.error);
        }
        
    } catch (error) {
        console.error('❌ Ошибка теста:', error);
    }
}

testTelegramAPI();