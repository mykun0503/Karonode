const axios = require('axios');

/**
 * Karotter API Client for Post Actions (Like, Rekarot, Bookmark)
 */
class KarotterPostActions {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.karotter.com/api/',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async rekarot(postId, token) {
    try {
      const response = await this.client.post(`/posts/${postId}/rekarot`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async like(postId, token) {
    try {
      const response = await this.client.post(`/posts/${postId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async bookmark(postId, token) {
    try {
      const response = await this.client.post(`/posts/${postId}/bookmark`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  _handleError(error) {
    if (error.response) {
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.message || 'Action failed');
    } else if (error.request) {
      console.error('Network Error: No response received');
      throw new Error('Network error, please try again later');
    } else {
      console.error('Error:', error.message);
      throw error;
    }
  }
}

module.exports = new KarotterPostActions();