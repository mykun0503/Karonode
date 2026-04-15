const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('./js/auth');
const timeline = require('./js/timeline');
const app = express();
const PORT = 3000;

const ACCOUNT_FILE = path.join(__dirname, 'account.json');

// フォームデータを解析するためのミドルウェア
app.use(express.urlencoded({ extended: true }));

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
 * ログイン処理
 */
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    await auth.login(username, password);
    // ログイン成功時に情報を保存
    fs.writeFileSync(ACCOUNT_FILE, JSON.stringify({ username, password }, null, 2));
    res.redirect('/');
  } catch (error) {
    res.status(401).send(`<h1>ログイン失敗</h1><p>${error.message}</p><a href="/">戻る</a>`);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});