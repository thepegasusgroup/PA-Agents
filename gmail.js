/**
 * Gmail API module for PA-Agents
 * Handles OAuth2 flow, token storage, and Gmail API calls.
 * Uses Node.js built-in https/http modules + electron-store.
 */

const { BrowserWindow } = require('electron');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

let Store;
try {
  Store = require('electron-store');
} catch (e) {
  // electron-store not installed yet — module will fail gracefully
  Store = null;
}

let store = null;
let credentials = null;
let mainWin = null;

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];
const REDIRECT_PORT = 8234;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth/callback`;

// ── Public API ──

function init(mainWindow) {
  mainWin = mainWindow;

  // Init store
  if (Store) {
    store = new Store({ encryptionKey: 'pa-agents-v1' });
  }

  // Load credentials
  const credPath = path.join(__dirname, 'credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      credentials = raw.installed || raw.web || raw;
    } catch (e) {
      console.error('[Gmail] Failed to parse credentials.json:', e.message);
    }
  }
}

function isAuthenticated() {
  if (!store) return false;
  const token = store.get('gmail.access_token');
  return !!token;
}

async function startOAuthFlow() {
  if (!credentials) {
    throw new Error('No credentials.json found. Please set up Google OAuth.');
  }

  const authUrl = buildAuthUrl();

  return new Promise((resolve, reject) => {
    let authWin = null;

    // Start local HTTP server to catch the redirect
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname === '/oauth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Authentication failed</h2><p>You can close this window.</p></body></html>');
          try { server.close(); } catch (e) {}
          if (authWin && !authWin.isDestroyed()) authWin.close();
          reject(new Error('OAuth denied: ' + error));
          return;
        }

        if (code) {
          try {
            await exchangeCodeForTokens(code);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h2>Authentication successful!</h2><p>You can close this window.</p></body></html>');
            try { server.close(); } catch (e) {}
            if (authWin && !authWin.isDestroyed()) authWin.close();
            resolve();
          } catch (e) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h2>Token exchange failed</h2><p>' + e.message + '</p></body></html>');
            try { server.close(); } catch (e2) {}
            if (authWin && !authWin.isDestroyed()) authWin.close();
            reject(e);
          }
        }
      }
    });

    server.listen(REDIRECT_PORT, () => {
      // Open auth window
      authWin = new BrowserWindow({
        width: 500,
        height: 700,
        parent: mainWin,
        modal: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      authWin.loadURL(authUrl);

      authWin.on('closed', () => {
        // If server still running, user closed window without completing
        try { server.close(); } catch (e) {}
      });
    });

    server.on('error', (e) => {
      reject(new Error('Failed to start OAuth server: ' + e.message));
    });
  });
}

function logout() {
  if (store) {
    store.delete('gmail.access_token');
    store.delete('gmail.refresh_token');
    store.delete('gmail.expiry');
  }
}

async function listMessages(maxResults = 20) {
  await ensureValidToken();
  const token = store.get('gmail.access_token');

  // First get message IDs
  const listData = await apiGet(`/gmail/v1/users/me/messages?maxResults=${maxResults}`, token);
  console.log('[Gmail] listMessages response:', JSON.stringify(listData).substring(0, 500));
  if (listData.error) {
    throw new Error(listData.error.message || JSON.stringify(listData.error));
  }
  if (!listData.messages || listData.messages.length === 0) return [];

  // Fetch metadata for each message
  const messages = [];
  for (const msg of listData.messages.slice(0, maxResults)) {
    const detail = await apiGet(`/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, token);
    const headers = parseHeaders(detail.payload?.headers || []);
    messages.push({
      id: detail.id,
      threadId: detail.threadId,
      snippet: detail.snippet || '',
      from: headers.from || '',
      subject: headers.subject || '(no subject)',
      date: headers.date || '',
      unread: (detail.labelIds || []).includes('UNREAD'),
    });
  }

  return messages;
}

async function getMessage(id) {
  await ensureValidToken();
  const token = store.get('gmail.access_token');

  const detail = await apiGet(`/gmail/v1/users/me/messages/${id}?format=full`, token);
  const headers = parseHeaders(detail.payload?.headers || []);
  const body = decodeBody(detail.payload);

  return {
    id: detail.id,
    from: headers.from || '',
    to: headers.to || '',
    subject: headers.subject || '(no subject)',
    date: headers.date || '',
    body: body || detail.snippet || '',
    unread: (detail.labelIds || []).includes('UNREAD'),
  };
}

async function getProfile() {
  await ensureValidToken();
  const token = store.get('gmail.access_token');
  const data = await apiGet('/gmail/v1/users/me/profile', token);
  return {
    email: data.emailAddress || '',
    messagesTotal: data.messagesTotal || 0,
    threadsTotal: data.threadsTotal || 0,
  };
}

// ── Internal helpers ──

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: credentials.client_id,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    code,
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }).toString();

  const data = await httpsPost('oauth2.googleapis.com', '/token', body);

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  store.set('gmail.access_token', data.access_token);
  if (data.refresh_token) store.set('gmail.refresh_token', data.refresh_token);
  store.set('gmail.expiry', Date.now() + (data.expires_in || 3600) * 1000);
}

async function refreshToken() {
  const refreshTok = store.get('gmail.refresh_token');
  if (!refreshTok) throw new Error('No refresh token — please re-authenticate');

  const body = new URLSearchParams({
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    refresh_token: refreshTok,
    grant_type: 'refresh_token',
  }).toString();

  const data = await httpsPost('oauth2.googleapis.com', '/token', body);

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  store.set('gmail.access_token', data.access_token);
  store.set('gmail.expiry', Date.now() + (data.expires_in || 3600) * 1000);
}

async function ensureValidToken() {
  if (!store) throw new Error('Store not initialized');
  const expiry = store.get('gmail.expiry') || 0;
  // Refresh 60s before expiry
  if (Date.now() > expiry - 60000) {
    await refreshToken();
  }
}

function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'gmail.googleapis.com',
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseHeaders(headers) {
  const result = {};
  for (const h of headers) {
    const key = h.name.toLowerCase();
    if (key === 'from') result.from = h.value;
    else if (key === 'to') result.to = h.value;
    else if (key === 'subject') result.subject = h.value;
    else if (key === 'date') result.date = h.value;
  }
  return result;
}

function decodeBody(payload) {
  if (!payload) return '';

  // Single-part message
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart — walk parts looking for text/plain or text/html
  if (payload.parts) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Fallback to text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const html = decodeBase64Url(part.body.data);
        // Strip script tags for safety
        return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      }
    }
    // Recurse into nested parts
    for (const part of payload.parts) {
      if (part.parts) {
        const result = decodeBody(part);
        if (result) return result;
      }
    }
  }
  return '';
}

function decodeBase64Url(str) {
  // Base64url → Base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad if needed
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

module.exports = { init, isAuthenticated, startOAuthFlow, logout, listMessages, getMessage, getProfile };
