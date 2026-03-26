import { PlatformAdapter, PosTreeConfig, PublishResult, PostOptions, ArticleOptions } from '../types.js';

export function createMediumAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.medium) return null;
  const { integrationToken, authorId: configAuthorId } = config.medium;

  let authorId = configAuthorId;

  return {
    name: 'medium',
    isConfigured: () => true,
    async post(content: string, options?: PostOptions): Promise<PublishResult> {
      const lines = content.split('\n');
      const title = lines[0].replace(/^#\s*/, '') || 'Untitled';
      return this.postArticle!(title, content, { tags: options?.tags, published: false });
    },
    async postArticle(title: string, content: string, options?: ArticleOptions): Promise<PublishResult> {
      if (!authorId) {
        const meRes = await fetch('https://api.medium.com/v1/me', {
          headers: { 'Authorization': `Bearer ${integrationToken}` }
        });
        if (!meRes.ok) {
          return { success: false, error: 'Medium auth failed', platform: 'medium', file: '', publishedAt: new Date().toISOString() };
        }
        const me = await meRes.json() as any;
        authorId = me.data.id;
      }

      const res = await fetch(`https://api.medium.com/v1/users/${authorId}/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${integrationToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          contentFormat: 'markdown',
          content,
          tags: options?.tags?.slice(0, 5) ?? [],
          publishStatus: options?.published ? 'public' : 'draft',
          canonicalUrl: options?.canonical_url,
        })
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Medium ${res.status}: ${err}`, platform: 'medium', file: '', publishedAt: new Date().toISOString() };
      }
      const data = await res.json() as any;
      return { success: true, url: data.data.url, platform: 'medium', file: '', publishedAt: new Date().toISOString() };
    }
  };
}
