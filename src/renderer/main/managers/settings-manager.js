import { CommonUtils } from '../utils/common.js';

// 設定管理器
export class SettingsManager {
    constructor(app) {
        this.app = app;
    }

    // 載入設定
    async loadSettings(useTempTheme = false) {
        try {
            const settings = await window.electronAPI.getSettings();
            
            // 更新設定介面
            this.updateSettingsUI(settings);
            
            // 處理主題設定
            this.handleThemeSettings(settings, useTempTheme);
            
            return settings;
        } catch (error) {
            console.error('載入設定失敗:', error);
            this.app.notificationManager.error('載入設定失敗');
            throw error;
        }
    }

    // 更新設定UI
    updateSettingsUI(settings) {
        // 更新複選框
        const autoLaunchEl = document.getElementById('auto-launch');
        const exitToTrayEl = document.getElementById('exit-to-tray');
        
        if (autoLaunchEl) autoLaunchEl.checked = settings.autoLaunch;
        if (exitToTrayEl) exitToTrayEl.checked = settings.exitToTray;
        
        // 載入快捷鍵
        const shortcutInputEl = document.getElementById('shortcut-input');
        if (shortcutInputEl) {
            shortcutInputEl.value = settings.shortcut || 'Alt+Shift+S';
        }
    }

    // 處理主題設定
    handleThemeSettings(settings, useTempTheme) {
        let themeToUse = settings.theme;
        
        if (useTempTheme) {
            const tempTheme = localStorage.getItem('tempTheme');
            if (tempTheme) themeToUse = tempTheme;
        } else {
            // 每次正式載入時清除暫存主題
            localStorage.removeItem('tempTheme');
        }
        
        this.app.themeManager.setThemeUI(themeToUse);
    }

    // 重設設定
    async resetSettings() {
        try {
            CommonUtils.showLoading(true);
            
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
            this.app.themeManager.updateTheme(defaultSettings.theme);
            this.app.notificationManager.success('設定已重設為預設值');
        } catch (error) {
            console.error('重設設定失敗:', error);
            this.app.notificationManager.error('重設設定失敗');
        } finally {
            CommonUtils.showLoading(false);
        }
    }

    // 恢復快捷鍵（保留相容性）
    async restoreShortcut() {
        try {
            const settings = await window.electronAPI.getSettings();
            const shortcutInput = document.getElementById('shortcut-input');
            const currentInputValue = shortcutInput ? shortcutInput.value : '';
            
            if (currentInputValue && currentInputValue !== settings.shortcut) {
                await window.electronAPI.updateShortcut(settings.shortcut);
            } else if (!currentInputValue || currentInputValue === '按下快捷鍵組合...') {
                await window.electronAPI.updateShortcut(settings.shortcut);
            }
        } catch (error) {
            console.error('恢復快捷鍵失敗:', error);
        }
    }
}
