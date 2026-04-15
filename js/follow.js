const axios = require('axios');

/**
 * Karotter API Client for Follow Operations
 * Base URL: https://api.karotter.com/api/
 */
class KarotterFollow {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.karotter.com/api/',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * ユーザーをフォローする (Follow a user)
   * @param {string} userId - フォローする対象のユーザーID
   * @param {string} token - 認証トークン
   * @returns {Promise<Object>} APIレスポンス
   */
  async followUser(userId, token) {
    try {
      const response = await this.client.post(`/follow/${userId}`, {}, {
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
      throw new Error(error.response.data.message || 'Follow operation failed');
    } else if (error.request) {
      console.error('Network Error: No response received');
      throw new Error('Network error, please try again later');
    } else {
      console.error('Error:', error.message);
      throw error;
    }
  }
}

module.exports = new KarotterFollow();