/**
 * 検索関連のフロントエンドロジック
 */
const search = {
    async searchPosts(query, sort = 'latest', hasMedia = false, limit = 12, accountId = null) {
        // キャッシュ回避のためにタイムスタンプを付与
        const url = `/api/search/posts?q=${encodeURIComponent(query)}&sort=${sort}&hasMedia=${hasMedia}&limit=${limit}&t=${Date.now()}`;
        const response = await fetch(url, { accountId });
        return response;
    },

    async searchUsers(query, limit = 12, accountId = null) {
        const url = `/api/search/users?q=${encodeURIComponent(query)}&limit=${limit}&t=${Date.now()}`;
        const response = await fetch(url, { accountId });
        return response;
    }
};