const https = require('https');
const http = require('http');
const { URL } = require('url');

class TitleExtractor {
    constructor() {
        // 設定 User-Agent 避免被網站阻擋
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.timeout = 10000; // 10 秒超時
        this.maxContentLength = 1024 * 1024; // 1MB 最大內容大小
    }

    async extractTitle(url) {
        try {
            // 驗證 URL
            if (!this.isValidUrl(url)) {
                return null;
            }

            const parsedUrl = new URL(url);
            
            // 特殊處理不同網站
            const specialTitle = await this.handleSpecialSites(parsedUrl, url);
            if (specialTitle) {
                return specialTitle;
            }

            // 一般網站標題提取
            const html = await this.fetchHtml(url);
            if (!html) {
                return null;
            }

            return this.parseTitle(html, parsedUrl);

        } catch (error) {
            console.error('提取標題時發生錯誤:', error.message);
            return null;
        }
    }

    // 驗證 URL 是否有效
    isValidUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }

    // 處理特殊網站
    async handleSpecialSites(parsedUrl, originalUrl) {
        const hostname = parsedUrl.hostname.toLowerCase();

        // Google Maps
        if (hostname.includes('maps.google') || hostname.includes('goo.gl')) {
            return await this.extractGoogleMapsTitle(originalUrl);
        }

        // YouTube
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            return await this.extractYouTubeTitle(originalUrl);
        }

        // Facebook
        if (hostname.includes('facebook.com') || hostname.includes('fb.me')) {
            return await this.extractFacebookTitle(originalUrl);
        }

        return null;
    }

    // Google Maps 標題提取
    async extractGoogleMapsTitle(url) {
        try {
            console.log('處理 Google Maps URL:', url);
            
            // 處理短網址
            if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
                console.log('展開短網址...');
                url = await this.expandShortUrl(url);
                console.log('展開後的 URL:', url);
            }

            const html = await this.fetchHtml(url);
            if (!html) {
                console.log('無法獲取 HTML 內容');
                return null;
            }

            console.log('HTML 內容長度:', html.length);
            
            // 嘗試多種方式提取地點名稱
            const patterns = [
                // 新版 Google Maps 的 JSON-LD 結構
                /"name":"([^"]+)"/i,
                // 地點名稱的各種可能模式
                /<h1[^>]*data-value="([^"]+)"/i,
                /<h1[^>]*>([^<]+)<\/h1>/i,
                // meta property
                /<meta property="og:title" content="([^"]+)"/i,
                /<meta name="twitter:title" content="([^"]+)"/i,
                // aria-label
                /aria-label="([^"]+)"/i,
                // data-value 屬性
                /data-value="([^"]+)"/i,
                // title 標籤
                /<title[^>]*>([^<]+)<\/title>/i,
                // JSON 結構中的地點名稱
                /"title":"([^"]+)"/i,
                // 其他可能的模式
                /place_name['"]\s*:\s*['"]([^'"]+)['"]/i
            ];

            for (let i = 0; i < patterns.length; i++) {
                const pattern = patterns[i];
                const match = html.match(pattern);
                console.log(`Pattern ${i + 1}: ${match ? '找到' : '未找到'}`);
                
                if (match && match[1]) {
                    let title = match[1].trim();
                    
                    // 跳過無意義的標題
                    if (title.length < 2 || 
                        title.toLowerCase().includes('google') && title.length < 15 ||
                        title.toLowerCase().includes('maps') && title.length < 10) {
                        console.log(`跳過無意義的標題: ${title}`);
                        continue;
                    }
                    
                    // 清理 Google Maps 特有的後綴
                    title = title.replace(/\s*-\s*Google\s*(地圖|Maps).*$/i, '');
                    title = title.replace(/\s*·\s*Google\s*(地圖|Maps).*$/i, '');
                    title = title.replace(/\s*\|\s*Google\s*(地圖|Maps).*$/i, '');
                    title = title.replace(/Google\s*(地圖|Maps)/i, '').trim();
                    
                    // 解碼 HTML 實體
                    title = this.decodeHtmlEntities(title);
                    
                    if (title && title.length > 0) {
                        console.log('提取到的標題:', title);
                        return `📍 ${title}`;
                    }
                }
            }

            // 如果都找不到，嘗試從 URL 解析
            console.log('從 URL 解析地點名稱...');
            const urlPatterns = [
                /\/place\/([^\/\?&]+)/,
                /\/data=[^!]*![^!]*![^!]*!([^!]+)!/,
                /q=([^&]+)/
            ];
            
            for (const urlPattern of urlPatterns) {
                const urlMatch = url.match(urlPattern);
                if (urlMatch && urlMatch[1]) {
                    let placeName = decodeURIComponent(urlMatch[1]).replace(/\+/g, ' ');
                    placeName = placeName.replace(/[,\s]+$/, ''); // 移除尾部逗號和空格
                    console.log('從 URL 提取到:', placeName);
                    return `📍 ${placeName}`;
                }
            }

            console.log('無法提取 Google Maps 標題');
            return null;
        } catch (error) {
            console.error('Google Maps 標題提取失敗:', error.message);
            return null;
        }
    }

    // YouTube 標題提取
    async extractYouTubeTitle(url) {
        try {
            console.log('處理 YouTube URL:', url);
            
            const html = await this.fetchHtml(url);
            if (!html) {
                console.log('無法獲取 HTML 內容');
                return null;
            }

            console.log('HTML 內容長度:', html.length);

            const patterns = [
                // YouTube 的 JSON-LD 結構
                /"videoDetails":{"videoId":"[^"]*","title":"([^"]+)"/i,
                // meta property (最可靠)
                /<meta property="og:title" content="([^"]+)"/i,
                /<meta name="twitter:title" content="([^"]+)"/i,
                // title 標籤
                /<title[^>]*>([^<]+)<\/title>/i,
                // YouTube 特定的 JSON 結構
                /"title":{"runs":\[{"text":"([^"]+)"/i,
                /"title":"([^"]+)"/i,
                // 其他可能的模式
                /ytInitialPlayerResponse[^{]*{[^}]*"title":"([^"]+)"/i
            ];

            for (let i = 0; i < patterns.length; i++) {
                const pattern = patterns[i];
                const match = html.match(pattern);
                console.log(`YouTube Pattern ${i + 1}: ${match ? '找到' : '未找到'}`);
                
                if (match && match[1]) {
                    let title = match[1].trim();
                    
                    // 跳過無意義的標題
                    if (title.toLowerCase() === 'youtube' || title.length < 3) {
                        console.log(`跳過無意義的標題: ${title}`);
                        continue;
                    }
                    
                    // 清理 YouTube 特有的後綴
                    title = title.replace(/\s*-\s*YouTube.*$/i, '');
                    title = title.replace(/\s*\|\s*YouTube.*$/i, '');
                    
                    // 解碼 HTML 實體和 Unicode 轉義
                    title = this.decodeHtmlEntities(title);
                    title = this.decodeUnicodeEscapes(title);
                    
                    if (title && title.length > 0) {
                        console.log('提取到的 YouTube 標題:', title);
                        return `🎥 ${title}`;
                    }
                }
            }

            console.log('無法提取 YouTube 標題');
            return null;
        } catch (error) {
            console.error('YouTube 標題提取失敗:', error.message);
            return null;
        }
    }

    // Facebook 標題提取
    async extractFacebookTitle(url) {
        try {
            const html = await this.fetchHtml(url);
            if (!html) return null;

            const patterns = [
                /<meta property="og:title" content="([^"]+)"/i,
                /<title>([^<]+)<\/title>/i
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    let title = match[1].trim();
                    title = title.replace(/\s*\|\s*Facebook.*$/i, '');
                    if (title && title.length > 0) {
                        return `👥 ${title}`;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Facebook 標題提取失敗:', error.message);
            return null;
        }
    }

    // 擴展短網址
    async expandShortUrl(shortUrl) {
        return new Promise((resolve) => {
            console.log('展開短網址:', shortUrl);
            
            const urlModule = shortUrl.startsWith('https:') ? https : http;
            
            const req = urlModule.request(shortUrl, {
                method: 'HEAD',
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': '*/*'
                }
            }, (res) => {
                console.log('短網址回應狀態碼:', res.statusCode);
                console.log('Location header:', res.headers.location);
                
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let expandedUrl = res.headers.location;
                    // 處理相對 URL
                    if (expandedUrl.startsWith('/')) {
                        const originalUrl = new URL(shortUrl);
                        expandedUrl = `${originalUrl.protocol}//${originalUrl.host}${expandedUrl}`;
                    }
                    console.log('展開的 URL:', expandedUrl);
                    resolve(expandedUrl);
                } else {
                    console.log('沒有重定向，使用原 URL');
                    resolve(shortUrl);
                }
            });

            req.on('error', (error) => {
                console.error('展開短網址失敗:', error.message);
                resolve(shortUrl);
            });
            
            req.on('timeout', () => {
                console.log('展開短網址超時');
                req.destroy();
                resolve(shortUrl);
            });

            req.end();
        });
    }

    // 獲取 HTML 內容
    async fetchHtml(url) {
        return new Promise((resolve) => {
            console.log('獲取 HTML:', url);
            
            const urlModule = url.startsWith('https:') ? https : http;
            
            const req = urlModule.request(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'identity',
                    'Cache-Control': 'no-cache',
                    'Connection': 'close'
                }
            }, (res) => {
                console.log('HTTP 狀態碼:', res.statusCode);
                
                // 處理重定向
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    console.log('重定向到:', res.headers.location);
                    req.destroy();
                    // 遞歸處理重定向
                    this.fetchHtml(res.headers.location).then(resolve);
                    return;
                }
                
                if (res.statusCode !== 200) {
                    console.log('HTTP 錯誤狀態:', res.statusCode);
                    resolve(null);
                    return;
                }
                
                // 檢查內容長度
                const contentLength = parseInt(res.headers['content-length'] || '0');
                if (contentLength > this.maxContentLength) {
                    console.log('內容太大:', contentLength);
                    resolve(null);
                    return;
                }

                let data = '';
                let receivedLength = 0;

                res.on('data', (chunk) => {
                    receivedLength += chunk.length;
                    if (receivedLength > this.maxContentLength) {
                        console.log('接收的內容超過限制');
                        req.destroy();
                        resolve(null);
                        return;
                    }
                    data += chunk;
                    
                    // 如果已經找到足夠的標題資訊，可以提前結束
                    if (data.includes('</title>') && data.includes('</head>')) {
                        console.log('已找到標題資訊，提前結束');
                        req.destroy();
                        resolve(data);
                        return;
                    }
                });

                res.on('end', () => {
                    console.log('HTML 獲取完成，長度:', data.length);
                    resolve(data);
                });
                
                res.on('error', (error) => {
                    console.error('接收資料錯誤:', error.message);
                    resolve(null);
                });
            });

            req.on('error', (error) => {
                console.error('請求錯誤:', error.message);
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

    // 解碼 HTML 實體
    decodeHtmlEntities(str) {
        if (!str) return str;
        
        return str
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/&#x([a-fA-F0-9]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    // 解碼 Unicode 轉義序列
    decodeUnicodeEscapes(str) {
        if (!str) return str;
        
        return str.replace(/\\u([a-fA-F0-9]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    // 解析 HTML 中的標題
    parseTitle(html, parsedUrl) {
        try {
            // 優先順序：og:title > title 標籤
            const patterns = [
                /<meta property="og:title" content="([^"]+)"/i,
                /<meta name="twitter:title" content="([^"]+)"/i,
                /<title>([^<]+)<\/title>/i
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    let title = this.cleanTitle(match[1]);
                    if (title && title.length > 0) {
                        return title;
                    }
                }
            }

            // 如果都找不到，返回網域名稱
            return parsedUrl.hostname;
        } catch (error) {
            return parsedUrl.hostname;
        }
    }

    // 清理標題
    cleanTitle(title) {
        if (!title) return '';
        
        // 解碼 HTML 實體和 Unicode
        title = this.decodeHtmlEntities(title);
        title = this.decodeUnicodeEscapes(title);
        
        // 移除多餘的空白字符
        title = title.replace(/\s+/g, ' ')
            .replace(/[\r\n\t]/g, ' ')
            .trim();
        
        // 移除常見的網站後綴
        const suffixesToRemove = [
            ' - Google 地圖',
            ' - YouTube',
            ' - Google Maps',
            ' | Facebook',
            '\\s*-\\s*.*$'  // 移除破折號後的內容（保守一點，先不用這個）
        ];
        
        for (let i = 0; i < suffixesToRemove.length - 1; i++) {
            const suffix = suffixesToRemove[i];
            if (title.endsWith(suffix)) {
                title = title.slice(0, -suffix.length).trim();
                break;
            }
        }
        
        return title.substring(0, 100); // 限制長度
    }
}

module.exports = TitleExtractor;