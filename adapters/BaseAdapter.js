/**
 * Base Platform Adapter
 * Abstract base class for platform-specific implementations
 */

class BaseAdapter {
    constructor() {
        this.platform = 'base';
        this.features = {};
        this.initialized = false;
    }

    /**
     * Initialize the adapter
     * @returns {Promise<void>}
     */
    async init() {
        console.log(`🔧 Initializing ${this.platform} adapter...`);
        this.initialized = true;
    }

    /**
     * Check if adapter is ready
     * @returns {boolean}
     */
    isReady() {
        return this.initialized;
    }

    /**
     * Platform-specific navigation
     */
    
    /**
     * Show back button
     */
    showBackButton() {
        console.log(`${this.platform}: showBackButton() - not implemented`);
    }

    /**
     * Hide back button
     */
    hideBackButton() {
        console.log(`${this.platform}: hideBackButton() - not implemented`);
    }

    /**
     * Handle back button press
     * @param {Function} callback
     */
    onBackButtonClick(callback) {
        // Default browser back button
        window.addEventListener('popstate', callback);
    }

    /**
     * Platform-specific UI
     */
    
    /**
     * Show alert dialog
     * @param {string} message
     * @param {Function} callback
     */
    showAlert(message, callback) {
        alert(message);
        if (callback) callback();
    }

    /**
     * Show confirm dialog
     * @param {string} message
     * @param {Function} callback
     */
    showConfirm(message, callback) {
        const result = confirm(message);
        if (callback) callback(result);
        return result;
    }

    /**
     * Show loading indicator
     */
    showProgress() {
        console.log(`${this.platform}: showProgress() - not implemented`);
    }

    /**
     * Hide loading indicator
     */
    hideProgress() {
        console.log(`${this.platform}: hideProgress() - not implemented`);
    }

    /**
     * Platform-specific feedback
     */
    
    /**
     * Haptic feedback
     * @param {string} type - 'light', 'medium', 'heavy', 'success', 'warning', 'error'
     */
    hapticFeedback(type = 'light') {
        console.log(`${this.platform}: hapticFeedback(${type}) - not supported`);
    }

    /**
     * Platform-specific authentication
     */
    
    /**
     * Get user data from platform
     * @returns {Promise<object|null>}
     */
    async getUserData() {
        return null;
    }

    /**
     * Check if user is authenticated
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        return false;
    }

    /**
     * Platform-specific storage
     */
    
    /**
     * Save data to platform storage
     * @param {string} key
     * @param {any} value
     */
    async saveData(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    /**
     * Get data from platform storage
     * @param {string} key
     * @returns {Promise<any>}
     */
    async getData(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error('Storage error:', e);
            return null;
        }
    }

    /**
     * Remove data from platform storage
     * @param {string} key
     */
    async removeData(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    /**
     * Platform-specific styling
     */
    
    /**
     * Apply platform-specific styles
     */
    applyPlatformStyles() {
        document.body.classList.add(`platform-${this.platform}`);
    }

    /**
     * Set theme
     * @param {string} theme - 'light' or 'dark'
     */
    setTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
    }

    /**
     * Platform-specific utilities
     */
    
    /**
     * Open external link
     * @param {string} url
     */
    openLink(url) {
        window.open(url, '_blank');
    }

    /**
     * Share content
     * @param {object} data - {title, text, url}
     */
    async share(data) {
        if (navigator.share) {
            try {
                await navigator.share(data);
                return true;
            } catch (e) {
                console.error('Share failed:', e);
                return false;
            }
        }
        return false;
    }

    /**
     * Get platform info
     * @returns {object}
     */
    getInfo() {
        return {
            platform: this.platform,
            features: this.features,
            initialized: this.initialized,
            version: '1.0.0'
        };
    }

    /**
     * Platform-specific cleanup
     */
    destroy() {
        console.log(`🧹 Destroying ${this.platform} adapter...`);
        this.initialized = false;
    }
}