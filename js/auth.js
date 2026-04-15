const axios = require('axios');

/**
 * Karotter API Client for Authentication
 * Base URL: https://api.karotter.com/api/
 */
class KarotterAuth {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.karotter.com/api/',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * ユーザー登録 (Register)
   * @param {string} username - ユーザー名
   * @param {string} password - パスワード
   * @returns {Promise<Object>} APIレスポンス
   */
  async register(username, password) {
    try {
      const response = await this.client.post('/auth/register', {
        username,
        password,
      });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * ログイン (Login)
   * @param {string} username - ユーザー名
   * @param {string} password - パスワード
   * @returns {Promise<Object>} トークンを含むレスポンス
   */
  async login(username, password) {
    try {
      const response = await this.client.post('/auth/login', {
        identifier: username,
        password,
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
      // サーバーからのエラーレスポンスがある場合
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.message || 'Authentication failed');
    } else if (error.request) {
      // リクエストは送られたがレスポンスがない場合
      console.error('Network Error: No response received');
      throw new Error('Network error, please try again later');
    } else {
      // 設定時にエラーが発生した場合
      console.error('Error:', error.message);
      throw error;
    }
  }
}

module.exports = new KarotterAuth();
