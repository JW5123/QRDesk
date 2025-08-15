// 通知管理器
export class NotificationManager {
    constructor() {
        this.setupCloseHandler();
    }

    /**
     * 顯示通知
     */
    show(message, type = 'info') {
        const notification = document.getElementById('notification');
        const messageEl = document.getElementById('notification-message');
        
        messageEl.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.remove('hidden');

        // 自動隱藏
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    /**
     * 設定關閉處理器
     */
    setupCloseHandler() {
        // 手動關閉
        document.getElementById('notification-close').onclick = () => {
            const notification = document.getElementById('notification');
            notification.classList.add('hidden');
        };
    }

    /**
     * 顯示成功通知
     */
    success(message) {
        this.show(message, 'success');
    }

    /**
     * 顯示錯誤通知
     */
    error(message) {
        this.show(message, 'error');
    }

    /**
     * 顯示警告通知
     */
    warning(message) {
        this.show(message, 'warning');
    }

    /**
     * 顯示資訊通知
     */
    info(message) {
        this.show(message, 'info');
    }
}
