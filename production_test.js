/**
 * Production Test Script for iOS WebView Integration
 * Run this in browser console to test platform detection and adapters
 */

(async function testProduction() {
    console.log('🧪 Starting production test...');
    
    const results = {
        scriptsLoaded: false,
        platformDetected: null,
        adapterCreated: false,
        adapterInitialized: false,
        loginTested: false,
        error: null
    };
    
    try {
        // Test 1: Check if scripts are loaded
        console.log('📦 Testing script loading...');
        const scriptsOk = !!(
            typeof PlatformDetector !== 'undefined' &&
            typeof BaseAdapter !== 'undefined' &&
            typeof WebAdapter !== 'undefined' &&
            typeof TelegramAdapter !== 'undefined' &&
            typeof IOSAdapter !== 'undefined'
        );
        
        results.scriptsLoaded = scriptsOk;
        console.log(scriptsOk ? '✅ All scripts loaded' : '❌ Some scripts missing');
        
        if (!scriptsOk) {
            throw new Error('Required scripts not loaded');
        }
        
        // Test 2: Platform detection
        console.log('🔍 Testing platform detection...');
        const platform = PlatformDetector.detect();
        const info = PlatformDetector.getInfo();
        
        results.platformDetected = platform;
        console.log(`✅ Platform detected: ${platform}`);
        console.log('📊 Platform info:', info);
        
        // Test 3: Create adapter
        console.log('🔧 Creating platform adapter...');
        let testAdapter;
        
        switch (platform) {
            case PlatformDetector.PLATFORMS.TELEGRAM:
                testAdapter = new TelegramAdapter();
                break;
            case PlatformDetector.PLATFORMS.IOS:
                testAdapter = new IOSAdapter();
                break;
            default:
                testAdapter = new WebAdapter();
        }
        
        results.adapterCreated = true;
        console.log(`✅ ${platform} adapter created`);
        
        // Test 4: Initialize adapter
        console.log('⚡ Initializing adapter...');
        await testAdapter.init();
        
        results.adapterInitialized = true;
        console.log('✅ Adapter initialized successfully');
        
        // Test 5: Test adapter methods
        console.log('🧪 Testing adapter methods...');
        
        // Test haptic feedback (safe for all platforms)
        try {
            testAdapter.hapticFeedback('light');
            console.log('✅ Haptic feedback test completed');
        } catch (e) {
            console.log('⚠️ Haptic feedback not available:', e.message);
        }
        
        // Test platform features
        const adapterInfo = testAdapter.getInfo();
        console.log('📱 Adapter features:', adapterInfo.features);
        
        // Test 6: Check if global adapter is available
        if (window.platformAdapter) {
            console.log('✅ Global platform adapter available');
            console.log('🌐 Current platform from global:', window.currentPlatform);
        } else {
            console.log('⚠️ Global platform adapter not set');
        }
        
        // Test 7: Test login (safe test)
        console.log('🔐 Testing login functionality...');
        try {
            const testIIN = '123456789012';
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ iin: testIIN })
            });
            
            const result = await response.json();
            if (result.fullName) {
                results.loginTested = true;
                console.log(`✅ Login API works: ${result.fullName}`);
            } else {
                console.log('⚠️ Login test failed:', result);
            }
        } catch (e) {
            console.log('⚠️ Login test error:', e.message);
        }
        
        console.log('🎉 Production test completed successfully!');
        console.log('📋 Final results:', results);
        
        return results;
        
    } catch (error) {
        results.error = error.message;
        console.error('❌ Production test failed:', error);
        console.log('📋 Results with error:', results);
        return results;
    }
})().then(results => {
    // Make results available globally
    window.productionTestResults = results;
    console.log('💾 Test results saved to window.productionTestResults');
});