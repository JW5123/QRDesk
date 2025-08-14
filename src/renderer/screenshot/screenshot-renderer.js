const { ipcRenderer } = require('electron');
const { SCREENSHOT_CONFIG } = require('../../utils/constants');

class ScreenshotRenderer {
    constructor() {
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.screenBounds = null;
        
        this.selectionBox = document.getElementById('selectionBox');
        this.instructions = document.querySelector('.instructions');
        this.masks = {
            top: document.getElementById('maskTop'),
            bottom: document.getElementById('maskBottom'),
            left: document.getElementById('maskLeft'),
            right: document.getElementById('maskRight')
        };
        
        this.init();
    }

    init() {
        this.instructions.style.display = 'none';
        this.setupEventListeners();
        this.setupIpcHandlers();
        this.ensureFullScreenCoverage();
        window.focus();
    }

    ensureFullScreenCoverage() {
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        
        document.body.style.width = screenWidth + 'px';
        document.body.style.height = screenHeight + 'px';
        document.body.style.position = 'absolute';
        document.body.style.top = '0';
        document.body.style.left = '0';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        
        const overlay = document.querySelector('.full-screen-overlay');
        if (overlay) {
            overlay.style.width = screenWidth + 'px';
            overlay.style.height = screenHeight + 'px';
        }
    }

    setupEventListeners() {
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('selectstart', (e) => e.preventDefault());
        
        window.addEventListener('resize', () => this.ensureFullScreenCoverage());
    }

    setupIpcHandlers() {
        ipcRenderer.on('set-screen-info', (event, info) => {
            this.screenBounds = info.bounds;
            if (info.isPrimary) {
                setTimeout(() => {
                    this.instructions.style.display = 'block';
                }, 100);
            }
        });

        // 監聽來自其他螢幕的清除選取框訊號
        ipcRenderer.on('clear-other-selections', () => {
            this.clearSelection();
        });
    }

    handleMouseDown(e) {
        // 通知其他螢幕清除選取框
        ipcRenderer.send('notify-selection-started');
        
        this.isSelecting = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        this.selectionBox.style.left = this.startX + 'px';
        this.selectionBox.style.top = this.startY + 'px';
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        this.selectionBox.style.display = 'block';
        
        this.instructions.style.display = 'none';
        
        // 隱藏全螢幕遮罩，顯示四個分割遮罩
        document.querySelector('.full-screen-overlay').style.display = 'none';
        this.updateMasks();
        
        e.preventDefault();
        e.stopPropagation();
    }

    handleMouseMove(e) {
        if (!this.isSelecting) return;
        
        this.currentX = e.clientX;
        this.currentY = e.clientY;
        
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);
        const left = Math.min(this.startX, this.currentX);
        const top = Math.min(this.startY, this.currentY);
        
        this.selectionBox.style.left = left + 'px';
        this.selectionBox.style.top = top + 'px';
        this.selectionBox.style.width = width + 'px';
        this.selectionBox.style.height = height + 'px';
        
        this.updateMasks();
    }

    handleMouseUp() {
        this.isSelecting = false;
        
        const width = parseInt(this.selectionBox.style.width);
        const height = parseInt(this.selectionBox.style.height);
        
        if (width < SCREENSHOT_CONFIG.MIN_SIZE || height < SCREENSHOT_CONFIG.MIN_SIZE) {
            this.resetMasks();
            if (this.screenBounds) {
                this.instructions.style.display = 'block';
            }
        }
    }

    updateMasks() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        const selectionLeft = parseInt(this.selectionBox.style.left);
        const selectionTop = parseInt(this.selectionBox.style.top);
        const selectionWidth = parseInt(this.selectionBox.style.width);
        const selectionHeight = parseInt(this.selectionBox.style.height);
        const selectionRight = selectionLeft + selectionWidth;
        const selectionBottom = selectionTop + selectionHeight;
        
        // 遮罩配置：[left, top, width, height]
        const maskConfigs = {
            top: [0, 0, screenWidth, selectionTop],
            bottom: [0, selectionBottom, screenWidth, screenHeight - selectionBottom],
            left: [0, selectionTop, selectionLeft, selectionHeight],
            right: [selectionRight, selectionTop, screenWidth - selectionRight, selectionHeight]
        };
        
        // 統一設置所有遮罩
        Object.keys(maskConfigs).forEach(maskName => {
            const mask = this.masks[maskName];
            const [left, top, width, height] = maskConfigs[maskName];
            
            mask.style.display = 'block';
            mask.style.left = left + 'px';
            mask.style.top = top + 'px';
            mask.style.width = width + 'px';
            mask.style.height = height + 'px';
        });
    }

    resetMasks() {
        Object.values(this.masks).forEach(mask => {
            mask.style.display = 'none';
        });
        document.querySelector('.full-screen-overlay').style.display = 'block';
    }

    clearSelection() {
        // 如果當前正在選取，則不清除（避免清除自己正在建立的選取框）
        if (this.isSelecting) return;
        
        // 清除選取框
        this.selectionBox.style.display = 'none';
        this.resetMasks();
        
        // 如果是主螢幕，重新顯示操作說明
        if (this.screenBounds && this.instructions) {
            this.instructions.style.display = 'block';
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && this.selectionBox.style.display === 'block') {
            this.takeScreenshot();
        } else if (e.key === 'Escape') {
            ipcRenderer.send('cancel-screenshot');
        }
    }

    takeScreenshot() {
        if (!this.screenBounds) return;

        const bounds = {
            x: this.screenBounds.x + parseInt(this.selectionBox.style.left),
            y: this.screenBounds.y + parseInt(this.selectionBox.style.top),
            width: parseInt(this.selectionBox.style.width),
            height: parseInt(this.selectionBox.style.height)
        };
        
        if (bounds.width > SCREENSHOT_CONFIG.MIN_SIZE && bounds.height > SCREENSHOT_CONFIG.MIN_SIZE) {
            ipcRenderer.send('take-screenshot', bounds);
        } else {
            alert('請選擇一個有效的區域');
            this.resetMasks();
            if (this.screenBounds) {
                this.instructions.style.display = 'block';
            }
        }
    }
}

new ScreenshotRenderer();