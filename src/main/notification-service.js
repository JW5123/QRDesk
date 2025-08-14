const { Notification, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');

class NotificationService {
    constructor() {
        this.translations = {};
        this.currentLocale = 'en';
        this.loadLocale();
    }

    async loadLocale() {
        // Detect system locale
        const locale = app.getLocale();
        const supportedLocales = {
            'zh-TW': 'zh-TW',
            'zh-HK': 'zh-TW', 
            'zh-CN': 'zh-CN',
            'en': 'en',
            'en-US': 'en',
            'en-GB': 'en',
            'ja': 'ja',
            'ja-JP': 'ja'
        };
        
        this.currentLocale = supportedLocales[locale] || (locale.split('-')[0] in supportedLocales ? supportedLocales[locale.split('-')[0]] : 'en');
        
        try {
            const localeFile = path.join(__dirname, '..', 'locales', `${this.currentLocale}.json`);
            const data = fs.readFileSync(localeFile, 'utf8');
            this.translations = JSON.parse(data);
        } catch (error) {
            console.error('Failed to load locale file:', error);
            // Fallback to English
            try {
                const localeFile = path.join(__dirname, '..', 'locales', 'en.json');
                const data = fs.readFileSync(localeFile, 'utf8');
                this.translations = JSON.parse(data);
            } catch (fallbackError) {
                console.error('Failed to load fallback locale:', fallbackError);
                this.translations = {};
            }
        }
    }

    t(key) {
        return this.translations[key] || key;
    }
    showSuccess(title, body, url = null) {
        this.showNotification(title, body, url);
    }

    showError(title, body) {
        this.showNotification(title, body);
    }

    showNotification(title, body, url = null) {
        if (!Notification.isSupported()) {
            console.log(this.t('notificationNotSupported') || 'Notification not supported');
            console.log(`${title}: ${body}`);
            return;
        }

        const notification = new Notification({
            title: title,
            body: this.truncateBody(body),
        });

        if (url && this.isValidUrl(url)) {
            const fullUrl = url.startsWith('www.') ? 'https://' + url : url;
            notification.on('click', () => {
                console.log(this.t('openingLink') || 'Opening link:', fullUrl);
                shell.openExternal(fullUrl);
            });
        }

        notification.show();

        setTimeout(() => {
            notification.close();
        }, 10000);
    }

    truncateBody(body) {
        return body.length > 100 ? body.substring(0, 97) + '...' : body;
    }

    isValidUrl(string) {
        return string.startsWith('http://') || 
                string.startsWith('https://') || 
                string.startsWith('www.');
    }
}

module.exports = NotificationService;
