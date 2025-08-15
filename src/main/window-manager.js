const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { WINDOW_CONFIG } = require('../utils/constants');

class WindowManager {
    constructor(dataStore) {
        this.mainWindow = null;
        this.screenshotWindows = [];
        this.dataStore = dataStore;
        this.setupIpcHandlers();
    }

    createMainWindow() {
        const settings = this.dataStore.getSettings();
        const { width, height } = settings.lastWindowSize || WINDOW_CONFIG.MAIN;
        const isMaximized = settings.isMaximized || false;

        this.mainWindow = new BrowserWindow({
            width,
            height,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/preload.js')
            },
            show: false,
            skipTaskbar: false,
            titleBarStyle: 'default',
            autoHideMenuBar: true, // 隱藏選單欄
            icon: path.join(__dirname, '../assets/icon.png')
        });

        this.mainWindow.loadFile(path.join(__dirname, '../renderer/main/index.html'));

        // 還原最大化狀態
        this.mainWindow.once('ready-to-show', () => {
            if (isMaximized) {
                this.mainWindow.maximize();
            }
        });

        // 監聽視窗事件
        this.setupMainWindowEvents();
    }

    setupMainWindowEvents() {
        if (!this.mainWindow) return;

        // 視窗關閉事件
        this.mainWindow.on('close', (event) => {
            const settings = this.dataStore.getSettings();
            if (settings.exitToTray) {
                event.preventDefault();
                this.mainWindow.hide();
            } else {
                require('electron').app.quit();
            }
        });

        // 儲存視窗大小
        this.mainWindow.on('resize', () => {
            if (!this.mainWindow.isMaximized()) {
                const bounds = this.mainWindow.getBounds();
                this.dataStore.setSetting('lastWindowSize', {
                    width: bounds.width,
                    height: bounds.height
                });
                this.dataStore.setSetting('isMaximized', false);
            }
        });

        // 最大化/還原事件
        this.mainWindow.on('maximize', () => {
            this.dataStore.setSetting('isMaximized', true);
        });
        this.mainWindow.on('unmaximize', () => {
            this.dataStore.setSetting('isMaximized', false);
            // 還原時也儲存目前大小
            const bounds = this.mainWindow.getBounds();
            this.dataStore.setSetting('lastWindowSize', {
                width: bounds.width,
                height: bounds.height
            });
        });

        // 視窗準備顯示時
        this.mainWindow.on('ready-to-show', () => {
            if (process.env.NODE_ENV === 'development') {
                this.mainWindow.webContents.openDevTools();
            }
        });
    }

    setupIpcHandlers() {
        // 刪除所有掃描紀錄
        ipcMain.handle('clear-scan-records', () => {
            this.dataStore.clearScanRecords();
            return true;
        });
        // 獲取掃描紀錄
        ipcMain.handle('get-scan-records', () => {
            return this.dataStore.getScanRecords();
        });

        // 搜尋掃描紀錄
        ipcMain.handle('search-scan-records', (event, { query, startDate, endDate }) => {
            return this.dataStore.searchScanRecords(query, startDate, endDate);
        });

        // 刪除掃描紀錄
        ipcMain.handle('delete-scan-record', (event, id) => {
            return this.dataStore.deleteScanRecord(id);
        });

        // 獲取設定
        ipcMain.handle('get-settings', () => {
            return this.dataStore.getSettings();
        });

        // 更新設定
        ipcMain.handle('update-settings', (event, newSettings) => {
            return this.dataStore.updateSettings(newSettings);
        });

        // 開啟 URL
        ipcMain.handle('open-url', (event, url) => {
            require('electron').shell.openExternal(url);
        });

        // 分享文字
        ipcMain.handle('share-text', (event, text) => {
            require('electron').clipboard.writeText(text);
            return true;
        });

        // 觸發截圖
        ipcMain.handle('trigger-screenshot', () => {
            this.createScreenshotWindows();
        });
    }

    showMainWindow() {
        if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) {
                this.mainWindow.restore();
            }
            this.mainWindow.show();
            this.mainWindow.focus();
        }
    }

    hideMainWindow() {
        if (this.mainWindow) {
            this.mainWindow.hide();
        }
    }

    createScreenshotWindows() {
        this.destroyScreenshotWindows();

        const displays = screen.getAllDisplays();
        const primaryDisplay = screen.getPrimaryDisplay();

        displays.forEach(display => {
            const isPrimary = display.id === primaryDisplay.id;
            
            // 確保視窗完全覆蓋顯示器
            const win = new BrowserWindow({
                x: display.bounds.x,
                y: display.bounds.y,
                width: display.bounds.width,
                height: display.bounds.height,
                frame: false, // 無邊框
                transparent: true, // 透明背景
                alwaysOnTop: true, // 始終置頂
                fullscreen: false, // 不使用全螢幕模式，使用自訂尺寸
                resizable: false, // 不可調整大小
                movable: false, // 不可移動
                minimizable: false, // 不可最小化
                maximizable: false, // 不可最大化
                closable: true, // 可關閉
                focusable: true, // 可獲得焦點
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false,
                    enableRemoteModule: false
                }
            });

            // 設定視窗屬性
            win.setAlwaysOnTop(true, 'screen-saver');
            win.setVisibleOnAllWorkspaces(true);
            win.setFullScreenable(false);
            
            win.loadFile(path.join(__dirname, '../renderer/screenshot/screenshot.html'));

            win.webContents.on('did-finish-load', () => {
                // 確保視窗大小正確
                win.setBounds({
                    x: display.bounds.x,
                    y: display.bounds.y,
                    width: display.bounds.width,
                    height: display.bounds.height
                });
                
                win.webContents.send('set-screen-info', {
                    isPrimary,
                    bounds: display.bounds
                });
            });

            this.screenshotWindows.push(win);
        });
    }

    hideScreenshotWindows() {
        this.screenshotWindows.forEach(win => {
            if (!win.isDestroyed()) {
                win.hide();
            }
        });
    }

    destroyScreenshotWindows() {
        this.screenshotWindows.forEach(win => {
            if (!win.isDestroyed()) {
                win.destroy();
            }
        });
        this.screenshotWindows = [];
    }

    getMainWindow() {
        return this.mainWindow;
    }

    // 通知設定頁面更新
    notifySettingsUpdate(settings) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('settings-updated', settings);
        }
    }
}

module.exports = WindowManager;