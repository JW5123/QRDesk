// 主題管理器
export class ThemeManager {
    constructor() {
        this.initTheme();
    }

    /**
     * 初始化主題
     */
    initTheme() {
        // 程式啟動時清除暫存主題
        localStorage.removeItem('tempTheme');
    }

    /**
     * 更新主題
     */
    updateTheme(theme) {
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            const currentTheme = document.querySelector('input[name="theme"]:checked')?.value || 'system';
            document.documentElement.setAttribute('data-theme', currentTheme);
        }
    }

    /**
     * 設定主題選項到UI
     */
    setThemeUI(theme) {
        const themeInput = document.querySelector(`input[name="theme"][value="${theme}"]`);
        if (themeInput) {
            themeInput.checked = true;
        }
    }

    /**
     * 獲取當前選中的主題
     */
    getCurrentTheme() {
        const selectedTheme = document.querySelector('input[name="theme"]:checked');
        return selectedTheme ? selectedTheme.value : 'system';
    }
}
