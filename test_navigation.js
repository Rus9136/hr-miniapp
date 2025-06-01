// Test script to check navigation functionality
// Run this in browser console on http://localhost:5555

console.log('=== Navigation Test Script ===');

// Check if all screens exist
const screens = ['loginScreen', 'menuScreen', 'mainScreen', 'newsScreen', 'salaryScreen', 'vacationScreen', 'hrScreen'];
console.log('\n1. Checking screens existence:');
screens.forEach(screenId => {
    const screen = document.getElementById(screenId);
    console.log(`  ${screenId}: ${screen ? '✅ exists' : '❌ missing'}`);
});

// Check if menu cards exist
console.log('\n2. Checking menu cards:');
const menuCards = document.querySelectorAll('.menu-card');
console.log(`  Found ${menuCards.length} menu cards`);
menuCards.forEach((card, index) => {
    const section = card.dataset.section;
    console.log(`  Card ${index + 1}: section="${section}"`);
});

// Check if navigation buttons exist
console.log('\n3. Checking navigation buttons:');
const backButtons = document.querySelectorAll('.btn-back');
console.log(`  Back buttons: ${backButtons.length}`);

const breadcrumbs = document.querySelectorAll('.breadcrumb-item[data-back]');
console.log(`  Breadcrumb links: ${breadcrumbs.length}`);

// Check logout buttons
console.log('\n4. Checking logout buttons:');
const logoutBtns = ['menuLogoutBtn', 'logoutBtn'];
logoutBtns.forEach(btnId => {
    const btn = document.getElementById(btnId);
    console.log(`  ${btnId}: ${btn ? '✅ exists' : '❌ missing'}`);
});

// Test showScreen function
console.log('\n5. Testing showScreen function:');
if (typeof showScreen === 'function') {
    console.log('  showScreen function: ✅ exists');
} else {
    console.log('  showScreen function: ❌ missing');
}

console.log('\n=== Test Complete ===');
console.log('To test manually:');
console.log('1. Enter АП00-00358 in login form');
console.log('2. Should see main menu with 5 cards');
console.log('3. Click cards to navigate between sections');
console.log('4. Use "Назад" buttons to return to menu');