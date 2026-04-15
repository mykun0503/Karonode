const axios = require('axios');

/**
 * Karotter API Client for Timeline/Discovery
 * Base URL: https://api.karotter.com/api/
 */
class KarotterTimeline {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.karotter.com/api/',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 最新のタイムライン（Discover）を取得する
   * @param {string} token - 認証トークン（オプション）
   * @returns {Promise<Object>} APIレスポンス
   */
  async getLatestTimeline(token) {
    try {
      const config = {
        params: { limit: 12 },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      };

      const response = await this.client.get('/search/discover/latest', config);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * エラーハンドリングの共通処理
   */
  _handleError(error) {
    if (error.response) {
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.message || 'Failed to fetch timeline');
    } else if (error.request) {
      console.error('Network Error: No response received');
      throw new Error('Network error, please try again later');
    } else {
      console.error('Error:', error.message);
      throw error;
    }
  }
}

module.exports = new KarotterTimeline();