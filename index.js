const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const auth = require('./js/auth');
const timeline = require('./js/timeline');
const postActions = require('./js/post_actions');
const profile = require('./js/profile');
const follow = require('./js/follow');
const notification = require('./js/notification');
const app = express();
const PORT = 3000;

const ACCOUNT_FILE = path.join(__dirname, 'account.json');

// 304 Not Modified による更新の不具合を防ぐため、ETagを無効化し常に最新データを取得させる
app.set('etag', false);

// account.json からプライマリアカウントを取得するヘルパー
function getPrimaryAccount() {
  if (!fs.existsSync(ACCOUNT_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    // 配列形式なら先頭を、古い形式ならそのまま返す
    const accounts = Array.isArray(data.accounts) ? data.accounts : [data];
    return accounts[0] || null;
  } catch (e) {
    return null;
  }
}

// トークンからアカウント情報を取得するヘルパー
function getAccountByToken(token) {
  if (!fs.existsSync(ACCOUNT_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    // トークンが無効な場合は検索しない
    if (!token || token === 'undefined' || token === 'null') return null;
    const accounts = Array.isArray(data.accounts) ? data.accounts : [data];
    // 保存されているトークンが一致するものを探す
    return accounts.find(a => a.csrfToken === token) || null;
  } catch (e) {
    return null;
  }
}

// リクエストから現在のアカウントと有効なトークンを取得するヘルパー
async function getAuthenticatedContext(req) {
  const headerToken = req.headers['x-csrf-token'];
  const account = getAccountByToken(headerToken) || getPrimaryAccount();
  if (!account) return { account: null, token: null };

  // ユーザー名とパスワードを柔軟に取得
  const userIdent = account.username || account.identifier;
  const pass = account.password;

  if (!userIdent || !pass) {
    throw new Error('保存されているパスワードが見つかりません。再度ログインしてください。');
  }

  const loginData = await auth.login(userIdent, pass);
  return { account, token: loginData.accessToken };
}

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
 * デバイスID取得API (.device_id ファイルの内容を返す)
 */
app.get('/api/device-id', async (req, res) => {
  try {
    const deviceId = await auth.getDeviceId();
    res.json({ deviceId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * アカウント一覧取得API (account.json の内容を返す)
 */
app.get('/api/accounts', (req, res) => {
  if (fs.existsSync(ACCOUNT_FILE)) {
    const data = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    // index.html が期待する構造 { accounts: [...] } に合わせる
    // 単一アカウントのみ保存されている場合は配列にラップ
    const accounts = Array.isArray(data.accounts) ? data.accounts : [data];
    res.json({ accounts });
  } else {
    res.json({ accounts: [] });
  }
});

/**
 * アカウント保存API
 */
app.post('/api/accounts', (req, res) => {
  const { accounts } = req.body;
  if (!accounts) return res.status(400).json({ error: 'Missing accounts data' });
  fs.writeFileSync(ACCOUNT_FILE, JSON.stringify({ accounts }, null, 2));
  res.json({ success: true });
});

/**
 * メインルート
 */
app.get('/', async (req, res) => {
  const account = getPrimaryAccount();
  if (!account) return res.sendFile(path.join(__dirname, 'login.html'));

  try {
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
  try {
    const { account, token } = await getAuthenticatedContext(req);
    if (!account) {
      return res.status(401).json({ error: 'Not logged in' });
    }

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
    const { token } = await getAuthenticatedContext(req);

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
    const { token } = await getAuthenticatedContext(req);
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
    const { token } = await getAuthenticatedContext(req);

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
  try {
    const { account, token } = await getAuthenticatedContext(req);
    if (!account) {
      return res.status(401).json({ error: 'Not logged in' });
    }

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
  try {
    const { account, token } = await getAuthenticatedContext(req);
    if (!account) {
      return res.status(401).json({ error: 'Not logged in' });
    }

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
    const { token } = await getAuthenticatedContext(req);

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
    const { token } = await getAuthenticatedContext(req);

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
  try {
    const { account, token } = await getAuthenticatedContext(req);
    if (!account) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const { content, quotedPostId, parentId } = req.body;

    // 投稿内容の組み立て（quotedPostId が null の場合はキー自体を含めない）
    const payload = { content };
    if (quotedPostId) {
      payload.quotedPostId = quotedPostId;
    }
    if (parentId) {
      payload.parentId = parentId;
    }

    const response = await axios.post('https://api.karotter.com/api/posts', 
      payload,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-client-type': 'web',
          'x-device-id': await auth.getDeviceId()
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
  try {
    const { account, token } = await getAuthenticatedContext(req);
    if (!account) {
      return res.status(401).json({ error: 'Not logged in' });
    }

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
  const identifier = req.body.identifier || req.body.username;
  const password = req.body.password;
  try {
    if (!identifier || !password) {
      return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });
    }

    const loginData = await auth.login(identifier, password);

    // 既存のアカウントリストを読み込む（上書き防止）
    let currentAccounts = [];
    if (fs.existsSync(ACCOUNT_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
        currentAccounts = Array.isArray(data.accounts) ? data.accounts : (data.username ? [data] : []);
      } catch (e) { currentAccounts = []; }
    }

    // 重複を削除して新しい情報を追加（常に最新のパスワードとトークンを保持）
    currentAccounts = currentAccounts.filter(acc => (acc.username || acc.identifier) !== identifier);

    const newAccount = {
      id: loginData.user?.id || 'main',
      username: identifier,
      displayName: loginData.user?.displayName || identifier,
      avatarUrl: loginData.user?.avatarUrl || '/wallpaper/default.png',
      password: password, // バックエンドでの再認証用に保持
      csrfToken: loginData.accessToken
    };

    currentAccounts.push(newAccount);
    fs.writeFileSync(ACCOUNT_FILE, JSON.stringify({ accounts: currentAccounts }, null, 2));

    res.json(loginData); // JSONで結果を返す
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});