// 設定事件處理器
export class SettingsHandler {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    // 設定事件監聽器
    setupEventListeners() {
        this.setupThemeListeners();
        this.setupCheckboxListeners();
        this.setupShortcutListeners();
        this.setupActionButtons();
    }

    // 設定主題相關監聽器
    setupThemeListeners() {
        // 主題變更（即時生效）
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    this.app.themeManager.updateTheme(e.target.value);
                    await window.electronAPI.updateTheme(e.target.value);
                }
            });
        });
    }

    // 設定複選框監聽器
    setupCheckboxListeners() {
        // 開機啟動（即時生效）
        document.getElementById('auto-launch').addEventListener('change', async (e) => {
            await window.electronAPI.updateAutoLaunch(e.target.checked);
        });

        // 退出模式（即時生效）
        document.getElementById('exit-to-tray').addEventListener('change', async (e) => {
            await window.electronAPI.updateExitToTray(e.target.checked);
        });
    }

    // 設定快捷鍵監聽器
    setupShortcutListeners() {
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

            // 處理主要按鍵
            let mainKey = this.getMainKey(e);
            
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
                
                // 如果沒有實際輸入快捷鍵，恢復原來的設定值並重新啟用快捷鍵
                if (shortcutInput.value === '按下快捷鍵組合...') {
                    try {
                        const settings = await window.electronAPI.getSettings();
                        const originalShortcut = settings.shortcut || 'Alt+Shift+S';
                        shortcutInput.value = originalShortcut;
                        
                        // 重新啟用快捷鍵
                        await window.electronAPI.updateShortcut(originalShortcut);
                    } catch (error) {
                        console.error('恢復快捷鍵失敗:', error);
                        shortcutInput.value = 'Alt+Shift+S';
                        // 嘗試重新啟用預設快捷鍵
                        try {
                            await window.electronAPI.updateShortcut('Alt+Shift+S');
                        } catch (e) {
                            console.error('重新啟用預設快捷鍵失敗:', e);
                        }
                    }
                } else {
                    // 如果有輸入內容但不是預期格式，也要重新啟用快捷鍵
                    try {
                        await window.electronAPI.updateShortcut(shortcutInput.value);
                    } catch (error) {
                        console.error('重新啟用快捷鍵失敗:', error);
                    }
                }
            }
        });
    }

    // 獲取主要按鍵
    getMainKey(e) {
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
        return mainKey;
    }

    // 設定動作按鈕
    setupActionButtons() {
        // 重設設定
        document.getElementById('reset-settings').addEventListener('click', async () => {
            const confirmed = await this.app.dialogManager.showCustomDialog(
                '重設設定',
                '確定要重設所有設定為預設值嗎？'
            );
            if (confirmed) {
                await this.app.settingsManager.resetSettings();
            }
        });

        // 刪除所有紀錄
        document.getElementById('clear-records').addEventListener('click', async () => {
            const confirmed = await this.app.dialogManager.showCustomDialog(
                '刪除所有紀錄',
                '確定要刪除所有掃描紀錄嗎？此操作無法復原！'
            );
            if (confirmed) {
                await this.app.recordManager.clearAllRecords();
            }
        });
    }

    // 重設設定
    async resetSettings() {
        await this.app.settingsManager.resetSettings();
    }
}
