/**
 * iOS WebView Platform Adapter
 * Implementation for iOS native app WebView
 */

class IOSAdapter extends BaseAdapter {
    constructor() {
        super();
        this.platform = 'ios';
        this.bridge = window.webkit?.messageHandlers;
        
        this.features = {
            hasHapticFeedback: !!this.bridge?.haptic,
            hasNativeNavigation: !!this.bridge?.navigation,
            hasNativeAuth: !!this.bridge?.auth,
            hasPushNotifications: !!this.bridge?.push,
            hasFileAccess: !!this.bridge?.files,
            hasCamera: !!this.bridge?.camera,
            hasGeolocation: !!this.bridge?.location,
            hasLocalStorage: true,
            hasBiometrics: !!this.bridge?.biometrics
        };
        
        // iOS-specific callbacks registry
        this.callbacks = new Map();
        this.callbackId = 0;
    }

    /**
     * Initialize iOS-specific features
     */
    async init() {
        await super.init();
        
        // Apply iOS-specific styles
        this.applyPlatformStyles();
        this.applySafeArea();
        
        // Register global callback handler
        window.iosCallback = this.handleCallback.bind(this);
        
        // Notify iOS app that web view is ready
        this.sendMessage('ready', { version: '1.0.0' });
        
        // Get initial configuration from iOS
        const config = await this.getConfiguration();
        if (config) {
            this.applyConfiguration(config);
        }
        
        // Set up native navigation
        this.setupNativeNavigation();
        
        console.log('✅ iOS adapter initialized');
    }

