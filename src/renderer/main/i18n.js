// 多國語言載入與切換
const SUPPORTED_LOCALES = {
    'zh-TW': 'zh-TW',
    'zh-HK': 'zh-TW',
    'zh-CN': 'zh-CN',
    'en': 'en',
    'en-US': 'en',
    'en-GB': 'en',
    'ja': 'ja',
    'ja-JP': 'ja'
};

let currentLocale = 'en';
let translations = {};

async function detectAndLoadLocale() {
    let locale = navigator.language || 'en';
    locale = SUPPORTED_LOCALES[locale] || (locale.split('-')[0] in SUPPORTED_LOCALES ? SUPPORTED_LOCALES[locale.split('-')[0]] : 'en');
    currentLocale = locale;
    translations = await fetchLocale(locale);
}

async function fetchLocale(locale) {
    try {
        const res = await fetch(`../../locales/${locale}.json`);
        return await res.json();
    } catch {
        const res = await fetch(`../../locales/en.json`);
        return await res.json();
    }
}

function t(key) {
    return translations[key] || key;
}

window.i18n = { t, detectAndLoadLocale };
