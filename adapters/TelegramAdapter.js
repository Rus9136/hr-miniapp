/**
 * Telegram Platform Adapter
 * Implementation for Telegram Mini Apps
 */

class TelegramAdapter extends BaseAdapter {
    constructor() {
        super();
        this.platform = 'telegram';
        this.tg = window.Telegram?.WebApp;
        this.tgApp = window.tgApp; // Custom wrapper if exists
        
        this.features = {
            hasHapticFeedback: true,
            hasNativeNavigation: true,
            hasNativeAuth: true,
            hasPushNotifications: true,
            hasFileAccess: false,
            hasCamera: false,
            hasGeolocation: false,
            hasLocalStorage: true
        };
    }

    /**
     * Initialize Telegram-specific features
     */
    async init() {
        await super.init();
        
        if (!this.tg) {
            console.error('❌ Telegram WebApp not found!');
            throw new Error('Not running in Telegram');
        }
        
        // Apply Telegram-specific styles
        this.applyPlatformStyles();
        
        // Initialize Telegram webapp
        this.tg.ready();
        this.tg.expand();
        
        // Set theme
        this.setTheme(this.tg.colorScheme || 'light');
        
        // Set viewport
        this.tg.setHeaderColor(this.tg.themeParams.bg_color);
        this.tg.setBackgroundColor(this.tg.themeParams.bg_color);
        
        // Initialize back button handler
        this.initBackButton();
        
        console.log('✅ Telegram adapter initialized');
    }

    /**
     * Initialize back button handling
     */
    initBackButton() {
        this.tg.BackButton.onClick(() => {
            // Trigger custom back navigation
            if (window.handleBackNavigation) {
                window.handleBackNavigation();
            }
        });
    }

    /**
     * Show/hide back button
     */
    showBackButton() {
        if (this.tgApp?.showBackButton) {
            this.tgApp.showBackButton();
        } else if (this.tg?.BackButton) {
            this.tg.BackButton.show();
        }
    }

    hideBackButton() {
        if (this.tgApp?.hideBackButton) {
            this.tgApp.hideBackButton();
        } else if (this.tg?.BackButton) {
            this.tg.BackButton.hide();
        }
    }

    /**
     * Handle back button press
     */
    onBackButtonClick(callback) {
        if (this.tg?.BackButton) {
            this.tg.BackButton.onClick(callback);
        }
    }

    /**
     * Show Telegram alert
     */
    showAlert(message, callback) {
        if (this.tgApp?.showAlert) {
            this.tgApp.showAlert(message, callback);
        } else if (this.tg) {
            this.tg.showAlert(message, callback);
        } else {
            super.showAlert(message, callback);
        }
    }

    /**
     * Show Telegram confirm
     */
    showConfirm(message, callback) {
        if (this.tgApp?.showConfirm) {
            return this.tgApp.showConfirm(message, callback);
        } else if (this.tg) {
            this.tg.showConfirm(message, callback);
        } else {
            return super.showConfirm(message, callback);
        }
    }

    /**
     * Show Telegram popup
     */
    showPopup(params) {
        if (this.tg) {
            this.tg.showPopup(params);
        }
    }

    /**
     * Haptic feedback
     */
    hapticFeedback(type = 'light') {
        if (this.tgApp?.impactOccurred) {
            this.tgApp.impactOccurred(type);
        } else if (this.tg?.HapticFeedback) {
            switch (type) {
                case 'light':
                    this.tg.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    this.tg.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    this.tg.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'success':
                    this.tg.HapticFeedback.notificationOccurred('success');
                    break;
                case 'warning':
                    this.tg.HapticFeedback.notificationOccurred('warning');
                    break;
                case 'error':
                    this.tg.HapticFeedback.notificationOccurred('error');
                    break;
            }
        }
    }

    /**
     * Get Telegram user data
     */
    async getUserData() {
        if (this.tgApp?.getTelegramUser) {
            return this.tgApp.getTelegramUser();
        }
        
        if (this.tg?.initDataUnsafe?.user) {
            return this.tg.initDataUnsafe.user;
        }
        
        return null;
    }

    /**
     * Get init data for authentication
     */
    getInitData() {
        if (this.tgApp?.getInitData) {
            return this.tgApp.getInitData();
        }
        
        return this.tg?.initData || '';
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
        const initData = this.getInitData();
        return initData && initData !== '';
    }

    /**
     * Main button management
     */
    showMainButton(text, callback) {
        if (this.tg?.MainButton) {
            this.tg.MainButton.setText(text);
            this.tg.MainButton.onClick(callback);
            this.tg.MainButton.show();
        }
    }

    hideMainButton() {
        if (this.tg?.MainButton) {
            this.tg.MainButton.hide();
        }
    }

    /**
     * Enable/disable main button
     */
    setMainButtonEnabled(enabled) {
        if (this.tg?.MainButton) {
            if (enabled) {
                this.tg.MainButton.enable();
            } else {
                this.tg.MainButton.disable();
            }
        }
    }

    /**
     * Show/hide progress
     */
    showProgress() {
        if (this.tg?.MainButton) {
            this.tg.MainButton.showProgress();
        }
    }

    hideProgress() {
        if (this.tg?.MainButton) {
            this.tg.MainButton.hideProgress();
        }
    }

    /**
     * Theme management
     */
    setTheme(theme) {
        super.setTheme(theme);
        
        // Telegram automatically handles theme
        if (this.tg) {
            const isDark = theme === 'dark' || this.tg.colorScheme === 'dark';
            document.body.classList.toggle('dark-theme', isDark);
        }
    }

    /**
     * Open external link
     */
    openLink(url) {
        if (this.tg) {
            this.tg.openLink(url);
        } else {
            super.openLink(url);
        }
    }

    /**
     * Open Telegram link
     */
    openTelegramLink(url) {
        if (this.tg) {
            this.tg.openTelegramLink(url);
        }
    }

    /**
     * Close app
     */
    close() {
        if (this.tg) {
            this.tg.close();
        }
    }

    /**
     * Get platform info
     */
    getInfo() {
        const info = super.getInfo();
        
        // Add Telegram-specific info
        if (this.tg) {
            info.telegram = {
                version: this.tg.version,
                platform: this.tg.platform,
                colorScheme: this.tg.colorScheme,
                isExpanded: this.tg.isExpanded,
                viewportHeight: this.tg.viewportHeight,
                viewportStableHeight: this.tg.viewportStableHeight,
                user: this.tg.initDataUnsafe?.user || null
            };
        }
        
        return info;
    }

    /**
     * Request write access
     */
    async requestWriteAccess() {
        if (this.tg?.requestWriteAccess) {
            return await this.tg.requestWriteAccess();
        }
        return false;
    }

    /**
     * Request contact
     */
    async requestContact() {
        if (this.tg?.requestContact) {
            return await this.tg.requestContact();
        }
        return null;
    }

    /**
     * Send data to bot
     */
    sendData(data) {
        if (this.tg) {
            this.tg.sendData(data);
        }
    }

    /**
     * Ready to close
     */
    ready() {
        if (this.tg) {
            this.tg.ready();
        }
    }

    /**
     * Expand viewport
     */
    expand() {
        if (this.tg) {
            this.tg.expand();
        }
    }
}