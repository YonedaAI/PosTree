#!/usr/bin/env node
/**
 * LinkedIn OAuth 2.0 helper for PosTree
 *
 * Usage:
 *   node scripts/linkedin-auth.mjs <client_id> <client_secret>
 *
 * 1. Opens your browser to LinkedIn's auth page
 * 2. You click "Allow"
 * 3. LinkedIn redirects to localhost:3333/callback
 * 4. This script exchanges the code for an access token
 * 5. Prints the token — add it to your .env as LINKEDIN_ACCESS_TOKEN
 */

import http from 'node:http';
import { execFile } from 'node:child_process';
import { URL } from 'node:url';

const clientId = process.argv[2];
const clientSecret = process.argv[3];
const redirectUri = 'http://localhost:3333/callback';
const scopes = 'openid profile w_member_social';

if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/linkedin-auth.mjs <client_id> <client_secret>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/linkedin-auth.mjs 77du5dk0tz5d2a YOUR_CLIENT_SECRET');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3333');

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1>Error</h1><p>${error}: ${url.searchParams.get('error_description')}</p>`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>Error</h1><p>No authorization code received</p>');
    return;
  }

  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const data = await tokenRes.json();

    if (data.access_token) {
      console.log('\n========================================');
      console.log('  LinkedIn Access Token obtained!');
      console.log('========================================\n');
      console.log('Add this to your .env file:\n');
      console.log(`LINKEDIN_ACCESS_TOKEN=${data.access_token}\n`);
      console.log(`Expires in: ${Math.round(data.expires_in / 86400)} days`);
      console.log('========================================\n');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family:system-ui;background:#0a0e17;color:#e2e8f0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;">
          <div style="text-align:center;">
            <h1 style="color:#7c5cfc;">LinkedIn Connected</h1>
            <p>Access token printed to your terminal.</p>
            <p>Add it to <code>.env</code> as <code>LINKEDIN_ACCESS_TOKEN</code></p>
            <p style="color:#64748b;">You can close this tab.</p>
          </div>
        </body></html>
      `);
    } else {
      console.error('Token exchange failed:', data);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error</h1><pre>${JSON.stringify(data, null, 2)}</pre>`);
    }
  } catch (err) {
    console.error('Error:', err);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>Error</h1><p>Token exchange failed</p>');
  }

  setTimeout(() => { server.close(); process.exit(0); }, 1000);
});

server.listen(3333, () => {
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;

  console.log('Opening LinkedIn authorization page...\n');
  console.log('If browser does not open, visit:\n');
  console.log(authUrl + '\n');

  // Open in default browser (macOS)
  execFile('open', [authUrl]);
});
