import { PlatformAdapter, PosTreeConfig, PublishResult, PostOptions } from '../types.js';

export function createRedditAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.reddit) return null;
  const { clientId, clientSecret, username, password } = config.reddit;
  let token: string | null = null;

  async function getToken(): Promise<string> {
    if (token) return token;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PosTree/0.1.0' },
      body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    });
    const data = await res.json() as any;
    if (!data.access_token) throw new Error('Reddit auth failed');
    token = data.access_token;
    return token!;
  }

  return {
    name: 'reddit',
    isConfigured: () => true,
    async post(content: string, options?: PostOptions): Promise<PublishResult> {
      const subreddit = options?.subreddit ?? 'test';
      const tok = await getToken();
      const lines = content.split('\n');
      const title = lines[0].replace(/^#\s*/, '').slice(0, 300);
      const text = lines.slice(1).join('\n').trim();

      const res = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PosTree/0.1.0' },
        body: `sr=${encodeURIComponent(subreddit)}&kind=self&title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&api_type=json`
      });
      const data = await res.json() as any;
      if (data.json?.errors?.length) {
        return { success: false, error: data.json.errors[0].join(': '), platform: 'reddit', file: '', publishedAt: new Date().toISOString() };
      }
      const url = data.json?.data?.url ?? '';
      return { success: true, url, platform: 'reddit', file: '', publishedAt: new Date().toISOString() };
    }
  };
}
