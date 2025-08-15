const { get } = require('https');
const { get: httpGet } = require('http');
const { URL } = require('url');

class TitleExtractor {
    constructor(options = {}) {
        this.timeout = options.timeout || 10000;
        this.maxContentLength = options.maxContentLength || 2048 * 1024; // 增加到 2MB
        this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    async extractTitle(url) {
        try {
            if (!this.isValidUrl(url)) return null;
            
            const parsedUrl = new URL(url);
            const finalUrl = await this.resolveRedirects(url);
            const html = await this.fetchHtml(finalUrl);
            
            if (!html) return null;

            const title = this.extractTitleFromHtml(html, new URL(finalUrl));
            return title || parsedUrl.hostname;
        } catch (error) {
            console.error(`標題提取錯誤: ${error.message}`);
            return null;
        }
    }

    isValidUrl(url) {
        try {
            const { protocol } = new URL(url);
            return ['http:', 'https:'].includes(protocol);
        } catch {
            return false;
        }
    }

    async resolveRedirects(url, maxRedirects = 5) {
        let currentUrl = url;
        
        for (let i = 0; i < maxRedirects; i++) {
            const redirectUrl = await this.getRedirectUrl(currentUrl);
            if (!redirectUrl || redirectUrl === currentUrl) break;
            currentUrl = redirectUrl;
        }
        
        return currentUrl;
    }

    async getRedirectUrl(url) {
        return new Promise(resolve => {
            const request = url.startsWith('https:') ? get : httpGet;
            
            const req = request(url, { 
                method: 'HEAD',
                timeout: this.timeout,
                headers: { 'User-Agent': this.userAgent }
            }, res => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    resolve(this.resolveUrl(url, res.headers.location));
                } else {
                    resolve(null);
                }
            });
            
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.end();
        });
    }

    resolveUrl(base, relative) {
        try {
            return new URL(relative, base).href;
        } catch {
            return relative;
        }
    }

    async fetchHtml(url) {
        return new Promise(resolve => {
            const request = url.startsWith('https:') ? get : httpGet;
            const options = {
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8,ja;q=0.7',
                    'Accept-Encoding': 'identity',
                    'Cache-Control': 'no-cache'
                }
            };
            
            const req = request(url, options, res => {
                if (res.statusCode !== 200) {
                    console.log(`HTTP 狀態: ${res.statusCode}`);
                    return resolve(null);
                }
                
                let data = '';
                let receivedLength = 0;
                
                res.on('data', chunk => {
                    receivedLength += chunk.length;
                    if (receivedLength > this.maxContentLength) {
                        req.destroy();
                        return resolve(data); // 返回已收到的部分
                    }
                    
                    data += chunk;
                });
                
                res.on('end', () => resolve(data));
                res.on('error', () => resolve(data || null));
            });
            
            req.on('error', err => {
                console.error(`請求錯誤: ${err.message}`);
                resolve(null);
            });
            req.on('timeout', () => { 
                console.log('請求超時');
                req.destroy(); 
                resolve(null); 
            });
            req.end();
        });
    }

    extractTitleFromHtml(html, parsedUrl) {
        // 通用標題提取模式 - 按成功率排序
        const patterns = [
            // Open Graph (最可靠)
            /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
            /<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i,
            
            // Twitter Cards
            /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i,
            /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:title["']/i,
            
            // JSON-LD 結構化數據
            /"name"\s*:\s*"([^"]+)"/i,
            /"title"\s*:\s*"([^"]+)"/i,
            
            // 傳統 title 標籤
            /<title[^>]*>([^<]+)<\/title>/i,
            
            // H1 標籤
            /<h1[^>]*>([^<]+)<\/h1>/i,
            
            // 特殊屬性
            /data-title=["']([^"']+)["']/i,
            /aria-label=["']([^"']+)["']/i,
            
            // URL 中的標題 (適用於 Google Maps 等)
            /[?&]q=([^&]+)/i,
            /\/place\/([^\/\?&]+)/i,
            /[?&]title=([^&]+)/i
        ];

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = html.match(pattern) || parsedUrl.href.match(pattern);
            
            if (match && match[1]) {
                let title = match[1].trim();
                
                // URL 參數需要解碼
                if (i >= patterns.length - 3) {
                    title = this.decodeUrlComponent(title);
                }
                
                // 驗證標題有效性
                if (this.isValidTitle(title)) {
                    const cleanedTitle = this.cleanTitle(title);
                    if (cleanedTitle) {
                        console.log(`Pattern ${i + 1} 成功提取: ${cleanedTitle}`);
                        return cleanedTitle;
                    }
                }
            }
        }
        
        console.log('未找到有效標題');
        return null;
    }

    decodeUrlComponent(str) {
        try {
            return decodeURIComponent(str.replace(/\+/g, ' '));
        } catch {
            return str;
        }
    }

    isValidTitle(title) {
        if (!title || typeof title !== 'string') return false;
        
        title = title.trim();
        
        // 基本長度檢查
        if (title.length < 2 || title.length > 200) return false;
        
        // 排除無意義的標題
        const invalidPatterns = [
            /^(google|youtube|facebook|twitter|instagram)$/i,
            /^[\s\-_=]+$/,
            /^(404|error|not found)$/i,
            /^[0-9]+$/,
            /^(home|main|index)$/i
        ];
        
        return !invalidPatterns.some(pattern => pattern.test(title));
    }

    cleanTitle(title) {
        if (!title) return '';
        
        // 解碼 HTML 實體和 Unicode
        title = this.decodeHtmlEntities(title);
        
        // 清理多餘空白
        title = title.replace(/\s+/g, ' ').trim();
        
        // 移除常見網站後綴 (更積極的清理)
        const cleanPatterns = [
            / - Google (地圖|Maps).*$/i,
            / - YouTube.*$/i,
            / \| Facebook.*$/i,
            / - Google.*$/i,
            / \| Twitter.*$/i,
            / - 首頁.*$/i,
            / - Home.*$/i,
            /\s*[\|\-]\s*$/, // 移除尾部的分隔符
        ];
        
        for (const pattern of cleanPatterns) {
            title = title.replace(pattern, '').trim();
        }
        
        return title.substring(0, 100);
    }

    decodeHtmlEntities(str) {
        const entities = {
            '&amp;': '&', '&lt;': '<', '&gt;': '>', 
            '&quot;': '"', '&apos;': "'", '&#39;': "'",
            '&nbsp;': ' '
        };
        
        return str
            .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/gi, match => entities[match.toLowerCase()] || match)
            .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec)))
            .replace(/&#x([a-f0-9]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\\u([a-f0-9]{4})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
}

module.exports = TitleExtractor;