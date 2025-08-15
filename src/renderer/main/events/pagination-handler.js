// 分頁事件處理器
export class PaginationHandler {
    constructor(app, paginationManager) {
        this.app = app;
        this.paginationManager = paginationManager;
        this.setupEventListeners();
    }

    /**
     * 設定分頁事件監聽器
     */
    setupEventListeners() {
        // 分頁控制
        document.getElementById('first-page').addEventListener('click', () => {
            if (this.paginationManager.firstPage()) {
                this.app.renderCurrentPage();
            }
        });

        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.paginationManager.previousPage()) {
                this.app.renderCurrentPage();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            if (this.paginationManager.nextPage()) {
                this.app.renderCurrentPage();
            }
        });

        document.getElementById('last-page').addEventListener('click', () => {
            if (this.paginationManager.lastPage()) {
                this.app.renderCurrentPage();
            }
        });
    }
}
