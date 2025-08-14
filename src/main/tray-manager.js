const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

class TrayManager {
    constructor(windowManager, dataStore) {
        this.windowManager = windowManager;
        this.dataStore = dataStore;
        this.tray = null;
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
                label: '顯示主視窗',
                click: () => {
                    this.windowManager.showMainWindow();
                }
            },
            { type: 'separator' },
            {
                label: '設定',
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
                label: '退出',
                click: () => {
                    // 完全退出（即使是背景執行）
                    app.exit(0);
                }
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    setupTrayEvents() {
        if (!this.tray) return;

        // 設定提示文字
        this.tray.setToolTip('QR Code 截圖工具');

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
