const WINDOW_CONFIG = {
    MAIN: {
        width: 1000,
        height: 700,
        show: false,
        skipTaskbar: false
    },
    SCREENSHOT: {
        frame: false,
        transparent: true,
        alwaysOnTop: true
    }
};

const SCREENSHOT_CONFIG = {
    MIN_SIZE: 10,
    DELAY: 200,
    NOTIFICATION_TIMEOUT: 10000
};

const APP_CONFIG = {
    APP_NAME: 'QR Code 掃描工具',
    VERSION: '1.0.0'
};

module.exports = {
    WINDOW_CONFIG,
    SCREENSHOT_CONFIG,
    APP_CONFIG
};
