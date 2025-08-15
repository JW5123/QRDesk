// 分頁管理器
export class PaginationManager {
    constructor(recordsPerPage = 10) {
        this.currentPageIndex = 0;
        this.recordsPerPage = recordsPerPage;
        this.filteredRecords = [];
    }

    /**
     * 設定過濾後的記錄
     */
    setFilteredRecords(records) {
        this.filteredRecords = records;
        // 確保當前頁面索引有效
        const totalPages = this.getTotalPages();
        if (this.currentPageIndex >= totalPages && totalPages > 0) {
            this.currentPageIndex = totalPages - 1;
        }
    }

    /**
     * 獲取總頁數
     */
    getTotalPages() {
        return Math.ceil(this.filteredRecords.length / this.recordsPerPage);
    }

    /**
     * 獲取當前頁的記錄
     */
    getCurrentPageRecords() {
        const startIndex = this.currentPageIndex * this.recordsPerPage;
        const endIndex = startIndex + this.recordsPerPage;
        return this.filteredRecords.slice(startIndex, endIndex);
    }

    /**
     * 跳到指定頁面
     */
    goToPage(pageIndex) {
        const totalPages = this.getTotalPages();
        if (pageIndex >= 0 && pageIndex < totalPages) {
            this.currentPageIndex = pageIndex;
            return true;
        }
        return false;
    }

    /**
     * 下一頁
     */
    nextPage() {
        return this.goToPage(this.currentPageIndex + 1);
    }

    /**
     * 上一頁
     */
    previousPage() {
        return this.goToPage(this.currentPageIndex - 1);
    }

    /**
     * 第一頁
     */
    firstPage() {
        return this.goToPage(0);
    }

    /**
     * 最後一頁
     */
    lastPage() {
        const totalPages = this.getTotalPages();
        return this.goToPage(Math.max(0, totalPages - 1));
    }

    /**
     * 更新分頁UI
     */
    updatePaginationUI() {
        const totalPages = this.getTotalPages();
        const pageInfo = document.getElementById('page-info');
        
        if (totalPages > 0) {
            pageInfo.textContent = `第 ${this.currentPageIndex + 1} 頁，共 ${totalPages} 頁`;
        } else {
            pageInfo.textContent = '第 1 頁，共 0 頁';
        }

        // 更新按鈕狀態
        document.getElementById('first-page').disabled = this.currentPageIndex === 0;
        document.getElementById('prev-page').disabled = this.currentPageIndex === 0;
        document.getElementById('next-page').disabled = this.currentPageIndex >= totalPages - 1;
        document.getElementById('last-page').disabled = this.currentPageIndex >= totalPages - 1;
    }

    /**
     * 重設到第一頁
     */
    reset() {
        this.currentPageIndex = 0;
    }
}
