const https = require('https');

// Test data mimicking 1C request
const testData = {
    "ДатаВыгрузки": "2025-08-14",
    "КоличествоГрафиков": 1,
    "Графики": [
        {
            "НаименованиеГрафика": "Тестовый график 8:00-17:00",
            "КодГрафика": "TEST001",
            "РабочиеДни": [
                {
                    "Дата": "2025-08-14",
                    "Месяц": "Август 2025",
                    "ВидУчетаВремени": "Р",
                    "ДополнительноеЗначение": 8,
                    "ВремяНачалоРаботы": "08:00",
                    "ВремяЗавершениеРаботы": "17:00"
                }
            ]
        }
    ]
};

const postData = JSON.stringify(testData);

const options = {
    hostname: 'madlen.space',
    port: 443,
    path: '/api/admin/schedules/import-1c',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': '1C+Enterprise/8.3'
    }
};

console.log('Sending test request to:', options.hostname + options.path);
console.log('Data size:', Buffer.byteLength(postData), 'bytes');

const req = https.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('Response:', data);
        if (res.statusCode === 200) {
            console.log('✅ Import successful!');
        } else {
            console.log('❌ Import failed with status:', res.statusCode);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

// Set timeout to 5 minutes
req.setTimeout(300000, () => {
    console.error('Request timeout after 5 minutes');
    req.destroy();
});

// Write data to request body
req.write(postData);
req.end();