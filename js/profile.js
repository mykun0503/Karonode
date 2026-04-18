const axios = require('axios');

/**
 * Karotter API Client for User Profiles
 */
class KarotterProfile {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.karotter.com/api/',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * ユーザープロフィールを取得する
   * @param {string} username - 取得対象のユーザー名
   * @param {string} token - 認証トークン（オプション）
   * @returns {Promise<Object>} APIレスポンス
   */
  async getUserProfile(username, token) {
    try {
      const config = {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      };
      const response = await this.client.get(`/users/${username}`, config);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  _handleError(error) {
    if (error.response) {
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.message || 'Failed to fetch profile');
    } else if (error.request) {
      console.error('Network Error: No response received');
      throw new Error('Network error, please try again later');
    } else {
      console.error('Error:', error.message);
      throw error;
    }
  }
}

module.exports = new KarotterProfile();