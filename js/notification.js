const axios = require('axios');

/**
 * Karotter API Client for Notifications
 * Base URL: https://api.karotter.com/api/
 */
class KarotterNotification {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.karotter.com/api/',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 通知一覧を取得する (Get notifications)
   * @param {string} token - 認証トークン
   * @returns {Promise<Object>} APIレスポンス
   */
  async getNotifications(token) {
    try {
      const response = await this.client.get('/notifications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
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
      throw new Error(error.response.data.message || 'Failed to fetch notifications');
    } else if (error.request) {
      console.error('Network Error: No response received');
      throw new Error('Network error, please try again later');
    } else {
      console.error('Error:', error.message);
      throw error;
    }
  }
}

module.exports = new KarotterNotification();