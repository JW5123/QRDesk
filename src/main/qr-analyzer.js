const jsQR = require('jsqr');

class QRAnalyzer {
    async analyzeQRCode(imageData) {
        try {
            // 第一次嘗試：不反轉 (一般白底黑碼QRCode)
            let code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert"
            });

            if (code) {
                console.log('QR Code 內容:', code.data);
                return {
                    success: true,
                    data: code.data
                };
            }

            // 第二次嘗試：嘗試反轉 (黑底白碼QRCode，彩色背景)
            code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth"
            });

            if (code) {
                console.log('QR Code 內容 (第二次嘗試):', code.data);
                return {
                    success: true,
                    data: code.data
                };
            }
            
            console.log('未找到有效的 QR Code');
            return {
                success: false,
                error: '未找到有效的 QR Code'
            };

        } catch (error) {
            console.error('QR Code 解析錯誤:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = QRAnalyzer;
