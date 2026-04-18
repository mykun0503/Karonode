const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('./js/auth');
const timeline = require('./js/timeline');
const postActions = require('./js/post_actions');
const profile = require('./js/profile');
const follow = require('./js/follow');
const notification = require('./js/notification');
const app = express();
const PORT = 3000;

const ACCOUNT_FILE = path.join(__dirname, 'account.json');

// フォームデータを解析するためのミドルウェア
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// js フォルダを静的ファイルとして公開
app.use('/js', express.static(path.join(__dirname, 'js')));

// wallpaper フォルダを静的ファイルとして公開
app.use('/wallpaper', express.static(path.join(__dirname, 'wallpaper')));

/**
 * 壁紙一覧取得API
 */
app.get('/api/wallpapers', (req, res) => {
  const wpDir = path.join(__dirname, 'wallpaper');
  fs.readdir(wpDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to list wallpapers' });
    const images = files.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
    res.json(images);
  });
});

/**
 * 壁紙アップロードAPI
 */
app.post('/api/wallpapers/upload', (req, res) => {
  const { filename, data } = req.body;
  if (!filename || !data) return res.status(400).json({ error: 'Invalid data' });

  const filePath = path.join(__dirname, 'wallpaper', filename);
  const buffer = Buffer.from(data.split(',')[1], 'base64');

  fs.writeFile(filePath, buffer, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save wallpaper' });
    res.json({ success: true, filename });
  });
});

/**
 * メインルート
 */
app.get('/', async (req, res) => {
  // account.json が存在しない場合はログイン画面へ
  if (!fs.existsSync(ACCOUNT_FILE)) {
    return res.sendFile(path.join(__dirname, 'login.html'));
  }

  try {
    const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    // 保存されている情報でログイン試行（または有効チェック）
    await auth.login(account.username, account.password);
    res.sendFile(path.join(__dirname, 'index.html'));
  } catch (error) {
    // 認証失敗時は再度ログイン画面を表示
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

/**
 * CSRFトークン取得用
 */
app.get('/auth/csrf-token', (req, res) => {
  res.json({ csrfToken: 'karonode-dummy-token' }); // 実際にはセッション等で管理
});

/**
 * ログイン中のユーザー情報を取得
 */
app.get('/api/me', async (req, res) => {
  if (!fs.existsSync(ACCOUNT_FILE)) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    const loginData = await auth.login(account.username, account.password);
    const token = loginData.accessToken;

    const data = await profile.getUserProfile(account.username, token);
    res.json(data.user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * タイムラインデータ取得用API
 */
app.get('/api/timeline', async (req, res) => {
  try {
    let token = null;
    if (fs.existsSync(ACCOUNT_FILE)) {
      const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
      const loginData = await auth.login(account.username, account.password);
      token = loginData.accessToken;
    }

    const data = await timeline.getLatestTimeline(token);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * プロフィール取得用API
 */
app.get('/api/users/:username', async (req, res) => {
  try {
    let token = null;
    if (fs.existsSync(ACCOUNT_FILE)) {
      const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
      const loginData = await auth.login(account.username, account.password);
      token = loginData.accessToken;
    }
    const data = await profile.getUserProfile(req.params.username, token);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 特定ユーザーの投稿取得用API
 */
app.get('/api/users/:userId/posts', async (req, res) => {
  try {
    let token = null;
    if (fs.existsSync(ACCOUNT_FILE)) {
      const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
      const loginData = await auth.login(account.username, account.password);
      token = loginData.accessToken;
    }
    const axios = require('axios');
    const response = await axios.get(`https://api.karotter.com/api/users/${req.params.userId}/posts?page=1&limit=20`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 通知取得用API
 */
app.get('/api/notifications', async (req, res) => {
  if (!fs.existsSync(ACCOUNT_FILE)) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    const loginData = await auth.login(account.username, account.password);
    const token = loginData.accessToken;

    const data = await notification.getNotifications(token);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * フォロー実行用API
 */
app.post('/api/follow/:userId', async (req, res) => {
  if (!fs.existsSync(ACCOUNT_FILE)) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    const loginData = await auth.login(account.username, account.password);
    const token = loginData.accessToken;

    const result = await follow.followUser(req.params.userId, token);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 特定の投稿を取得するAPI
 */
app.get('/api/posts/:id', async (req, res) => {
  try {
    let token = null;
    if (fs.existsSync(ACCOUNT_FILE)) {
      const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
      const loginData = await auth.login(account.username, account.password);
      token = loginData.accessToken;
    }
    const axios = require('axios');
    const response = await axios.get(`https://api.karotter.com/api/posts/${req.params.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 投稿の返信を取得するAPI
 */
app.get('/api/posts/:id/replies', async (req, res) => {
  try {
    let token = null;
    if (fs.existsSync(ACCOUNT_FILE)) {
      const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
      const loginData = await auth.login(account.username, account.password);
      token = loginData.accessToken;
    }
    const axios = require('axios');
    const response = await axios.get(`https://api.karotter.com/api/posts/${req.params.id}/replies`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 新規投稿・引用投稿用API
 */
app.post('/api/posts', async (req, res) => {
  if (!fs.existsSync(ACCOUNT_FILE)) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const { content, quotedPostId, parentId } = req.body;
    const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    const loginData = await auth.login(account.username, account.password);
    const token = loginData.accessToken;

    // 投稿内容の組み立て（quotedPostId が null の場合はキー自体を含めない）
    const payload = { content };
    if (quotedPostId) {
      payload.quotedPostId = quotedPostId;
    }
    if (parentId) {
      payload.parentId = parentId;
    }

    const axios = require('axios');
    const response = await axios.post('https://api.karotter.com/api/posts', 
      payload,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-client-type': 'web',
          'x-device-id': auth.getDeviceId()
        } 
      }
    );
    res.json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const errorData = error.response ? error.response.data : {};
    res.status(status).json({ error: errorData.message || errorData.error || error.message });
  }
});

/**
 * 投稿へのアクション（いいね、リカロート、ブックマーク）
 */
app.post('/api/posts/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  if (!fs.existsSync(ACCOUNT_FILE)) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    const loginData = await auth.login(account.username, account.password);
    const token = loginData.accessToken;

    let result;
    switch (action) {
      case 'rekarot': result = await postActions.rekarot(id, token); break;
      case 'like': result = await postActions.like(id, token); break;
      case 'bookmark': result = await postActions.bookmark(id, token); break;
      default: return res.status(400).json({ error: 'Invalid action' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ログイン処理
 */
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const loginData = await auth.login(username, password);
    // ログイン成功時に情報を保存
    fs.writeFileSync(ACCOUNT_FILE, JSON.stringify({ username, password }, null, 2));
    res.json(loginData); // JSONで結果を返す
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});