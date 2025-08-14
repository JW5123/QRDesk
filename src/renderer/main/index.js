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
        localStorage.removeItem('tempTheme'); // Clear temp theme on startup
        await this.loadSettings(false); // Use formal settings only on app startup
        await this.loadScanRecords();
        this.updateTheme();
        
        // Listen for events from main process
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
        // Delete all records
        document.getElementById('clear-records').addEventListener('click', async () => {
            const t = window.i18n.t;
            const confirmed = await this.showCustomDialog(
                t('deleteAllRecords'),
                t('confirmDeleteAll')
            );
            if (confirmed) {
                await window.electronAPI.clearScanRecords();
                await this.loadScanRecords();
                this.showNotification(t('allRecordsDeleted'), 'success');
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

        // Reset settings
        document.getElementById('reset-settings').addEventListener('click', async () => {
            const t = window.i18n.t;
            const confirmed = await this.showCustomDialog(
                t('resetSettings'),
                t('confirmResetSettings')
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
                const t = window.i18n.t;
                shortcutInput.value = t('enterShortcutCombo');
                
                // Temporarily disable global shortcuts
                try {
                    await window.electronAPI.disableShortcut();
                } catch (error) {
                    console.error('Failed to disable shortcut:', error);
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
                
                // If no actual shortcut was entered, restore original setting value
                const t = window.i18n.t;
                if (shortcutInput.value === t('enterShortcutCombo')) {
                    try {
                        const settings = await window.electronAPI.getSettings();
                        shortcutInput.value = settings.shortcut || 'Alt+Shift+S';
                    } catch (error) {
                        console.error('Failed to get settings:', error);
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
            const t = window.i18n.t;
            
            // Only restore original shortcut if input value differs from current setting
            // If same, temporarily don't restore to avoid triggering screenshot
            if (currentInputValue && currentInputValue !== settings.shortcut) {
                await window.electronAPI.updateShortcut(settings.shortcut);
            } else if (!currentInputValue || currentInputValue === t('enterShortcutCombo')) {
                // If input is empty or shows placeholder text, restore original shortcut
                await window.electronAPI.updateShortcut(settings.shortcut);
            }
            // If entered shortcut is same as current, don't restore to avoid immediate trigger
        } catch (error) {
            console.error('Failed to restore shortcut:', error);
        }
    }

    getDatePickerConfig() {
        const locale = window.i18n.currentLocale || 'en';
        const t = window.i18n.t;
        
        // Map our locale to flatpickr locale
        const flatpickrLocaleMap = {
            'zh-TW': 'zh_tw',
            'zh-CN': 'zh', 
            'en': null, // Use default English
            'ja': 'ja'
        };
        
        // Get locale-specific settings
        const dateFormat = t('dateFormat') || 'Y/m/d';
        const firstDayOfWeek = parseInt(t('firstDayOfWeek') || '0');
        const flatpickrLocaleName = flatpickrLocaleMap[locale];
        
        // Get the actual flatpickr locale object if available
        let flatpickrLocale = null;
        if (flatpickrLocaleName && window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns[flatpickrLocaleName]) {
            flatpickrLocale = window.flatpickr.l10ns[flatpickrLocaleName];
        }
        
        return {
            flatpickrLocale,
            dateFormat,
            firstDayOfWeek
        };
    }

    setupDatePicker() {
        const t = window.i18n.t;
        const config = this.getDatePickerConfig();
        
        // Destroy existing date picker if it exists
        if (this.dateRangePicker) {
            try {
                this.dateRangePicker.destroy();
            } catch (error) {
                console.warn('Failed to destroy existing date picker:', error);
            }
        }
        
        const datePickerOptions = {
            mode: 'range',
            dateFormat: config.dateFormat,
            placeholder: t('selectDateRange'),
            onClose: () => {
                this.performSearch();
            }
        };
        
        // Add locale configuration if available
        if (config.flatpickrLocale) {
            datePickerOptions.locale = {
                ...config.flatpickrLocale,
                firstDayOfWeek: config.firstDayOfWeek
            };
        } else if (config.firstDayOfWeek !== 0) {
            // Apply first day of week even without locale
            datePickerOptions.locale = {
                firstDayOfWeek: config.firstDayOfWeek
            };
        }
        
        try {
            this.dateRangePicker = flatpickr('#date-range', datePickerOptions);
        } catch (error) {
            console.warn('Failed to initialize flatpickr with locale, falling back to default:', error);
            // Fallback to basic configuration
            this.dateRangePicker = flatpickr('#date-range', {
                mode: 'range',
                dateFormat: 'Y/m/d',
                placeholder: t('selectDateRange'),
                onClose: () => {
                    this.performSearch();
                }
            });
        }
    }

    setupIpcListeners() {
        // Listen for new scan records
        window.electronAPI.onScanRecordAdded((event, record) => {
            const t = window.i18n.t;
            this.currentRecords.unshift(record);
            this.applyCurrentFilter();
            this.showNotification(t('newScanRecord') + record.data.substring(0, 50), 'success');
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
            const t = window.i18n.t;
            console.error('Failed to load scan records:', error);
            this.showNotification(t('loadRecordsFailed'), 'error');
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
            const t = window.i18n.t;
            console.error('Search failed:', error);
            this.showNotification(t('searchFailed'), 'error');
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
            const t = window.i18n.t;
            recordsList.innerHTML = `<div class="no-records">${t('noRecordsFound')}</div>`;
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
        const t = window.i18n.t;
        const pageInfo = document.getElementById('page-info');
        const currentPage = this.currentPageIndex + 1;
        pageInfo.textContent = t('pageInfo').replace('{current}', currentPage).replace('{total}', totalPages);

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
            const t = window.i18n.t;
            console.error('Failed to open URL:', error);
            this.showNotification(t('openUrlFailed'), 'error');
        }
    }

    async shareText(text) {
        try {
            await window.electronAPI.shareText(text);
            const t = window.i18n.t;
            this.showNotification(t('copyToClipboard'), 'success');
        } catch (error) {
            const t = window.i18n.t;
            console.error('Copy failed:', error);
            this.showNotification(t('copyFailed'), 'error');
        }
    }

    async deleteRecord(id) {
        const t = window.i18n.t;
        const confirmed = await this.showCustomDialog(
            t('deleteRecordConfirm'),
            t('deleteRecordMessage')
        );
        
        if (confirmed) {
            try {
                await window.electronAPI.deleteScanRecord(id);
                
                // Update local data
                this.currentRecords = this.currentRecords.filter(r => r.id !== id);
                this.applyCurrentFilter();
                
                this.showNotification(t('recordDeleted'), 'success');
            } catch (error) {
                console.error('Delete failed:', error);
                this.showNotification(t('deleteFailed'), 'error');
            }
        }
    }

    async loadSettings() {
        try {
            const settings = await window.electronAPI.getSettings();
            // Update settings interface
            document.getElementById('auto-launch').checked = settings.autoLaunch;
            document.getElementById('exit-to-tray').checked = settings.exitToTray;
            // Load shortcuts
            document.getElementById('shortcut-input').value = settings.shortcut || 'Alt+Shift+S';
            // Set theme
            let themeToUse = settings.theme;
            if (arguments[0] === true) {
                const tempTheme = localStorage.getItem('tempTheme');
                if (tempTheme) themeToUse = tempTheme;
            } else {
                // Clear temp theme on each formal load
                localStorage.removeItem('tempTheme');
            }
            document.querySelector(`input[name="theme"][value="${themeToUse}"]`).checked = true;
        } catch (error) {
            const t = window.i18n.t;
            console.error('Failed to load settings:', error);
            this.showNotification(t('loadRecordsFailed'), 'error');
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

            // Update settings individually
            await Promise.all([
                window.electronAPI.updateAutoLaunch(settings.autoLaunch),
                window.electronAPI.updateExitToTray(settings.exitToTray),
                window.electronAPI.updateShortcut(settings.shortcut),
                window.electronAPI.updateTheme(settings.theme)
            ]);

            const t = window.i18n.t;
            this.showNotification(t('settingsSaved'), 'success');
        } catch (error) {
            const t = window.i18n.t;
            console.error('Failed to save settings:', error);
            this.showNotification('Failed to save settings', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async resetSettings() {
        try {
            this.showLoading(true);
            
            // Reset to default values
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
            const t = window.i18n.t;
            this.showNotification(t('settingsReset'), 'success');
        } catch (error) {
            const t = window.i18n.t;
            console.error('Failed to reset settings:', error);
            this.showNotification('Failed to reset settings', 'error');
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
        const t = window.i18n.t;
        const period = date.getHours() < 12 ? t('morning') : t('afternoon');
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

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.i18n.detectAndLoadLocale().then(() => {
        applyTranslations();
        window.app = new QRCodeApp();
        // Reinitialize date picker with correct locale after i18n is loaded
        window.app.setupDatePicker();
    });
});

function applyTranslations() {
    const t = window.i18n.t;
    // Update page title
    document.title = t('title');
    
    // Titles
    document.getElementById('title').textContent = t('title');
    document.getElementById('sidebar-title').textContent = t('title');
    document.getElementById('nav-home').textContent = t('home');
    document.getElementById('nav-settings').textContent = t('settings');
    document.getElementById('scan-records-title').textContent = t('scanRecords');
    document.getElementById('start-scan').textContent = t('startScan');
    document.getElementById('search-input').setAttribute('placeholder', t('searchPlaceholder'));
    document.getElementById('date-range').setAttribute('placeholder', t('selectDateRange'));
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
