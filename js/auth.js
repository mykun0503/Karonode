let _cachedServerDeviceId = null;

const auth = {
    DEVICE_ID_KEY: 'karonode_device_id',

    generateUUID() {
        if (typeof window === 'undefined') {
            try { return require('crypto').randomUUID(); } catch (e) {}
        } else if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    getDeviceId() {
        if (typeof window === 'undefined') {
            // Node.js環境: ファイルに保存して永続化
            if (_cachedServerDeviceId) return _cachedServerDeviceId;
            try {
                const fs = require('fs');
                const path = require('path');
                const idFile = path.join(process.cwd(), '.device_id');
                if (fs.existsSync(idFile)) {
                    _cachedServerDeviceId = fs.readFileSync(idFile, 'utf8').trim();
                } else {
                    _cachedServerDeviceId = this.generateUUID();
                    fs.writeFileSync(idFile, _cachedServerDeviceId, 'utf8');
                }
            } catch (e) {
                if (!_cachedServerDeviceId) _cachedServerDeviceId = this.generateUUID();
            }
            return _cachedServerDeviceId;
        }

        let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = this.generateUUID();
            localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    },

    async fetchCsrfToken() {
        try {
            if (typeof window === 'undefined') return 'server-side'; // サーバーサイド実行時はフェッチしない
            const response = await fetch('/auth/csrf-token');
            if (!response.ok) throw new Error(`CSRF token fetch failed (Status: ${response.status})`);
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('CSRFトークンの取得先からJSON以外のレスポンスが返されました');
            }
            const data = await response.json();
            return data.csrfToken;
        } catch (error) {
            console.error('CSRFトークンの取得に失敗しました:', error);
            return 'dummy-token';
        }
    },

    async login(identifier, password) {
        const csrfToken = await this.fetchCsrfToken();
        const isNode = typeof window === 'undefined';

        // サーバーからは Karotter API へ直接、ブラウザからは自作サーバーの /login へ送信する
        // ※ Node.js の fetch は相対パスを扱えないため、サーバー側では絶対URLが必要
        const url = isNode ? 'https://api.karotter.com/api/auth/login' : '/login';
        const deviceId = this.getDeviceId();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                'x-client-type': 'web'
            },
            body: JSON.stringify({
                identifier,
                password,
                deviceId,
                clientType: 'web',
                deviceName: 'Karonode'
            })
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
            }
            return data;
        } else {
            const text = await response.text();
            console.error('Non-JSON response received:', text.substring(0, 200));
            throw new Error(`サーバーからJSON以外のレスポンスが返されました (Status: ${response.status})。APIのURLが正しいか確認してください。`);
        }
    }
};

// サーバーサイド (Node.js) での require に対応
if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
}