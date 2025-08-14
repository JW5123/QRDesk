const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');
const TitleExtractor = require('./title-extractor');

class DataStore {
    constructor() {
        this.store = new Store.default({
            defaults: {
                scanRecords: [],
                settings: {
                    autoLaunch: false,
                    exitToTray: true,
                    shortcut: 'Alt+Shift+S',
                    theme: 'system', // 'system', 'light', 'dark'
                    lastWindowSize: { width: 1000, height: 700 }
                }
            }
        });
        
        this.titleExtractor = new TitleExtractor();
        
        // 遷移現有紀錄以添加標題欄位
        this.migrateRecords();
    }

    // 遷移現有紀錄
    migrateRecords() {
        const records = this.store.get('scanRecords', []);
        let hasUpdates = false;
        
        const updatedRecords = records.map(record => {
            if (!record.title) {
                record.title = this.extractTitleSync(record.data);
                hasUpdates = true;
            }
            return record;
        });
        
        if (hasUpdates) {
            this.store.set('scanRecords', updatedRecords);
        }
    }

    // 掃描紀錄相關方法
    async addScanRecord(qrData, imagePath = null) {
        const records = this.store.get('scanRecords', []);
        
        // 先創建基本紀錄
        const newRecord = {
            id: uuidv4(),
            data: qrData,
            title: await this.extractTitle(qrData),
            imagePath,
            timestamp: new Date().toISOString(),
            createdAt: new Date().getTime()
        };
        
        records.unshift(newRecord); // 新記錄加在最前面
        this.store.set('scanRecords', records);
        return newRecord;
    }

    // 提取標題（異步版本）
    async extractTitle(data) {
        try {
            // 如果是 URL，嘗試提取網頁標題
            if (data.startsWith('http://') || data.startsWith('https://')) {
                const webTitle = await this.titleExtractor.extractTitle(data);
                if (webTitle) {
                    return webTitle;
                }
                
                // 如果網頁標題提取失敗，使用網域名稱
                try {
                    const url = new URL(data);
                    return url.hostname;
                } catch {
                    // URL 解析失敗，使用原有邏輯
                    return this.extractTitleSync(data);
                }
            }
            
            // 非 URL 內容使用同步方法
            return this.extractTitleSync(data);
            
        } catch (error) {
            console.error('提取標題時發生錯誤:', error);
            return this.extractTitleSync(data);
        }
    }

    // 從 QR 碼內容提取標題（同步版本，用於非 URL 內容）
    extractTitleSync(data) {
        try {
            // 如果是 WiFi 配置格式
            if (data.startsWith('WIFI:')) {
                const ssidMatch = data.match(/S:([^;]*)/);
                return ssidMatch ? `WiFi: ${ssidMatch[1]}` : 'WiFi 配置';
            }
            
            // 如果是聯絡人資訊
            if (data.startsWith('BEGIN:VCARD') || data.startsWith('MECARD:')) {
                const nameMatch = data.match(/(?:FN:|N:)([^;\r\n]*)/);
                return nameMatch ? `${nameMatch[1]}` : '聯絡人資訊';
            }
            
            // 如果是電話號碼
            if (data.startsWith('tel:') || /^[\+]?[\d\-\(\)\s]{10,}$/.test(data)) {
                return '電話號碼';
            }
            
            // 如果是電子郵件
            if (data.includes('@') && data.includes('.') && !data.startsWith('http')) {
                return '電子郵件';
            }
            
            // 如果是地理位置
            if (data.startsWith('geo:')) {
                return '地理位置';
            }
            
            // 如果內容較短，直接作為標題
            if (data.length <= 50) {
                return data;
            }
            
            // 取前50個字元作為標題
            return data.substring(0, 50) + '...';
            
        } catch (error) {
            // 如果解析失敗，返回前50個字元
            return data.length <= 50 ? data : data.substring(0, 50) + '...';
        }
    }

    getScanRecords() {
        return this.store.get('scanRecords', []);
    }

    deleteScanRecord(id) {
        const records = this.store.get('scanRecords', []);
        const filtered = records.filter(record => record.id !== id);
        this.store.set('scanRecords', filtered);
        return filtered;
    }

    clearScanRecords() {
        this.store.set('scanRecords', []);
    }

    searchScanRecords(query, startDate = null, endDate = null) {
        const records = this.store.get('scanRecords', []);
        let filtered = records;

        // 文字搜尋（搜尋標題和內容）
        if (query && query.trim()) {
            const searchQuery = query.toLowerCase();
            filtered = filtered.filter(record => 
                (record.data && record.data.toLowerCase().includes(searchQuery)) ||
                (record.title && record.title.toLowerCase().includes(searchQuery))
            );
        }

        // 日期範圍搜尋
        if (startDate || endDate) {
            filtered = filtered.filter(record => {
                const recordDate = new Date(record.timestamp);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;
                
                if (start && recordDate < start) return false;
                if (end && recordDate > end) return false;
                return true;
            });
        }

        return filtered;
    }

    // 設定相關方法
    getSettings() {
        return this.store.get('settings');
    }

    updateSettings(newSettings) {
        const currentSettings = this.store.get('settings');
        const updated = { ...currentSettings, ...newSettings };
        this.store.set('settings', updated);
        return updated;
    }

    getSetting(key) {
        return this.store.get(`settings.${key}`);
    }

    setSetting(key, value) {
        this.store.set(`settings.${key}`, value);
    }
}

module.exports = DataStore;
