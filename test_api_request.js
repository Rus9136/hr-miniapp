const axios = require('axios');

// Тестовые параметры из вашего запроса
const params = {
  tableNumber: 'АП00-00231',
  dateStart: '2025-05-01',
  dateStop: '2025-05-31',
  objectBIN: '241240023631'
};

const url = 'http://tco.aqnietgroup.com:5555/v1/event/filter';

console.log('Making request to:', url);
console.log('With params:', params);

axios.get(url, { params })
  .then(response => {
    console.log(`\nReceived ${response.data.length} events`);
    if (response.data.length > 0) {
      console.log('\nFirst 5 events:');
      response.data.slice(0, 5).forEach(event => {
        console.log(`  ${event.event_datetime} - type: ${event.event} - code: ${event.object_code}`);
      });
    }
  })
  .catch(error => {
    console.error('Request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  });