import { PlatformAdapter, PosTreeConfig, PublishResult, PostOptions } from '../types.js';

export function createDiscourseAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.discourse) return null;
  const { instanceUrl, apiKey, apiUsername } = config.discourse;

  return {
    name: 'discourse',
    isConfigured: () => true,
    async post(content: string, options?: PostOptions): Promise<PublishResult> {
      const lines = content.split('\n');
      const title = lines[0].replace(/^#\s*/, '').slice(0, 255) || 'Untitled';
      const raw = lines.slice(1).join('\n').trim() || content;

      const body: any = { title, raw };
      if (options?.category) body.category = parseInt(options.category);

      const res = await fetch(`${instanceUrl}/posts.json`, {
        method: 'POST',
        headers: { 'Api-Key': apiKey, 'Api-Username': apiUsername, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Discourse ${res.status}: ${err}`, platform: 'discourse', file: '', publishedAt: new Date().toISOString() };
      }
      const data = await res.json() as any;
      return { success: true, url: `${instanceUrl}/t/${data.topic_slug}/${data.topic_id}`, platform: 'discourse', file: '', publishedAt: new Date().toISOString() };
    }
  };
}
