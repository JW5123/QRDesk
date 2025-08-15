// 對話框管理器
export class DialogManager {
    constructor() {
        this.setupCloseHandlers();
    }

    /**
     * 顯示自訂對話框
     */
    showCustomDialog(title, message) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('custom-dialog');
            const titleEl = document.getElementById('dialog-title');
            const messageEl = document.getElementById('dialog-message');
            const confirmBtn = document.getElementById('dialog-confirm');
            const cancelBtn = document.getElementById('dialog-cancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            dialog.classList.remove('hidden');

            // 處理確認按鈕
            const handleConfirm = () => {
                dialog.classList.add('hidden');
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                resolve(true);
            };

            // 處理取消按鈕
            const handleCancel = () => {
                dialog.classList.add('hidden');
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                resolve(false);
            };

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
        });
    }

    /**
     * 設定對話框關閉處理器
     */
    setupCloseHandlers() {
        // ESC 鍵關閉對話框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const dialog = document.getElementById('custom-dialog');
                if (!dialog.classList.contains('hidden')) {
                    dialog.classList.add('hidden');
                }
            }
        });
    }
}
