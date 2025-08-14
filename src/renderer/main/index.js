class QRCodeApp {
    constructor() {
        this.currentPage = 'home';
        this.currentRecords = [];
        this.filteredRecords = [];
        this.currentPageIndex = 0;
        this.recordsPerPage = 10;
        this.dateRangePicker = null;
        this.searchTimeout = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupDatePicker();
    localStorage.removeItem('tempTheme'); // 啟動時清除暫存主題
    await this.loadSettings(false); // 程式啟動只用正式設定
        await this.loadScanRecords();
        this.updateTheme();
        
        // 監聽來自主進程的事件
        this.setupIpcListeners();
    }

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

        // 搜尋功能 - 改為即時搜尋
        document.getElementById('search-input').addEventListener('input', (e) => {
            // 使用防抖功能，避免過於頻繁的搜尋
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.performSearch();
            }, 300);
        });


        // Enter 鍵搜尋
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // 清除篩選
        document.getElementById('clear-filter').addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            this.dateRangePicker.clear();
            this.loadScanRecords();
        });

        // 分頁控制
        document.getElementById('first-page').addEventListener('click', () => {
            this.goToPage(0);
        });

        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPageIndex > 0) {
                this.goToPage(this.currentPageIndex - 1);
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredRecords.length / this.recordsPerPage);
            if (this.currentPageIndex < totalPages - 1) {
                this.goToPage(this.currentPageIndex + 1);
            }
        });

        document.getElementById('last-page').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredRecords.length / this.recordsPerPage);
            this.goToPage(Math.max(0, totalPages - 1));
        });

        // 設定頁面事件
        this.setupSettingsListeners();
    }

    setupSettingsListeners() {
        // 刪除所有紀錄
        document.getElementById('clear-records').addEventListener('click', async () => {
            const confirmed = await this.showCustomDialog(
                '刪除所有紀錄',
                '確定要刪除所有掃描紀錄嗎？此操作無法復原！'
            );
            if (confirmed) {
                await window.electronAPI.clearScanRecords();
                await this.loadScanRecords();
                this.showNotification('所有紀錄已刪除', 'success');
            }
        });
        // 主題變更（即時生效）
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    this.updateTheme(e.target.value);
                    await window.electronAPI.updateTheme(e.target.value);
                }
            });
        });

        // 開機啟動（即時生效）
        document.getElementById('auto-launch').addEventListener('change', async (e) => {
            await window.electronAPI.updateAutoLaunch(e.target.checked);
        });

        // 退出模式（即時生效）
        document.getElementById('exit-to-tray').addEventListener('change', async (e) => {
            await window.electronAPI.updateExitToTray(e.target.checked);
        });

        // 重設設定
        document.getElementById('reset-settings').addEventListener('click', async () => {
            const confirmed = await this.showCustomDialog(
                '重設為預設值',
                '確定要重設所有設定為預設值嗎？'
            );
            if (confirmed) {
                await this.resetSettings();
            }
        });

        // 快捷鍵輸入處理
        const shortcutInput = document.getElementById('shortcut-input');
        let isCapturingShortcut = false;
        
        shortcutInput.addEventListener('click', async () => {
            if (!isCapturingShortcut) {
                isCapturingShortcut = true;
                shortcutInput.value = '按下快捷鍵組合...';
                
                // 暫時停用全域快捷鍵
                try {
                    await window.electronAPI.disableShortcut();
                } catch (error) {
                    console.error('停用快捷鍵失敗:', error);
                }
            }
        });

        shortcutInput.addEventListener('keydown', async (e) => {
            if (!isCapturingShortcut) return;
            e.preventDefault();
            e.stopPropagation();
            const keys = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.altKey) keys.push('Alt');
            if (e.shiftKey) keys.push('Shift');
            if (e.metaKey) keys.push('Cmd');
            // 處理主要按鍵，包括特殊按鍵的映射
            let mainKey = '';
            if (e.code) {
                if (e.code.startsWith('Key')) {
                    mainKey = e.code.replace('Key', '');
                } else if (e.code.startsWith('Digit')) {
                    mainKey = e.code.replace('Digit', '');
                } else if (e.code === 'Space') {
                    mainKey = 'Space';
                } else if (e.code === 'Enter') {
                    mainKey = 'Enter';
                } else if (e.code.startsWith('F') && e.code.length <= 3) {
                    mainKey = e.code;
                } else if (!['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].includes(e.code)) {
                    mainKey = e.key.toUpperCase();
                }
            }
            if (mainKey && keys.length > 0) {
                keys.push(mainKey);
                const shortcutString = keys.join('+');
                shortcutInput.value = shortcutString;
                shortcutInput.style.backgroundColor = '';
                isCapturingShortcut = false;
                // 即時儲存快捷鍵
                await window.electronAPI.updateShortcut(shortcutString);
            }
        });

        shortcutInput.addEventListener('blur', async () => {
            if (isCapturingShortcut) {
                shortcutInput.style.backgroundColor = '';
                isCapturingShortcut = false;
                
                // 如果沒有實際輸入快捷鍵，恢復原來的設定值
                if (shortcutInput.value === '按下快捷鍵組合...') {
                    try {
                        const settings = await window.electronAPI.getSettings();
                        shortcutInput.value = settings.shortcut || 'Alt+Shift+S';
                    } catch (error) {
                        console.error('獲取設定失敗:', error);
                        shortcutInput.value = 'Alt+Shift+S';
                    }
                }
            }
        });
    }

    async restoreShortcut() {
        try {
            const settings = await window.electronAPI.getSettings();
            const currentInputValue = document.getElementById('shortcut-input').value;
            
            // 只有當輸入框的值與當前設定不同時，才恢復原來的快捷鍵
            // 如果相同，就暫時不恢復，避免觸發截圖
            if (currentInputValue && currentInputValue !== settings.shortcut) {
                await window.electronAPI.updateShortcut(settings.shortcut);
            } else if (!currentInputValue || currentInputValue === '按下快捷鍵組合...') {
                // 如果輸入框為空或顯示提示文字，恢復原快捷鍵
                await window.electronAPI.updateShortcut(settings.shortcut);
            }
            // 如果輸入的快捷鍵與當前相同，就不恢復，避免立即觸發
        } catch (error) {
            console.error('恢復快捷鍵失敗:', error);
        }
    }

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

    setupIpcListeners() {
        // 監聽新的掃描紀錄
        window.electronAPI.onScanRecordAdded((event, record) => {
            this.currentRecords.unshift(record);
            this.applyCurrentFilter();
            this.showNotification('新增掃描紀錄：' + record.data.substring(0, 50), 'success');
        });

        // 監聽導航到設定頁
        window.electronAPI.onNavigateToSettings(() => {
            this.navigateToPage('settings');
        });

        // 監聽設定更新
        window.electronAPI.onSettingsUpdated((event, settings) => {
            this.updateTheme(settings.theme);
        });
    }

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
            this.loadSettings(true); // 切換頁面時才用暫存主題
        }
    }

    async loadScanRecords() {
        try {
            this.showLoading(true);
            this.currentRecords = await window.electronAPI.getScanRecords();
            this.filteredRecords = [...this.currentRecords];
            this.renderRecords();
        } catch (error) {
            console.error('載入掃描紀錄失敗:', error);
            this.showNotification('載入掃描紀錄失敗', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async performSearch() {
        try {
            this.showLoading(true);
            const query = document.getElementById('search-input').value.trim();
            const dateRange = this.dateRangePicker.selectedDates;

            const searchParams = {
                query: query,
                startDate: dateRange[0] ? dateRange[0].toISOString() : null,
                endDate: dateRange[1] ? dateRange[1].toISOString() : null
            };

            this.filteredRecords = await window.electronAPI.searchScanRecords(searchParams);
            this.currentPageIndex = 0;
            this.renderRecords();
        } catch (error) {
            console.error('搜尋失敗:', error);
            this.showNotification('搜尋失敗', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    applyCurrentFilter() {
        const query = document.getElementById('search-input').value.trim();
        const dateRange = this.dateRangePicker.selectedDates;

        if (!query && dateRange.length === 0) {
            this.filteredRecords = [...this.currentRecords];
        } else {
            this.performSearch();
            return;
        }

        this.renderRecords();
    }

    renderRecords() {
        const recordsList = document.getElementById('records-list');
        const totalPages = Math.ceil(this.filteredRecords.length / this.recordsPerPage);
        
        // 確保當前頁面索引有效
        if (this.currentPageIndex >= totalPages && totalPages > 0) {
            this.currentPageIndex = totalPages - 1;
        }

        const startIndex = this.currentPageIndex * this.recordsPerPage;
        const endIndex = startIndex + this.recordsPerPage;
        const pageRecords = this.filteredRecords.slice(startIndex, endIndex);

        if (pageRecords.length === 0) {
            recordsList.innerHTML = '<div class="no-records">沒有找到掃描紀錄</div>';
        } else {
            recordsList.innerHTML = pageRecords.map(record => {
                // 決定是否顯示標題
                const showTitle = record.title && record.title !== record.data && record.title.trim().length > 0;
                const titleHtml = showTitle ? `<div class="record-title">${this.escapeHtml(record.title)}</div>` : '';
                
                return `
                    <div class="record-item" data-id="${record.id}">
                        <div class="record-content">
                            ${titleHtml}
                            <div class="record-data">${this.escapeHtml(record.data)}</div>
                            <div class="record-time">${this.formatDateTime(record.timestamp)}</div>
                        </div>
                        <div class="record-actions">
                            <button class="action-btn open-btn" onclick="app.openUrl('${this.escapeHtml(record.data)}')" title="開啟">
                                <img src="../../assets/open-external.svg" alt="開啟" class="action-icon open-icon" width="16" height="16">
                            </button>
                            <button class="action-btn share-btn" onclick="app.shareText('${this.escapeHtml(record.data)}')" title="複製">
                                <img src="../../assets/copy.svg" alt="複製" class="action-icon share-icon" width="16" height="16">
                            </button>
                            <button class="action-btn delete-btn" onclick="app.deleteRecord('${record.id}')" title="刪除">
                                <img src="../../assets/cross.svg" alt="刪除" class="action-icon cross-icon" width="16" height="16">
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        this.updatePaginationInfo(totalPages);
    }

    updatePaginationInfo(totalPages) {
        const pageInfo = document.getElementById('page-info');
        const currentPage = this.currentPageIndex + 1;
        pageInfo.textContent = `第 ${currentPage} 頁，共 ${totalPages} 頁`;

        // 更新分頁按鈕狀態
        document.getElementById('first-page').disabled = this.currentPageIndex === 0;
        document.getElementById('prev-page').disabled = this.currentPageIndex === 0;
        document.getElementById('next-page').disabled = this.currentPageIndex >= totalPages - 1;
        document.getElementById('last-page').disabled = this.currentPageIndex >= totalPages - 1;
    }

    goToPage(pageIndex) {
        this.currentPageIndex = pageIndex;
        this.renderRecords();
    }

    async openUrl(url) {
        try {
            await window.electronAPI.openUrl(url);
        } catch (error) {
            console.error('開啟 URL 失敗:', error);
            this.showNotification('開啟 URL 失敗', 'error');
        }
    }

    async shareText(text) {
        try {
            await window.electronAPI.shareText(text);
            this.showNotification('已複製到剪貼簿', 'success');
        } catch (error) {
            console.error('複製失敗:', error);
            this.showNotification('複製失敗', 'error');
        }
    }

    async deleteRecord(id) {
        const confirmed = await this.showCustomDialog(
            '確認刪除',
            '確定要刪除這筆掃描紀錄嗎？此操作無法復原。'
        );
        
        if (confirmed) {
            try {
                await window.electronAPI.deleteScanRecord(id);
                
                // 更新本地資料
                this.currentRecords = this.currentRecords.filter(r => r.id !== id);
                this.applyCurrentFilter();
                
                this.showNotification('紀錄已刪除', 'success');
            } catch (error) {
                console.error('刪除失敗:', error);
                this.showNotification('刪除失敗', 'error');
            }
        }
    }

    async loadSettings() {
        try {
            const settings = await window.electronAPI.getSettings();
            // 更新設定介面
            document.getElementById('auto-launch').checked = settings.autoLaunch;
            document.getElementById('exit-to-tray').checked = settings.exitToTray;
            // 載入快捷鍵
            document.getElementById('shortcut-input').value = settings.shortcut || 'Alt+Shift+S';
            // 設定主題
            let themeToUse = settings.theme;
            if (arguments[0] === true) {
                const tempTheme = localStorage.getItem('tempTheme');
                if (tempTheme) themeToUse = tempTheme;
            } else {
                // 每次正式載入時清除暫存主題
                localStorage.removeItem('tempTheme');
            }
            document.querySelector(`input[name="theme"][value="${themeToUse}"]`).checked = true;
        } catch (error) {
            console.error('載入設定失敗:', error);
            this.showNotification('載入設定失敗', 'error');
        }
    }

    async saveSettings() {
        try {
            this.showLoading(true);
            
            const settings = {
                autoLaunch: document.getElementById('auto-launch').checked,
                exitToTray: document.getElementById('exit-to-tray').checked,
                shortcut: document.getElementById('shortcut-input').value,
                theme: document.querySelector('input[name="theme"]:checked').value
            };

            // 逐個更新設定
            await Promise.all([
                window.electronAPI.updateAutoLaunch(settings.autoLaunch),
                window.electronAPI.updateExitToTray(settings.exitToTray),
                window.electronAPI.updateShortcut(settings.shortcut),
                window.electronAPI.updateTheme(settings.theme)
            ]);

            this.showNotification('設定已儲存', 'success');
        } catch (error) {
            console.error('儲存設定失敗:', error);
            this.showNotification('儲存設定失敗', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async resetSettings() {
        try {
            this.showLoading(true);
            
            // 重設為預設值
            const defaultSettings = {
                autoLaunch: false,
                exitToTray: true,
                shortcut: 'Alt+Shift+S',
                theme: 'system'
            };

            await Promise.all([
                window.electronAPI.updateAutoLaunch(defaultSettings.autoLaunch),
                window.electronAPI.updateExitToTray(defaultSettings.exitToTray),
                window.electronAPI.updateShortcut(defaultSettings.shortcut),
                window.electronAPI.updateTheme(defaultSettings.theme)
            ]);

            await this.loadSettings();
            this.updateTheme(defaultSettings.theme);
            this.showNotification('設定已重設為預設值', 'success');
        } catch (error) {
            console.error('重設設定失敗:', error);
            this.showNotification('重設設定失敗', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateTheme(theme) {
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            const currentTheme = document.querySelector('input[name="theme"]:checked')?.value || 'system';
            document.documentElement.setAttribute('data-theme', currentTheme);
        }
    }

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const period = date.getHours() < 12 ? '上午' : '下午';
        const hours = String(date.getHours() % 12 || 12).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}/${month}/${day} ${period} ${hours}:${minutes}:${seconds}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const messageEl = document.getElementById('notification-message');
        
        messageEl.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.remove('hidden');

        // 自動隱藏
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);

        // 手動關閉
        document.getElementById('notification-close').onclick = () => {
            notification.classList.add('hidden');
        };
    }

    // 自訂對話框
    showCustomDialog(title, message) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('custom-dialog');
            const titleEl = document.getElementById('dialog-title');
            const messageEl = document.getElementById('dialog-message');
            const confirmBtn = document.getElementById('dialog-confirm');
            const cancelBtn = document.getElementById('dialog-cancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            dialog.classList.remove('hidden');

            // 處理確認按鈕
            const handleConfirm = () => {
                dialog.classList.add('hidden');
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                resolve(true);
            };

            // 處理取消按鈕
            const handleCancel = () => {
                dialog.classList.add('hidden');
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                resolve(false);
            };

            // 處理 ESC 鍵
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeydown);
                    handleCancel();
                }
            };

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            document.addEventListener('keydown', handleKeydown);

            // 聚焦到確認按鈕
            confirmBtn.focus();
        });
    }
}

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    window.i18n.detectAndLoadLocale().then(() => {
        applyTranslations();
        window.app = new QRCodeApp();
    });
});

function applyTranslations() {
    const t = window.i18n.t;
    // 標題
    document.getElementById('title').textContent = t('title');
    document.getElementById('sidebar-title').textContent = t('title');
    document.getElementById('nav-home').textContent = t('home');
    document.getElementById('nav-settings').textContent = t('settings');
    document.getElementById('scan-records-title').textContent = t('scanRecords');
    document.getElementById('start-scan').textContent = t('startScan');
    document.getElementById('search-input').setAttribute('placeholder', t('searchPlaceholder'));
    document.getElementById('date-range').setAttribute('placeholder', t('dateRangePlaceholder'));
    document.getElementById('clear-filter').textContent = t('clearFilter');
    document.getElementById('settings-title').textContent = t('settings');
    document.getElementById('auto-launch-title').textContent = t('autoLaunchTitle');
    document.getElementById('auto-launch-label').textContent = t('autoLaunchLabel');
    document.getElementById('exit-to-tray-title').textContent = t('exitToTrayTitle');
    document.getElementById('exit-to-tray-label').textContent = t('exitToTrayLabel');
    document.getElementById('shortcut-setting-title').textContent = t('shortcutSetting');
    document.getElementById('screenshot-shortcut-label').textContent = t('screenshotShortcut');
    document.getElementById('theme-setting-title').textContent = t('themeSetting');
    document.getElementById('theme-system').textContent = t('themeSystem');
    document.getElementById('theme-light').textContent = t('themeLight');
    document.getElementById('theme-dark').textContent = t('themeDark');
    document.getElementById('reset-settings-label').textContent = t('resetSettings');
    document.getElementById('delete-all-records-label').textContent = t('deleteAllRecords');
    document.getElementById('dialog-confirm-label').textContent = t('dialogConfirm');
    document.getElementById('dialog-cancel-label').textContent = t('dialogCancel');
}
