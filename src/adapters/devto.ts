import { PlatformAdapter, PosTreeConfig, PublishResult, PostOptions, ArticleOptions } from '../types.js';

export function createDevtoAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.devto) return null;
  const { apiKey } = config.devto;

  return {
    name: 'devto',
    isConfigured: () => true,
    async post(content: string, options?: PostOptions): Promise<PublishResult> {
      const lines = content.split('\n');
      const title = lines[0].replace(/^#\s*/, '') || 'Untitled';
      const body = lines.slice(1).join('\n').trim();
      return this.postArticle!(title, body, { tags: options?.tags, published: true });
    },
    async postArticle(title: string, content: string, options?: ArticleOptions): Promise<PublishResult> {
      const res = await fetch('https://dev.to/api/articles', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: {
            title,
            body_markdown: content,
            tags: options?.tags?.slice(0, 4) ?? [],
            published: options?.published ?? false,
            canonical_url: options?.canonical_url,
          }
        })
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Dev.to ${res.status}: ${err}`, platform: 'devto', file: '', publishedAt: new Date().toISOString() };
      }
      const data = await res.json() as any;
      return { success: true, url: data.url, platform: 'devto', file: '', publishedAt: new Date().toISOString() };
    }
  };
}
