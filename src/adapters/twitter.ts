import { createHmac, randomBytes } from 'node:crypto';
import { PlatformAdapter, PosTreeConfig, PublishResult } from '../types.js';

const TWITTER_API_URL = 'https://api.twitter.com/2/tweets';

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildOAuthHeaders(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string,
): Record<string, string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  // Build signature base string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;
  const signature = createHmac('sha1', signingKey).update(signatureBase).digest('base64');

  oauthParams['oauth_signature'] = signature;

  const authHeader =
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(', ');

  return { Authorization: authHeader };
}

export { buildOAuthHeaders };

export function createTwitterAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.twitter) return null;
  const { apiKey, apiSecret, accessToken, accessSecret } = config.twitter;

  return {
    name: 'twitter',
    isConfigured: () => true,

    async post(content: string): Promise<PublishResult> {
      const body = JSON.stringify({ text: content });
      const headers = buildOAuthHeaders('POST', TWITTER_API_URL, apiKey, apiSecret, accessToken, accessSecret);

      const res = await fetch(TWITTER_API_URL, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body,
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Twitter API ${res.status}: ${err}`, platform: 'twitter', file: '', publishedAt: new Date().toISOString() };
      }

      const data = (await res.json()) as { data: { id: string } };
      return { success: true, url: `https://x.com/i/status/${data.data.id}`, platform: 'twitter', file: '', publishedAt: new Date().toISOString() };
    },

    async postThread(parts: string[]): Promise<PublishResult> {
      const urls: string[] = [];
      let replyTo: string | undefined;

      for (const part of parts) {
        const body: Record<string, unknown> = { text: part };
        if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };

        const headers = buildOAuthHeaders('POST', TWITTER_API_URL, apiKey, apiSecret, accessToken, accessSecret);

        const res = await fetch(TWITTER_API_URL, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          return { success: false, error: `Thread failed at tweet ${urls.length + 1}`, platform: 'twitter', file: '', publishedAt: new Date().toISOString() };
        }

        const data = (await res.json()) as { data: { id: string } };
        replyTo = data.data.id;
        urls.push(`https://x.com/i/status/${data.data.id}`);
      }

      return { success: true, urls, url: urls[0], platform: 'twitter', file: '', publishedAt: new Date().toISOString() };
    },
  };
}
