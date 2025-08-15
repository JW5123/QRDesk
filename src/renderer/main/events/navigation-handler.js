// 導航事件處理器
export class NavigationHandler {
    constructor(app) {
        this.app = app;
        this.currentPage = 'home';
        this.setupEventListeners();
    }

    /**
     * 設定導航事件監聽器
     */
    setupEventListeners() {
        // 側邊欄導航
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.target.closest('.nav-item').dataset.page;
                this.navigateToPage(page);
            });
        });

        // 截圖按鈕
        document.getElementById('screenshot-btn').addEventListener('click', () => {
            window.electronAPI.triggerScreenshot();
        });
    }

    /**
     * 導航到指定頁面
     */
    navigateToPage(page) {
        // 更新側邊欄狀態
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // 顯示對應頁面
        document.querySelectorAll('.page').forEach(p => {
            p.classList.add('hidden');
        });
        document.getElementById(`${page}-page`).classList.remove('hidden');

        this.currentPage = page;

        // 如果切換到設定頁，載入設定
        if (page === 'settings') {
            this.app.settingsManager.loadSettings(true); // 切換頁面時才用暫存主題
        }
    }

    /**
     * 獲取當前頁面
     */
    getCurrentPage() {
        return this.currentPage;
    }
}
