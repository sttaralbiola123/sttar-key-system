require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// ======================
// CONFIG
// ======================

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// ======================
// JSON DATABASE
// ======================

function loadKeys() {
  if (!fs.existsSync('keys.json')) {
    fs.writeFileSync('keys.json', '[]');
  }

  return JSON.parse(
    fs.readFileSync('keys.json', 'utf8')
  );
}

function saveKeys(keys) {
  fs.writeFileSync(
    'keys.json',
    JSON.stringify(keys, null, 2)
  );
}

// ======================
// HOME
// ======================

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

// ======================
// DISCORD LOGIN
// ======================

app.get('/auth/discord', (req, res) => {

  const authUrl =
    `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=identify`;

  res.redirect(authUrl);
});

// ======================
// CALLBACK
// ======================

app.get('/auth/callback', async (req, res) => {

  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {

    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken =
      tokenRes.data.access_token;

    const userRes = await axios.get(
      'https://discord.com/api/users/@me',
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    );

    const user = userRes.data;

    // Generate Key

    const newKey =
      'Sttar-' +
      Math.random()
        .toString(36)
        .substring(2, 12)
        .toUpperCase();

    const keys = loadKeys();

    keys.push({
      key: newKey,
      discordId: user.id,
      discordUsername: user.username,
      used: false,
      createdAt: new Date().toISOString()
    });

    saveKeys(keys);

    res.redirect(
      `/success?key=${encodeURIComponent(newKey)}&username=${encodeURIComponent(user.username)}`
    );

  } catch (err) {

    console.error(
      'Discord Auth Error:',
      err.response?.data || err.message
    );

    res.status(500).send(
      'Authentication Failed'
    );
  }
});

// ======================
// VALIDATE KEY
// ======================

app.post('/validate-key', (req, res) => {

  const { key } = req.body;

  if (!key) {
    return res.json({
      valid: false,
      msg: 'No key provided'
    });
  }

  const keys = loadKeys();

  const keyDoc = keys.find(
    k => k.key === key
  );

  if (!keyDoc) {
    return res.json({
      valid: false,
      msg: 'Invalid Key'
    });
  }

  if (keyDoc.used) {
    return res.json({
      valid: false,
      msg: 'Key already used'
    });
  }

  keyDoc.used = true;

  saveKeys(keys);

  res.json({
    valid: true,
    msg: 'Key Accepted!'
  });
});

// ======================
// SUCCESS PAGE
// ======================

app.get('/success', (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      'public',
      'success.html'
    )
  );
});

// ======================
// START SERVER
// ======================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT}`
  );
});
