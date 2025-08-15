import { CommonUtils } from '../utils/common.js';

// 記錄管理器
export class RecordManager {
    constructor(app) {
        this.app = app;
        this.currentRecords = [];
    }

    // 載入掃描紀錄
    async loadScanRecords() {
        try {
            CommonUtils.showLoading(true);
            this.currentRecords = await window.electronAPI.getScanRecords();
            this.handleRecordsUpdate(this.currentRecords);
            return this.currentRecords;
        } catch (error) {
            console.error('載入掃描紀錄失敗:', error);
            this.app.notificationManager.error('載入掃描紀錄失敗');
            throw error;
        } finally {
            CommonUtils.showLoading(false);
        }
    }

    // 處理紀錄更新
    handleRecordsUpdate(records) {
        this.app.paginationManager.setFilteredRecords(records);
        this.app.paginationManager.reset();
        this.app.renderCurrentPage();
    }

    // 處理搜尋結果
    handleSearchResults(filteredRecords) {
        this.app.paginationManager.setFilteredRecords(filteredRecords);
        this.app.paginationManager.reset();
        this.app.renderCurrentPage();
    }

    // 刪除記錄
    async deleteRecord(id) {
        const confirmed = await this.app.dialogManager.showCustomDialog(
            '確認刪除',
            '確定要刪除這筆掃描紀錄嗎？此操作無法復原。'
        );
        
        if (confirmed) {
            try {
                await window.electronAPI.deleteScanRecord(id);
                
                // 更新本地資料
                this.currentRecords = this.currentRecords.filter(r => r.id !== id);
                this.app.searchHandler.applyCurrentFilter();
                
                this.app.notificationManager.success('紀錄已刪除');
            } catch (error) {
                console.error('刪除失敗:', error);
                this.app.notificationManager.error('刪除失敗');
            }
        }
    }

    // 新增記錄到本地列表
    addRecord(record) {
        this.currentRecords.unshift(record);
    }

    // 獲取當前記錄
    getCurrentRecords() {
        return this.currentRecords;
    }

    // 清除所有記錄
    async clearAllRecords() {
        try {
            await window.electronAPI.clearScanRecords();
            this.currentRecords = [];
            await this.loadScanRecords();
            this.app.notificationManager.success('所有紀錄已刪除');
        } catch (error) {
            console.error('清除記錄失敗:', error);
            this.app.notificationManager.error('清除記錄失敗');
        }
    }
}

if (typeof window !== 'undefined') {
    window.RecordManager = RecordManager;
}
