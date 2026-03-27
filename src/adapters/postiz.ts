import { PlatformAdapter, PublishResult, PostOptions, ArticleOptions, Platform } from '../types.js';

export interface PostizConfig {
  baseUrl: string;      // e.g., http://localhost:3000
  apiKey: string;        // Postiz API key from dashboard
}

// Map PosTree platform names to Postiz provider names
const PLATFORM_MAP: Record<Platform, string> = {
  twitter: 'twitter',
  mastodon: 'mastodon',
  bluesky: 'bluesky',
  linkedin: 'linkedin',
  devto: 'devto',
  medium: 'medium',
  facebook: 'facebook',
  reddit: 'reddit',
  discord: 'discord',
  discourse: 'discourse',
};

export function createPostizAdapter(config: PostizConfig, platform: Platform): PlatformAdapter {
  const { baseUrl, apiKey } = config;

  async function postizFetch(endpoint: string, body: unknown): Promise<any> {
    const res = await fetch(`${baseUrl}/api/v1${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Postiz ${res.status}: ${err}`);
    }
    return res.json();
  }

  return {
    name: platform,
    isConfigured: () => true,

    async post(content: string, options?: PostOptions): Promise<PublishResult> {
      try {
        const data = await postizFetch('/posts', {
          content,
          platforms: [PLATFORM_MAP[platform]],
          tags: options?.tags,
        });
        return {
          success: true,
          url: data.url ?? data.posts?.[0]?.url ?? '',
          platform,
          file: '',
          publishedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
          platform,
          file: '',
          publishedAt: new Date().toISOString(),
        };
      }
    },

    async postThread(parts: string[]): Promise<PublishResult> {
      try {
        const data = await postizFetch('/posts', {
          content: parts[0],
          thread: parts.slice(1),
          platforms: [PLATFORM_MAP[platform]],
          type: 'thread',
        });
        const urls = data.posts?.map((p: any) => p.url) ?? [];
        return {
          success: true,
          url: urls[0] ?? '',
          urls,
          platform,
          file: '',
          publishedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
          platform,
          file: '',
          publishedAt: new Date().toISOString(),
        };
      }
    },

    async postArticle(title: string, content: string, options?: ArticleOptions): Promise<PublishResult> {
      try {
        const data = await postizFetch('/posts', {
          content: `# ${title}\n\n${content}`,
          platforms: [PLATFORM_MAP[platform]],
          tags: options?.tags,
          type: 'article',
        });
        return {
          success: true,
          url: data.url ?? data.posts?.[0]?.url ?? '',
          platform,
          file: '',
          publishedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
          platform,
          file: '',
          publishedAt: new Date().toISOString(),
        };
      }
    },
  };
}
