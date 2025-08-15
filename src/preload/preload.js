const { contextBridge, ipcRenderer } = require('electron');

// 公開安全的 API 給渲染進程
contextBridge.exposeInMainWorld('electronAPI', {
    clearScanRecords: () => ipcRenderer.invoke('clear-scan-records'),
    // 掃描紀錄相關
    getScanRecords: () => ipcRenderer.invoke('get-scan-records'),
    searchScanRecords: (params) => ipcRenderer.invoke('search-scan-records', params),
    deleteScanRecord: (id) => ipcRenderer.invoke('delete-scan-record', id),
    
    // 設定相關
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
    updateAutoLaunch: (enabled) => ipcRenderer.invoke('update-auto-launch', enabled),
    updateShortcut: (shortcut) => ipcRenderer.invoke('update-shortcut', shortcut),
    disableShortcut: () => ipcRenderer.invoke('disable-shortcut'),
    updateTheme: (theme) => ipcRenderer.invoke('update-theme', theme),
    updateExitToTray: (enabled) => ipcRenderer.invoke('update-exit-to-tray', enabled),
    getAvailableShortcuts: () => ipcRenderer.invoke('get-available-shortcuts'),
    validateShortcut: (shortcut) => ipcRenderer.invoke('validate-shortcut', shortcut),
    
    // 系統功能
    openUrl: (url) => ipcRenderer.invoke('open-url', url),
    shareText: (text) => ipcRenderer.invoke('share-text', text),
    triggerScreenshot: () => ipcRenderer.invoke('trigger-screenshot'),
    quitApp: () => ipcRenderer.invoke('quit-app'),
    
    // 事件監聽
    onScanRecordAdded: (callback) => {
        ipcRenderer.on('scan-record-added', callback);
        return () => ipcRenderer.removeListener('scan-record-added', callback);
    },
    
    onNavigateToSettings: (callback) => {
        ipcRenderer.on('navigate-to-settings', callback);
        return () => ipcRenderer.removeListener('navigate-to-settings', callback);
    },
    
    onSettingsUpdated: (callback) => {
        ipcRenderer.on('settings-updated', callback);
        return () => ipcRenderer.removeListener('settings-updated', callback);
    }
});
