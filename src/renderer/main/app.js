import { DialogManager } from './ui/dialog-manager.js';
import { NotificationManager } from './ui/notification-manager.js';
import { ThemeManager } from './ui/theme-manager.js';
import { PaginationManager } from './ui/pagination-manager.js';
import { RecordRenderer } from './ui/record-renderer.js';
import { RecordManager } from './managers/record-manager.js';
import { SettingsManager } from './managers/settings-manager.js';
import { NavigationHandler } from './events/navigation-handler.js';
import { SearchHandler } from './events/search-handler.js';
import { SettingsHandler } from './events/settings-handler.js';
import { PaginationHandler } from './events/pagination-handler.js';

// 主應用程式類別
export class QRCodeApp {
    constructor() {
        // 初始化管理器
        this.initializeManagers();
        
        // 初始化事件處理器
        this.initializeHandlers();
        
        // 啟動應用程式
        this.init();
    }

    // 初始化管理器
    initializeManagers() {
        // UI管理器
        this.dialogManager = new DialogManager();
        this.notificationManager = new NotificationManager();
        this.themeManager = new ThemeManager();
        this.paginationManager = new PaginationManager(10);
        this.recordRenderer = new RecordRenderer(this.notificationManager);
        
        // 業務邏輯管理器
        this.recordManager = new RecordManager(this);
        this.settingsManager = new SettingsManager(this);
    }

    // 初始化事件處理器
    initializeHandlers() {
        this.navigationHandler = new NavigationHandler(this);
        this.searchHandler = new SearchHandler(this);
        this.settingsHandler = new SettingsHandler(this);
        this.paginationHandler = new PaginationHandler(this, this.paginationManager);
    }

    // 應用程式初始化
    async init() {
        try {
            // 載入設定
            await this.settingsManager.loadSettings(false);
            
            // 載入掃描紀錄
            await this.recordManager.loadScanRecords();
            
            // 更新主題
            this.themeManager.updateTheme();
            
            // 監聽來自主進程的事件
            this.setupIpcListeners();
            
            // 將app實例掛載到全域，供其他模組使用
            window.app = this;
            
            console.log('QRCode應用程式初始化完成');
        } catch (error) {
            console.error('應用程式初始化失敗:', error);
            this.notificationManager.error('應用程式初始化失敗');
        }
    }

    // 渲染當前頁面
    renderCurrentPage() {
        const currentPageRecords = this.paginationManager.getCurrentPageRecords();
        this.recordRenderer.render(currentPageRecords);
        this.paginationManager.updatePaginationUI();
    }

    // 設定IPC監聽器
    setupIpcListeners() {
        // 監聽新的掃描紀錄
        window.electronAPI.onScanRecordAdded((event, record) => {
            this.recordManager.addRecord(record);
            this.searchHandler.applyCurrentFilter();
            this.notificationManager.success('新增掃描紀錄：' + record.data.substring(0, 50));
        });

        // 監聽導航到設定頁
        window.electronAPI.onNavigateToSettings(() => {
            this.navigationHandler.navigateToPage('settings');
        });

        // 監聽設定更新
        window.electronAPI.onSettingsUpdated((event, settings) => {
            this.themeManager.updateTheme(settings.theme);
        });
    }
}

// 當DOM載入完成後初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    new QRCodeApp();
});
