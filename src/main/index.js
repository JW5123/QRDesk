const { app, ipcMain } = require('electron');
const WindowManager = require('./window-manager');
const ScreenshotHandler = require('./screenshot-handler');
const DataStore = require('./data-store');
const TrayManager = require('./tray-manager');
const SettingsManager = require('./settings-manager');

class QRCodeApp {
    constructor() {
        this.dataStore = new DataStore();
        this.windowManager = new WindowManager(this.dataStore);
        this.screenshotHandler = new ScreenshotHandler(this.windowManager, this.dataStore);
        this.trayManager = new TrayManager(this.windowManager, this.dataStore);
        this.settingsManager = new SettingsManager(this.dataStore);
        
        this.isQuitting = false;
    }

    async initialize() {
        // 實作單例模式 - 確保只有一個應用程式實例執行
        const gotTheLock = app.requestSingleInstanceLock();

        if (!gotTheLock) {
            // 如果無法取得鎖（代表已經有其他實例在執行），直接退出
            app.quit();
            return;
        }

        // 當有第二個實例嘗試啟動時，顯示現有的主視窗
        app.on('second-instance', () => {
            if (this.windowManager) {
                this.windowManager.showMainWindow();
                // 如果視窗被最小化，恢復它
                const mainWindow = this.windowManager.getMainWindow();
                if (mainWindow) {
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }
                    mainWindow.focus();
                }
            }
        });

        await app.whenReady();

        // 設定程式名稱（macOS Dock 與 Menu）
        if (process.platform === 'darwin') {
            app.setName('QR Code 掃描工具');
            // 設定 Dock 圖示
            const path = require('path');
            app.dock.setIcon(path.join(__dirname, '../assets/icon.png'));
            // 只保留程式名稱，不顯示其他選單項目
            const { Menu } = require('electron');
            const appMenu = Menu.buildFromTemplate([
                { label: 'QR Code 掃描工具', submenu: [] }
            ]);
            Menu.setApplicationMenu(appMenu);
        }

        // 初始化各個組件
        await this.settingsManager.initializeSettings();
        this.windowManager.createMainWindow();
        this.trayManager.createTray();

        this.registerGlobalShortcuts();
        this.setupEventHandlers();
        this.setupSettingsIpc();

        // 根據設定決定是否顯示主視窗
        // const settings = this.dataStore.getSettings();
        // 開發時期總是顯示主視窗以便測試
        this.windowManager.showMainWindow();
    }

    registerGlobalShortcuts() {
        const settings = this.dataStore.getSettings();
        const shortcut = settings.shortcut || 'Alt+Shift+S';
        
        this.settingsManager.updateShortcut(shortcut, () => {
            this.windowManager.createScreenshotWindows();
        });
    }

    setupEventHandlers() {
        app.on('before-quit', () => {
            this.isQuitting = true;
        });

        app.on('window-all-closed', () => {
            const settings = this.dataStore.getSettings();
            if (process.platform !== 'darwin' && !settings.exitToTray) {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (require('electron').BrowserWindow.getAllWindows().length === 0) {
                this.windowManager.createMainWindow();
            } else {
                this.windowManager.showMainWindow();
            }
        });

        app.on('will-quit', () => {
            this.settingsManager.cleanup();
            this.trayManager.destroy();
        });

        // 系統主題變更
        require('electron').nativeTheme.on('updated', () => {
            const settings = this.dataStore.getSettings();
            if (settings.theme === 'system') {
                this.windowManager.notifySettingsUpdate({ theme: 'system' });
            }
        });
    }

    setupSettingsIpc() {
        // 更新開機啟動
        ipcMain.handle('update-auto-launch', async (event, enabled) => {
            const success = await this.settingsManager.updateAutoLaunch(enabled);
            return success;
        });

        // 更新快捷鍵
        ipcMain.handle('update-shortcut', (event, shortcut) => {
            const success = this.settingsManager.updateShortcut(shortcut, () => {
                this.windowManager.createScreenshotWindows();
            });
            return success;
        });

        // 停用快捷鍵
        ipcMain.handle('disable-shortcut', () => {
            this.settingsManager.disableShortcut();
            return true;
        });

        // 更新主題
        ipcMain.handle('update-theme', (event, theme) => {
            const updatedTheme = this.settingsManager.updateTheme(theme);
            this.trayManager.updateTheme(updatedTheme);
            return updatedTheme;
        });

        // 更新退出模式
        ipcMain.handle('update-exit-to-tray', (event, enabled) => {
            return this.settingsManager.updateExitToTray(enabled);
        });

        // 驗證快捷鍵
        ipcMain.handle('validate-shortcut', (event, shortcut) => {
            return this.settingsManager.validateShortcut(shortcut);
        });

        // 完全退出應用程式
        ipcMain.handle('quit-app', () => {
            this.isQuitting = true;
            app.quit();
        });
    }
}

const qrApp = new QRCodeApp();
qrApp.initialize().catch(console.error);
