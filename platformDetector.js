/**
 * Platform Detection Module
 * Detects current platform: web, telegram, or ios
 */

const PlatformDetector = {
    // Platform constants
    PLATFORMS: {
        WEB: 'web',
        TELEGRAM: 'telegram',
        IOS: 'ios'
    },

    // Cached platform result
    _cachedPlatform: null,

    /**
     * Main detection function
     * @returns {string} Platform identifier
     */
    detect() {
        // Return cached result if available
        if (this._cachedPlatform) {
            return this._cachedPlatform;
        }

        // 1. Check for Telegram WebApp
        if (this.isTelegramWebApp()) {
            this._cachedPlatform = this.PLATFORMS.TELEGRAM;
            console.log('🔍 Platform detected: Telegram Mini App');
            return this._cachedPlatform;
        }

        // 2. Check for iOS WebView
        if (this.isIOSWebView()) {
            this._cachedPlatform = this.PLATFORMS.IOS;
            console.log('🔍 Platform detected: iOS WebView');
            return this._cachedPlatform;
        }

        // 3. Default to web
        this._cachedPlatform = this.PLATFORMS.WEB;
        console.log('🔍 Platform detected: Web Browser');
        return this._cachedPlatform;
    },

    /**
     * Check if running in Telegram WebApp
     * @returns {boolean}
     */
    isTelegramWebApp() {
        // Check for Telegram WebApp object
        if (window.Telegram?.WebApp?.initData) {
            return true;
        }

        // Check for our custom tgApp wrapper
        if (window.tgApp?.isInTelegram) {
            return true;
        }

        return false;
    },

    /**
     * Check if running in iOS WebView
     * @returns {boolean}
     */
    isIOSWebView() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;

        // 1. Check if it's iOS device
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
        
        if (!isIOS) {
            return false;
        }

        // 2. Check for WebView indicators
        // In iOS WebView, we typically don't see Safari in the user agent
        const isSafari = /Safari/.test(userAgent);
        const isChrome = /CriOS/.test(userAgent);
        const isFirefox = /FxiOS/.test(userAgent);
        const isOpera = /OPiOS/.test(userAgent);

        // If it's iOS but not any known browser, it's likely a WebView
        if (!isSafari && !isChrome && !isFirefox && !isOpera) {
            return true;
        }

        // 3. Check for specific WebView patterns
        const webViewPatterns = [
            /WebView/,
            /(iPhone|iPod|iPad)(?!.*Safari)/,
            /AppleWebKit(?!.*Safari)/,
            /Mobile\/[\w]+ \(/
        ];

        const hasWebViewPattern = webViewPatterns.some(pattern => pattern.test(userAgent));
        
        // 4. Check for iOS JavaScript bridge
        if (window.webkit?.messageHandlers) {
            return true;
        }

        // 5. Check for standalone mode (installed PWA)
        if (window.navigator.standalone === true) {
            return false; // This is PWA, not WebView
        }

        return hasWebViewPattern;
    },

    /**
     * Get platform-specific features
     * @returns {object} Feature capabilities
     */
    getFeatures() {
        const platform = this.detect();
        
        const features = {
            platform: platform,
            hasHapticFeedback: false,
            hasNativeNavigation: false,
            hasNativeAuth: false,
            hasPushNotifications: false,
            hasFileAccess: false,
            hasCamera: false,
            hasGeolocation: true,
            hasLocalStorage: true
        };

        switch (platform) {
            case this.PLATFORMS.TELEGRAM:
                features.hasHapticFeedback = true;
                features.hasNativeNavigation = true;
                features.hasNativeAuth = true;
                features.hasPushNotifications = true;
                break;
                
            case this.PLATFORMS.IOS:
                features.hasHapticFeedback = !!window.webkit?.messageHandlers?.haptic;
                features.hasNativeNavigation = !!window.webkit?.messageHandlers?.navigation;
                features.hasNativeAuth = !!window.webkit?.messageHandlers?.auth;
                features.hasPushNotifications = !!window.webkit?.messageHandlers?.push;
                features.hasCamera = !!window.webkit?.messageHandlers?.camera;
                features.hasFileAccess = !!window.webkit?.messageHandlers?.files;
                break;
                
            case this.PLATFORMS.WEB:
                // Check for web capabilities
                features.hasPushNotifications = 'Notification' in window;
                features.hasCamera = !!(navigator.mediaDevices?.getUserMedia);
                break;
        }

        return features;
    },

    /**
     * Get platform info for debugging
     * @returns {object} Platform information
     */
    getInfo() {
        return {
            platform: this.detect(),
            userAgent: navigator.userAgent,
            isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
            isTelegram: this.isTelegramWebApp(),
            isWebView: this.isIOSWebView(),
            features: this.getFeatures(),
            screen: {
                width: window.screen.width,
                height: window.screen.height,
                pixelRatio: window.devicePixelRatio
            }
        };
    },

    /**
     * Reset cached platform (useful for testing)
     */
    reset() {
        this._cachedPlatform = null;
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlatformDetector;
}