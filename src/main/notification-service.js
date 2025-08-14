const { Notification, shell } = require('electron');

class NotificationService {
    showSuccess(title, body, url = null) {
        this.showNotification(title, body, url);
    }

    showError(title, body) {
        this.showNotification(title, body);
    }

    showNotification(title, body, url = null) {
        if (!Notification.isSupported()) {
            console.log('系統不支援通知功能');
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
                console.log('開啟連結:', fullUrl);
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
