import { CommonUtils } from '../utils/common.js';

// 搜尋事件處理器
export class SearchHandler {
    constructor(app) {
        this.app = app;
        this.dateRangePicker = null;
        this.searchTimeout = null;
        this.setupEventListeners();
        this.setupDatePicker();
    }

    // 設定搜尋事件監聽器
    setupEventListeners() {
        // 搜尋功能 - 即時搜尋
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', () => {
            // 使用防抖功能，避免過於頻繁的搜尋
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.performSearch();
            }, 300);
        });

        // Enter 鍵搜尋
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // 清除篩選
        document.getElementById('clear-filter').addEventListener('click', () => {
            searchInput.value = '';
            this.dateRangePicker.clear();
            this.app.recordManager.loadScanRecords();
        });
    }

    // 設定日期選擇器
    setupDatePicker() {
        this.dateRangePicker = flatpickr('#date-range', {
            mode: 'range',
            locale: 'zh_tw',
            dateFormat: 'Y/m/d',
            placeholder: '選擇日期範圍',
            onClose: () => {
                this.performSearch();
            }
        });
    }

    // 執行搜尋
    async performSearch() {
        try {
            CommonUtils.showLoading(true);
            const query = document.getElementById('search-input').value.trim();
            const dateRange = this.dateRangePicker.selectedDates;

            const searchParams = {
                query: query,
                startDate: dateRange[0] ? dateRange[0].toISOString() : null,
                endDate: dateRange[1] ? dateRange[1].toISOString() : null
            };

            const filteredRecords = await window.electronAPI.searchScanRecords(searchParams);
            this.app.recordManager.handleSearchResults(filteredRecords);
        } catch (error) {
            console.error('搜尋失敗:', error);
            this.app.notificationManager.error('搜尋失敗');
        } finally {
            CommonUtils.showLoading(false);
        }
    }

    // 應用當前篩選
    applyCurrentFilter() {
        const query = document.getElementById('search-input').value.trim();
        const dateRange = this.dateRangePicker.selectedDates;

        if (!query && dateRange.length === 0) {
            // 沒有篩選條件，載入所有記錄
            this.app.recordManager.loadScanRecords();
        } else {
            // 有篩選條件，執行搜尋
            this.performSearch();
        }
    }
}
