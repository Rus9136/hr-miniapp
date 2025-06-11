/**
 * Web Platform Adapter
 * Implementation for standard web browsers
 */

class WebAdapter extends BaseAdapter {
    constructor() {
        super();
        this.platform = 'web';
        this.features = {
            hasHapticFeedback: false,
            hasNativeNavigation: false,
            hasNativeAuth: false,
            hasPushNotifications: 'Notification' in window,
            hasFileAccess: true,
            hasCamera: !!(navigator.mediaDevices?.getUserMedia),
            hasGeolocation: 'geolocation' in navigator,
            hasLocalStorage: 'localStorage' in window
        };
    }

    /**
     * Initialize web-specific features
     */
    async init() {
        await super.init();
        
        // Apply web-specific styles
        this.applyPlatformStyles();
        
        // Initialize browser navigation
        this.initBrowserNavigation();
        
        // Check for saved credentials
        await this.checkSavedCredentials();
        
        console.log('✅ Web adapter initialized');
    }

    /**
     * Initialize browser navigation handling
     */
    initBrowserNavigation() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.screen) {
                // Navigate to the screen from history
                this.navigateToScreen(event.state.screen);
            }
        });

        // Save initial state
        if (!window.history.state) {
            window.history.replaceState({ screen: 'login' }, '', window.location.href);
        }
    }

    /**
     * Navigate to screen with history management
     * @param {string} screenName
     */
    navigateToScreen(screenName) {
        // This will be implemented by the main app
        if (window.navigateToScreen) {
            window.navigateToScreen(screenName);
        }
    }

    /**
     * Show/hide back button (no-op for web)
     */
    showBackButton() {
        // Web uses browser back button
    }

    hideBackButton() {
        // Web uses browser back button
    }

    /**
     * Web-specific alert with better styling
     */
    showAlert(message, callback) {
        // Check if we have a custom modal implementation
        if (window.showCustomAlert) {
            window.showCustomAlert(message, callback);
        } else {
            // Fallback to native alert
            super.showAlert(message, callback);
        }
    }

    /**
     * Web-specific confirm with better styling
     */
    showConfirm(message, callback) {
        // Check if we have a custom modal implementation
        if (window.showCustomConfirm) {
            window.showCustomConfirm(message, callback);
        } else {
            // Fallback to native confirm
            return super.showConfirm(message, callback);
        }
    }

    /**
     * Show loading spinner
     */
    showProgress() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = 'flex';
        } else {
            // Create a simple loading indicator
            const loader = document.createElement('div');
            loader.id = 'loadingSpinner';
            loader.className = 'loading-spinner';
            loader.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loader);
        }
    }

    /**
     * Hide loading spinner
     */
    hideProgress() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
    }

    /**
     * Check for saved credentials
     */
    async checkSavedCredentials() {
        try {
            const savedIIN = await this.getData('savedIIN');
            const rememberMe = await this.getData('rememberMe');
            
            if (savedIIN && rememberMe) {
                // Pre-fill login form
                const iinInput = document.getElementById('employeeId');
                if (iinInput) {
                    iinInput.value = savedIIN;
                }
            }
        } catch (e) {
            console.error('Error checking saved credentials:', e);
        }
    }

    /**
     * Save credentials if remember me is checked
     */
    async saveCredentials(iin, remember) {
        if (remember) {
            await this.saveData('savedIIN', iin);
            await this.saveData('rememberMe', true);
        } else {
            await this.removeData('savedIIN');
            await this.removeData('rememberMe');
        }
    }

    /**
     * Web-specific theme handling
     */
    setTheme(theme) {
        super.setTheme(theme);
        
        // Save theme preference
        this.saveData('preferredTheme', theme);
        
        // Update meta theme-color
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = theme === 'dark' ? '#1a1a1a' : '#ffffff';
        }
    }

    /**
     * Check for PWA installation
     */
    async checkPWAInstallation() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                return !!registration;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    /**
     * Prompt PWA installation
     */
    async promptInstall() {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;
            console.log(`PWA installation ${outcome}`);
            window.deferredPrompt = null;
            return outcome === 'accepted';
        }
        return false;
    }

    /**
     * Web-specific share with fallback
     */
    async share(data) {
        // Try native share first
        const shared = await super.share(data);
        
        if (!shared) {
            // Fallback: copy to clipboard
            const text = `${data.title}\n${data.text}\n${data.url}`;
            try {
                await navigator.clipboard.writeText(text);
                this.showAlert('Ссылка скопирована в буфер обмена');
                return true;
            } catch (e) {
                console.error('Copy failed:', e);
                return false;
            }
        }
        
        return shared;
    }

    /**
     * Handle file uploads
     */
    async selectFile(accept = '*/*') {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            
            input.onchange = (event) => {
                const file = event.target.files[0];
                resolve(file || null);
            };
            
            input.click();
        });
    }

    /**
     * Get platform-specific info
     */
    getInfo() {
        const info = super.getInfo();
        
        // Add web-specific info
        info.browser = {
            name: this.getBrowserName(),
            version: this.getBrowserVersion(),
            isMobile: this.isMobileBrowser(),
            isPWA: window.matchMedia('(display-mode: standalone)').matches
        };
        
        return info;
    }

    /**
     * Detect browser name
     */
    getBrowserName() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
    }

    /**
     * Detect browser version
     */
    getBrowserVersion() {
        const ua = navigator.userAgent;
        const match = ua.match(/(Chrome|Safari|Firefox|Edge)\/(\d+)/);
        return match ? match[2] : 'Unknown';
    }

    /**
     * Check if mobile browser
     */
    isMobileBrowser() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
}