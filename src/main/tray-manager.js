const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');

class TrayManager {
    constructor(windowManager, dataStore) {
        this.windowManager = windowManager;
        this.dataStore = dataStore;
        this.tray = null;
        this.translations = {};
        this.currentLocale = 'en';
        this.init();
    }

    async loadLocale() {
        // Detect system locale
        const locale = app.getLocale();
        const supportedLocales = {
            'zh-TW': 'zh-TW',
            'zh-HK': 'zh-TW', 
            'zh-CN': 'zh-CN',
            'en': 'en',
            'en-US': 'en',
            'en-GB': 'en',
            'ja': 'ja',
            'ja-JP': 'ja'
        };
        
        this.currentLocale = supportedLocales[locale] || (locale.split('-')[0] in supportedLocales ? supportedLocales[locale.split('-')[0]] : 'en');
        
        try {
            const localeFile = path.join(__dirname, '..', 'locales', `${this.currentLocale}.json`);
            const data = fs.readFileSync(localeFile, 'utf8');
            this.translations = JSON.parse(data);
        } catch (error) {
            console.error('Failed to load locale file:', error);
            // Fallback to English
            try {
                const localeFile = path.join(__dirname, '..', 'locales', 'en.json');
                const data = fs.readFileSync(localeFile, 'utf8');
                this.translations = JSON.parse(data);
            } catch (fallbackError) {
                console.error('Failed to load fallback locale:', fallbackError);
                this.translations = {};
            }
        }
    }

    t(key) {
        return this.translations[key] || key;
    }

    async init() {
        await this.loadLocale();
        this.createTray();
    }

    createTray() {
        // 創建托盤圖示
        const iconPath = path.join(__dirname, '../assets/icon.png');
        let trayIcon;
        
        try {
            trayIcon = nativeImage.createFromPath(iconPath);
            if (trayIcon.isEmpty()) {
                // 如果圖示載入失敗，創建一個簡單的圖示
                trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFYSURBVDiNpZM9SwNBEIafJQQLwcLGQrBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQ');
            }
        } catch (error) {
            console.error('托盤圖示載入失敗:', error);
            trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFYSURBVDiNpZM9SwNBEIafJQQLwcLGQrBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQsLGwsLBQ');
        }
        
        // 調整圖示大小以適應不同平台
        if (process.platform === 'darwin') {
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
        } else if (process.platform === 'win32') {
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
        } else {
            trayIcon = trayIcon.resize({ width: 22, height: 22 });
        }

        this.tray = new Tray(trayIcon);
        this.updateTrayMenu();
        this.setupTrayEvents();
    }

    updateTrayMenu() {
        if (!this.tray) return;

        const contextMenu = Menu.buildFromTemplate([
            {
                label: this.t('showMainWindow'),
                click: () => {
                    this.windowManager.showMainWindow();
                }
            },
            { type: 'separator' },
            {
                label: this.t('settings'),
                click: () => {
                    this.windowManager.showMainWindow();
                    setTimeout(() => {
                        const mainWindow = this.windowManager.getMainWindow();
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('navigate-to-settings');
                        }
                    }, 100);
                }
            },
            { type: 'separator' },
            {
                label: this.t('exit'),
                click: () => {
                    // Force exit (even if running in background)
                    app.exit(0);
                }
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    setupTrayEvents() {
        if (!this.tray) return;

        // Set tooltip text
        this.tray.setToolTip(this.t('qrScreenshotTool'));

        // 左鍵點擊顯示主視窗
        this.tray.on('click', () => {
            this.windowManager.showMainWindow();
        });

        // 雙擊也顯示主視窗
        this.tray.on('double-click', () => {
            this.windowManager.showMainWindow();
        });
    }

    updateTheme(theme) {
        // 根據主題更新托盤圖示 (如果有不同主題的圖示)
        // 這裡可以根據主題載入不同的圖示
        console.log(`托盤主題已更新為: ${theme}`);
    }

    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}

module.exports = TrayManager;
