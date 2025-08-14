const { app, globalShortcut } = require('electron');
const AutoLaunch = require('auto-launch');

class SettingsManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.autoLauncher = new AutoLaunch({
            name: 'QRCode Screenshot',
            path: app.getPath('exe')
        });
        
        this.currentShortcut = null;
        this.shortcutCallback = null;
    }

    async initializeSettings() {
        const settings = this.dataStore.getSettings();
        
        // 初始化開機啟動設定
        await this.updateAutoLaunch(settings.autoLaunch);
        
        return settings;
    }

    async updateAutoLaunch(enabled) {
        try {
            const isEnabled = await this.autoLauncher.isEnabled();
            
            if (enabled && !isEnabled) {
                await this.autoLauncher.enable();
                console.log('開機啟動已啟用');
            } else if (!enabled && isEnabled) {
                await this.autoLauncher.disable();
                console.log('開機啟動已停用');
            }
            
            this.dataStore.setSetting('autoLaunch', enabled);
            return true;
        } catch (error) {
            console.error('設定開機啟動時發生錯誤:', error);
            return false;
        }
    }

    updateShortcut(shortcut, callback) {
        // 移除舊的快捷鍵
        if (this.currentShortcut) {
            globalShortcut.unregister(this.currentShortcut);
        }

        // 註冊新的快捷鍵
        try {
            const success = globalShortcut.register(shortcut, callback);
            
            if (success) {
                this.currentShortcut = shortcut;
                this.shortcutCallback = callback;
                this.dataStore.setSetting('shortcut', shortcut);
                console.log(`快捷鍵 ${shortcut} 註冊成功`);
                return true;
            } else {
                console.error(`快捷鍵 ${shortcut} 註冊失敗`);
                return false;
            }
        } catch (error) {
            console.error('註冊快捷鍵時發生錯誤:', error);
            return false;
        }
    }

    disableShortcut() {
        // 暫時停用當前快捷鍵
        if (this.currentShortcut) {
            globalShortcut.unregister(this.currentShortcut);
            console.log(`快捷鍵 ${this.currentShortcut} 已停用`);
        }
    }


    updateTheme(theme) {
        this.dataStore.setSetting('theme', theme);
        
        // 通知主程式更新主題
        const { nativeTheme } = require('electron');
        
        switch (theme) {
            case 'light':
                nativeTheme.themeSource = 'light';
                break;
            case 'dark':
                nativeTheme.themeSource = 'dark';
                break;
            case 'system':
            default:
                nativeTheme.themeSource = 'system';
                break;
        }

        return theme;
    }

    updateExitToTray(enabled) {
        this.dataStore.setSetting('exitToTray', enabled);
        return enabled;
    }

    validateShortcut(shortcut) {
        // 驗證快捷鍵格式
        const validModifiers = ['Ctrl', 'Alt', 'Shift', 'Cmd', 'Super'];
        const parts = shortcut.split('+');
        
        if (parts.length < 2) return false;
        
        const modifiers = parts.slice(0, -1);
        const key = parts[parts.length - 1];
        
        // 檢查修飾鍵
        for (const modifier of modifiers) {
            if (!validModifiers.includes(modifier)) 
                return false;
        }
        
        // 檢查按鍵
        if (key.length === 0) 
            return false;
        
        return true;
    }

    cleanup() {
        // 清理快捷鍵
        if (this.currentShortcut) {
            globalShortcut.unregister(this.currentShortcut);
            this.currentShortcut = null;
        }
    }
}

module.exports = SettingsManager;