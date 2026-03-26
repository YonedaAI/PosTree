import { PlatformAdapter, PosTreeConfig, PublishResult } from '../types.js';

export function createDiscordAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.discord) return null;
  const { webhookUrl } = config.discord;

  return {
    name: 'discord',
    isConfigured: () => true,
    async post(content: string): Promise<PublishResult> {
      const text = content.length > 2000 ? content.slice(0, 1997) + '...' : content;
      const res = await fetch(webhookUrl + '?wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Discord ${res.status}: ${err}`, platform: 'discord', file: '', publishedAt: new Date().toISOString() };
      }
      const data = await res.json() as any;
      return { success: true, url: `https://discord.com/channels/${data.channel_id}/${data.id}`, platform: 'discord', file: '', publishedAt: new Date().toISOString() };
    }
  };
}
