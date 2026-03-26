import { PlatformAdapter, PosTreeConfig, PublishResult } from '../types.js';

export function createMastodonAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.mastodon) return null;
  const { instanceUrl, accessToken } = config.mastodon;

  return {
    name: 'mastodon',
    isConfigured: () => true,

    async post(content: string): Promise<PublishResult> {
      const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: content }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        return { success: false, error: data.error ?? `Mastodon API ${res.status}`, platform: 'mastodon', file: '', publishedAt: new Date().toISOString() };
      }
      return { success: true, url: data.url, platform: 'mastodon', file: '', publishedAt: new Date().toISOString() };
    },

    async postThread(parts: string[]): Promise<PublishResult> {
      const urls: string[] = [];
      let replyTo: string | undefined;

      for (const part of parts) {
        const body: Record<string, unknown> = { status: part };
        if (replyTo) body.in_reply_to_id = replyTo;

        const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { id?: string; url?: string; error?: string };
        if (!res.ok) {
          return { success: false, error: data.error ?? `Mastodon API ${res.status}`, platform: 'mastodon', file: '', publishedAt: new Date().toISOString() };
        }
        replyTo = data.id;
        urls.push(data.url ?? '');
      }

      return { success: true, urls, url: urls[0], platform: 'mastodon', file: '', publishedAt: new Date().toISOString() };
    },
  };
}