    /**
     * Apply safe area insets for iPhone X+
     */
    applySafeArea() {
        // Add CSS variables for safe areas
        const style = document.createElement('style');
        style.innerHTML = `
            .platform-ios {
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
                padding-left: env(safe-area-inset-left);
                padding-right: env(safe-area-inset-right);
            }
            
            .platform-ios .header {
                padding-top: calc(20px + env(safe-area-inset-top));
            }
            
            .platform-ios .bottom-nav {
                padding-bottom: calc(10px + env(safe-area-inset-bottom));
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Send message to iOS native app
     */
    sendMessage(handler, data) {
        if (this.bridge && this.bridge[handler]) {
            this.bridge[handler].postMessage(data);
        } else {
            console.warn(`iOS handler '${handler}' not available`);
        }
    }

    /**
     * Send message with callback
     */
    sendMessageWithCallback(handler, data) {
        return new Promise((resolve, reject) => {
            const callbackId = ++this.callbackId;
            
            // Store callback
            this.callbacks.set(callbackId, { resolve, reject });
            
            // Send message with callback ID
            this.sendMessage(handler, { ...data, callbackId });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.callbacks.has(callbackId)) {
                    this.callbacks.delete(callbackId);
                    reject(new Error('iOS callback timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Handle callback from iOS
     */
    handleCallback(callbackId, success, data) {
        const callback = this.callbacks.get(callbackId);
        if (callback) {
            this.callbacks.delete(callbackId);
            if (success) {
                callback.resolve(data);
            } else {
                callback.reject(new Error(data || 'iOS callback error'));
            }
        }
    }

    /**
     * Get configuration from iOS app
     */
    async getConfiguration() {
        try {
            return await this.sendMessageWithCallback('getConfiguration', {});
        } catch (e) {
            console.error('Failed to get iOS configuration:', e);
            return null;
        }
    }

    /**
     * Apply configuration from iOS
     */
    applyConfiguration(config) {
        if (config.theme) {
            this.setTheme(config.theme);
        }
        
        if (config.locale) {
            document.documentElement.lang = config.locale;
        }
        
        if (config.fontSize) {
            document.documentElement.style.fontSize = config.fontSize + 'px';
        }
    }

    /**
     * Setup native navigation
     */
    setupNativeNavigation() {
        // Override browser back behavior
        window.addEventListener('popstate', (e) => {
            e.preventDefault();
            this.sendMessage('navigation', { action: 'back' });
        });
    }

    /**
     * Show/hide native navigation bar
     */
    showBackButton() {
        this.sendMessage('navigation', { action: 'showBackButton' });
    }

    hideBackButton() {
        this.sendMessage('navigation', { action: 'hideBackButton' });
    }

    /**
     * Native alert dialog
     */
    showAlert(message, callback) {
        this.sendMessageWithCallback('alert', { message })
            .then(() => callback && callback())
            .catch(() => super.showAlert(message, callback));
    }

    /**
     * Native confirm dialog
     */
    showConfirm(message, callback) {
        this.sendMessageWithCallback('confirm', { message })
            .then(result => callback && callback(result))
            .catch(() => super.showConfirm(message, callback));
    }

    /**
     * Native action sheet
     */
    async showActionSheet(options) {
        try {
            return await this.sendMessageWithCallback('actionSheet', options);
        } catch (e) {
            console.error('Action sheet failed:', e);
            return null;
        }
    }

    /**
     * Haptic feedback
     */
    hapticFeedback(type = 'light') {
        this.sendMessage('haptic', { type });
    }

    /**
     * Get user data from iOS app
     */
    async getUserData() {
        try {
            return await this.sendMessageWithCallback('auth', { action: 'getUserData' });
        } catch (e) {
            console.error('Failed to get user data:', e);
            return null;
        }
    }

    /**
     * Authenticate with biometrics
     */
    async authenticateWithBiometrics(reason) {
        if (!this.features.hasBiometrics) {
            return false;
        }
        
        try {
            const result = await this.sendMessageWithCallback('biometrics', { 
                action: 'authenticate',
                reason: reason || 'Подтвердите вашу личность'
            });
            return result.success;
        } catch (e) {
            console.error('Biometric authentication failed:', e);
            return false;
        }
    }

    /**
     * Request camera access
     */
    async requestCamera() {
        if (!this.features.hasCamera) {
            return false;
        }
        
        try {
            const result = await this.sendMessageWithCallback('camera', { action: 'request' });
            return result.granted;
        } catch (e) {
            console.error('Camera request failed:', e);
            return false;
        }
    }

    /**
     * Take photo
     */
    async takePhoto(options = {}) {
        if (!this.features.hasCamera) {
            return null;
        }
        
        try {
            return await this.sendMessageWithCallback('camera', { 
                action: 'takePhoto',
                options
            });
        } catch (e) {
            console.error('Take photo failed:', e);
            return null;
        }
    }

    /**
     * Select file from iOS
     */
    async selectFile(options = {}) {
        if (!this.features.hasFileAccess) {
            return null;
        }
        
        try {
            return await this.sendMessageWithCallback('files', { 
                action: 'select',
                options
            });
        } catch (e) {
            console.error('File selection failed:', e);
            return null;
        }
    }

    /**
     * Share content via iOS share sheet
     */
    async share(data) {
        try {
            await this.sendMessageWithCallback('share', data);
            return true;
        } catch (e) {
            console.error('Share failed:', e);
            return false;
        }
    }

    /**
     * Open URL in iOS
     */
    openLink(url) {
        this.sendMessage('openURL', { url });
    }

    /**
     * Show/hide loading
     */
    showProgress() {
        this.sendMessage('loading', { show: true });
    }

    hideProgress() {
        this.sendMessage('loading', { show: false });
    }

    /**
     * Set status bar style
     */
    setStatusBarStyle(style) {
        this.sendMessage('statusBar', { style }); // 'light' or 'dark'
    }

    /**
     * iOS-specific theme handling
     */
    setTheme(theme) {
        super.setTheme(theme);
        
        // Update status bar
        this.setStatusBarStyle(theme === 'dark' ? 'light' : 'dark');
        
        // Notify iOS app
        this.sendMessage('theme', { theme });
    }

    /**
     * Get device info
     */
    async getDeviceInfo() {
        try {
            return await this.sendMessageWithCallback('device', { action: 'getInfo' });
        } catch (e) {
            console.error('Failed to get device info:', e);
            return null;
        }
    }

    /**
     * Get platform info
     */
    getInfo() {
        const info = super.getInfo();
        
        // Add iOS-specific info
        info.ios = {
            hasMessageHandlers: !!this.bridge,
            availableHandlers: this.bridge ? Object.keys(this.bridge) : [],
            features: this.features,
            safeAreaSupport: CSS.supports('padding-top', 'env(safe-area-inset-top)')
        };
        
        return info;
    }

    /**
     * Request permissions
     */
    async requestPermission(permission) {
        try {
            const result = await this.sendMessageWithCallback('permissions', { 
                action: 'request',
                permission
            });
            return result.granted;
        } catch (e) {
            console.error('Permission request failed:', e);
            return false;
        }
    }

    /**
     * Clean up
     */
    destroy() {
        super.destroy();
        
        // Clear callbacks
        this.callbacks.clear();
        
        // Remove global callback handler
        delete window.iosCallback;
        
        // Notify iOS app
        this.sendMessage('destroy', {});
    }
}