import { PlatformAdapter, PosTreeConfig, PublishResult } from '../types.js';

export function createFacebookAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.facebook) return null;
  const { pageId, pageAccessToken } = config.facebook;

  return {
    name: 'facebook',
    isConfigured: () => true,
    async post(content: string): Promise<PublishResult> {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, access_token: pageAccessToken })
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Facebook ${res.status}: ${err}`, platform: 'facebook', file: '', publishedAt: new Date().toISOString() };
      }
      const data = await res.json() as any;
      return { success: true, url: `https://facebook.com/${data.id}`, platform: 'facebook', file: '', publishedAt: new Date().toISOString() };
    }
  };
}
