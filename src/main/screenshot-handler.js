const { ipcMain, screen, app } = require('electron');
const screenshot = require('screenshot-desktop');
const fs = require('fs');
const path = require('path');
const QRAnalyzer = require('./qr-analyzer');
const NotificationService = require('./notification-service');

class ScreenshotHandler {
    constructor(windowManager, dataStore) {
        this.windowManager = windowManager;
        this.dataStore = dataStore;
        this.qrAnalyzer = new QRAnalyzer();
        this.notificationService = new NotificationService();
        this.setupIpcHandlers();
    }

    setupIpcHandlers() {
        ipcMain.on('take-screenshot', (event, bounds) => {
            this.windowManager.hideScreenshotWindows();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              
            setTimeout(async () => {
                await this.takeScreenshotAndAnalyze(bounds);
                this.windowManager.destroyScreenshotWindows();
            }, 200);
        });

        ipcMain.on('cancel-screenshot', () => {
            this.windowManager.destroyScreenshotWindows();
        });

        // 處理選取開始的通知，清除其他螢幕的選取框
        ipcMain.on('notify-selection-started', (event) => {
            const senderWindow = event.sender.getOwnerBrowserWindow();
            this.windowManager.screenshotWindows.forEach(win => {
                if (win !== senderWindow && !win.isDestroyed()) {
                    win.webContents.send('clear-other-selections');
                }
            });
        });
    }

    async takeScreenshotAndAnalyze(bounds) {
        try {
            console.log('接收到的截圖座標:', bounds);

            const displays = screen.getAllDisplays();
            const minX = Math.min(...displays.map(d => d.bounds.x));
            const minY = Math.min(...displays.map(d => d.bounds.y));
            const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
            const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));

            console.log('螢幕範圍:', { minX, minY, maxX, maxY });

            const imgCanvas = await this.captureScreen(displays, minX, minY, maxX, maxY);
            const croppedImageData = await this.cropImage(imgCanvas, bounds, minX, minY);
            
            const qrResult = await this.qrAnalyzer.analyzeQRCode(croppedImageData);
            
            if (qrResult.success) {
                // 儲存掃描紀錄（異步）
                const record = await this.dataStore.addScanRecord(qrResult.data);
                console.log('已儲存掃描紀錄:', record);
                
                // 通知主視窗更新
                const mainWindow = this.windowManager.getMainWindow();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-record-added', record);
                }
                
                this.notificationService.showSuccess('QR Code 解析成功', qrResult.data, qrResult.data);
            } else {
                this.notificationService.showError('QR Code 解析失敗', '未找到有效的 QR Code');
            }

        } catch (error) {
            console.error('截圖或解析錯誤:', error);
            this.notificationService.showError('錯誤', '截圖或 QR Code 解析過程中發生錯誤: ' + error.message);
        }
    }

    async captureScreen(displays, minX, minY, maxX, maxY) {
        try {
            const screenshots = await screenshot.listDisplays();
            console.log('找到的顯示器:', screenshots.length);
            
            if (screenshots.length > 1) {
                return await this.combineMultipleScreenshots(displays, screenshots, minX, minY, maxX, maxY);
            } else {
                return await this.captureSingleScreen();
            }
        } catch (error) {
            console.error('多螢幕截圖失敗，嘗試單螢幕模式:', error);
            return await this.captureSingleScreen();
        }
    }

    async combineMultipleScreenshots(displays, screenshots, minX, minY, maxX, maxY) {
        const canvas = require('canvas');
        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;
        const combinedCanvas = canvas.createCanvas(totalWidth, totalHeight);
        const ctx = combinedCanvas.getContext('2d');

        for (let i = 0; i < displays.length; i++) {
            const display = displays[i];
            const screenImg = await screenshot({ screen: screenshots[i].id });

            const tempScreenPath = path.join(app.getPath('temp'), `temp_screen_${i}.png`);
            fs.writeFileSync(tempScreenPath, screenImg);

            const screenCanvas = await canvas.loadImage(tempScreenPath);
            const offsetX = display.bounds.x - minX;
            const offsetY = display.bounds.y - minY;

            ctx.drawImage(screenCanvas, offsetX, offsetY);
            
            // 清理臨時檔案
            try {
                fs.unlinkSync(tempScreenPath);
            } catch (cleanupError) {
                console.error('清理臨時檔案失敗:', cleanupError);
            }
        }

        return combinedCanvas;
    }

    async captureSingleScreen() {
        const canvas = require('canvas');
        const img = await screenshot({ format: 'png' });
        const tempPath = path.join(app.getPath('temp'), 'temp_screenshot.png');
        fs.writeFileSync(tempPath, img);

        const loadedImg = await canvas.loadImage(tempPath);
        // 修正：將 image 寬高繪製到 canvas，確保寬高正確
        const imgCanvas = canvas.createCanvas(loadedImg.width, loadedImg.height);
        const ctx = imgCanvas.getContext('2d');
        ctx.drawImage(loadedImg, 0, 0);

        try {
            fs.unlinkSync(tempPath);
        } catch (cleanupError) {
            console.error('清理臨時檔案失敗:', cleanupError);
        }

        return imgCanvas;
    }

    async cropImage(imgCanvas, bounds, minX, minY) {
        const canvas = require('canvas');
        // 處理 Retina 顯示器 devicePixelRatio
        const devicePixelRatio = typeof screen !== 'undefined' && screen.getPrimaryDisplay ? screen.getPrimaryDisplay().scaleFactor : 1;
        const adjustedBounds = {
            x: Math.round((bounds.x - minX) * devicePixelRatio),
            y: Math.round((bounds.y - minY) * devicePixelRatio),
            width: Math.round(bounds.width * devicePixelRatio),
            height: Math.round(bounds.height * devicePixelRatio)
        };

        console.log('調整後的截圖座標:', adjustedBounds);
        console.log('完整截圖尺寸:', imgCanvas.width, 'x', imgCanvas.height);

        const cropCanvas = canvas.createCanvas(adjustedBounds.width, adjustedBounds.height);
        const ctx = cropCanvas.getContext('2d');

        ctx.drawImage(
            imgCanvas,
            adjustedBounds.x, adjustedBounds.y, adjustedBounds.width, adjustedBounds.height,
            0, 0, adjustedBounds.width, adjustedBounds.height
        );

        return ctx.getImageData(0, 0, adjustedBounds.width, adjustedBounds.height);
    }
}

module.exports = ScreenshotHandler;
