import { CommonUtils } from '../utils/common.js';

// 紀錄渲染器
export class RecordRenderer {
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
    }

    /**
     * 渲染記錄列表
     */
    render(records) {
        const recordsList = document.getElementById('records-list');
        
        if (records.length === 0) {
            recordsList.innerHTML = `
                <div class="no-records">
                    <p>目前沒有掃描紀錄</p>
                </div>
            `;
            return;
        }

        const recordsHTML = records.map(record => this.renderRecord(record)).join('');
        recordsList.innerHTML = recordsHTML;

        // 綁定記錄操作事件
        this.bindRecordEvents();
    }

    /**
     * 渲染單個記錄
     */
    renderRecord(record) {
        const displayTitle = record.title || (this.isUrl(record.data) ? new URL(record.data).hostname : record.data.substring(0, 50));
        
        return `
            <div class="record-item" data-id="${record.id}">
                <div class="record-content">
                    <div class="record-header">
                        <h3 class="record-title">${CommonUtils.escapeHtml(displayTitle)}</h3>
                        <span class="record-time">${CommonUtils.formatDateTime(record.timestamp)}</span>
                    </div>
                    <p class="record-data">${CommonUtils.escapeHtml(record.data)}</p>
                </div>
                <div class="record-actions">
                    <button class="action-btn copy-btn" data-id="${record.id}" data-action="copy" title="複製">
                        <img src="../../assets/copy.svg" alt="複製" class="action-icon" width="16" height="16">
                    </button>
                    ${this.isUrl(record.data) ? `
                        <button class="action-btn open-btn" data-id="${record.id}" data-action="open" title="開啟連結">
                            <img src="../../assets/open-external.svg" alt="開啟" class="action-icon" width="16" height="16">
                        </button>
                    ` : ''}
                    <button class="action-btn delete-btn" data-id="${record.id}" data-action="delete" title="刪除">
                        <img src="../../assets/cross.svg" alt="刪除" class="action-icon" width="16" height="16">
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 判斷是否為URL
     */
    isUrl(text) {
        try {
            new URL(text);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 綁定記錄操作事件
     */
    bindRecordEvents() {
        // 複製按鈕
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const recordData = this.getRecordData(id);
                if (recordData) {
                    try {
                        await window.electronAPI.shareText(recordData);
                        this.notificationManager.success('內容已複製到剪貼簿');
                    } catch (error) {
                        this.notificationManager.error('複製失敗');
                    }
                }
            });
        });

        // 開啟連結按鈕
        document.querySelectorAll('.open-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const recordData = this.getRecordData(id);
                if (recordData && this.isUrl(recordData)) {
                    try {
                        await window.electronAPI.openUrl(recordData);
                    } catch (error) {
                        this.notificationManager.error('開啟連結失敗');
                    }
                }
            });
        });

        // 刪除按鈕
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.deleteRecord(id);
            });
        });
    }

    /**
     * 獲取記錄資料
     */
    getRecordData(id) {
        const recordElement = document.querySelector(`[data-id="${id}"]`);
        if (recordElement) {
            const recordData = recordElement.querySelector('.record-data');
            return recordData ? recordData.textContent : null;
        }
        return null;
    }

    /**
     * 刪除記錄
     */
    async deleteRecord(id) {
        // 呼叫主程式的記錄管理器的刪除方法
        if (window.app && window.app.recordManager && window.app.recordManager.deleteRecord) {
            await window.app.recordManager.deleteRecord(id);
        }
    }
}
