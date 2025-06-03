// Telegram Web App Integration

class TelegramWebApp {
    constructor() {
        this.isInTelegram = this.detectTelegram();
        this.webapp = this.isInTelegram ? window.Telegram.WebApp : null;
        this.init();
    }

    detectTelegram() {
        return typeof window !== 'undefined' && 
               window.Telegram && 
               window.Telegram.WebApp && 
               window.Telegram.WebApp.initData;
    }

    init() {
        if (this.isInTelegram) {
            console.log('🚀 Running in Telegram Mini App');
            
            // Initialize Telegram WebApp
            this.webapp.ready();
            this.webapp.expand();
            
            // Set theme
            this.setTelegramTheme();
            
            // Enable closing confirmation
            this.webapp.enableClosingConfirmation();
            
            // Setup back button
            this.setupBackButton();
            
            // Setup main button
            this.setupMainButton();
            
            console.log('Telegram user:', this.getUserInfo());
        } else {
            console.log('🌐 Running in web browser');
        }
    }

    setTelegramTheme() {
        if (!this.isInTelegram) return;

        const themeParams = this.webapp.themeParams;
        document.documentElement.style.setProperty('--tg-bg-color', themeParams.bg_color || '#ffffff');
        document.documentElement.style.setProperty('--tg-text-color', themeParams.text_color || '#000000');
        document.documentElement.style.setProperty('--tg-hint-color', themeParams.hint_color || '#999999');
        document.documentElement.style.setProperty('--tg-link-color', themeParams.link_color || '#2481cc');
        document.documentElement.style.setProperty('--tg-button-color', themeParams.button_color || '#2481cc');
        document.documentElement.style.setProperty('--tg-button-text-color', themeParams.button_text_color || '#ffffff');
        
        // Apply telegram theme class
        document.body.classList.add('telegram-theme');
    }

    getUserInfo() {
        if (!this.isInTelegram) return null;

        const initDataUnsafe = this.webapp.initDataUnsafe;
        return {
            id: initDataUnsafe.user?.id,
            first_name: initDataUnsafe.user?.first_name,
            last_name: initDataUnsafe.user?.last_name,
            username: initDataUnsafe.user?.username,
            language_code: initDataUnsafe.user?.language_code,
            is_premium: initDataUnsafe.user?.is_premium
        };
    }

    getInitData() {
        if (!this.isInTelegram) return null;
        return this.webapp.initData;
    }

    setupBackButton() {
        if (!this.isInTelegram) return;

        this.webapp.BackButton.onClick(() => {
            this.handleBackButton();
        });
    }

    setupMainButton() {
        if (!this.isInTelegram) return;

        this.webapp.MainButton.setParams({
            text: 'Готово',
            is_visible: false
        });
    }

    showBackButton() {
        if (this.isInTelegram) {
            this.webapp.BackButton.show();
        }
    }

    hideBackButton() {
        if (this.isInTelegram) {
            this.webapp.BackButton.hide();
        }
    }

    showMainButton(text, callback) {
        if (this.isInTelegram) {
            this.webapp.MainButton.setParams({
                text: text,
                is_visible: true
            });
            this.webapp.MainButton.onClick(callback);
        }
    }

    hideMainButton() {
        if (this.isInTelegram) {
            this.webapp.MainButton.hide();
        }
    }

    handleBackButton() {
        // Emit custom event for app navigation
        window.dispatchEvent(new CustomEvent('telegram-back-button'));
    }

    sendData(data) {
        if (this.isInTelegram) {
            this.webapp.sendData(JSON.stringify(data));
        }
    }

    close() {
        if (this.isInTelegram) {
            this.webapp.close();
        }
    }

    showAlert(message) {
        if (this.isInTelegram) {
            this.webapp.showAlert(message);
        } else {
            alert(message);
        }
    }

    showConfirm(message, callback) {
        if (this.isInTelegram) {
            this.webapp.showConfirm(message, callback);
        } else {
            const result = confirm(message);
            callback(result);
        }
    }

    impactOccurred(style = 'medium') {
        if (this.isInTelegram) {
            this.webapp.HapticFeedback.impactOccurred(style);
        }
    }

    notificationOccurred(type = 'success') {
        if (this.isInTelegram) {
            this.webapp.HapticFeedback.notificationOccurred(type);
        }
    }

    selectionChanged() {
        if (this.isInTelegram) {
            this.webapp.HapticFeedback.selectionChanged();
        }
    }

    // Platform detection helpers
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }

    isAndroid() {
        return /Android/.test(navigator.userAgent);
    }

    // Safe area helpers for iOS
    getSafeAreaInsets() {
        if (this.isIOS()) {
            return {
                top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')) || 0,
                bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0,
                left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-left')) || 0,
                right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-right')) || 0
            };
        }
        return { top: 0, bottom: 0, left: 0, right: 0 };
    }
}

// Initialize Telegram WebApp
const tgApp = new TelegramWebApp();

// Export for use in other scripts
window.tgApp = tgApp;