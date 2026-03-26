import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDevtoAdapter } from './devto.js';
import { createMediumAdapter } from './medium.js';
import { createFacebookAdapter } from './facebook.js';
import { createRedditAdapter } from './reddit.js';
import { createDiscordAdapter } from './discord.js';
import { createDiscourseAdapter } from './discourse.js';
import { PosTreeConfig } from '../types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── Dev.to ──────────────────────────────────────────────────────────

describe('Dev.to adapter', () => {
  const config: PosTreeConfig = { devto: { apiKey: 'test-key' } };

  it('returns null when not configured', () => {
    expect(createDevtoAdapter({})).toBeNull();
  });

  it('creates an article successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://dev.to/user/article-1' }),
    });
    const adapter = createDevtoAdapter(config)!;
    const result = await adapter.postArticle!('My Title', 'Body content', { tags: ['ts', 'node'], published: true });
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://dev.to/user/article-1');
    expect(result.platform).toBe('devto');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.article.title).toBe('My Title');
    expect(body.article.published).toBe(true);
    expect(body.article.tags).toEqual(['ts', 'node']);
  });

  it('limits tags to 4', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://dev.to/user/article-2' }),
    });
    const adapter = createDevtoAdapter(config)!;
    await adapter.postArticle!('Title', 'Body', { tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.article.tags).toHaveLength(4);
  });

  it('handles API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => 'Validation failed',
    });
    const adapter = createDevtoAdapter(config)!;
    const result = await adapter.postArticle!('Title', 'Body', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('422');
  });

  it('post() extracts title from first line', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://dev.to/user/article-3' }),
    });
    const adapter = createDevtoAdapter(config)!;
    await adapter.post('# My Post\nSome content here');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.article.title).toBe('My Post');
  });
});

// ─── Medium ──────────────────────────────────────────────────────────

describe('Medium adapter', () => {
  const config: PosTreeConfig = { medium: { integrationToken: 'tok-123', authorId: 'author-1' } };

  it('returns null when not configured', () => {
    expect(createMediumAdapter({})).toBeNull();
  });

  it('creates an article with known authorId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { url: 'https://medium.com/@user/post-1' } }),
    });
    const adapter = createMediumAdapter(config)!;
    const result = await adapter.postArticle!('Title', 'Content', { published: true });
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://medium.com/@user/post-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.publishStatus).toBe('public');
  });

  it('fetches authorId when not provided', async () => {
    const noAuthorConfig: PosTreeConfig = { medium: { integrationToken: 'tok-123', authorId: '' } };
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'fetched-author-id' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { url: 'https://medium.com/@user/post-2' } }),
      });
    const adapter = createMediumAdapter(noAuthorConfig)!;
    const result = await adapter.postArticle!('Title', 'Content', {});
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('fetched-author-id');
  });

  it('defaults to draft mode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { url: 'https://medium.com/@user/draft-1' } }),
    });
    const adapter = createMediumAdapter(config)!;
    await adapter.postArticle!('Title', 'Content', {});
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.publishStatus).toBe('draft');
  });

  it('handles auth failure', async () => {
    const noAuthorConfig: PosTreeConfig = { medium: { integrationToken: 'bad-tok', authorId: '' } };
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const adapter = createMediumAdapter(noAuthorConfig)!;
    const result = await adapter.postArticle!('Title', 'Content', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('auth failed');
  });
});

// ─── Facebook ────────────────────────────────────────────────────────

describe('Facebook adapter', () => {
  const config: PosTreeConfig = { facebook: { pageId: 'page-123', pageAccessToken: 'pat-456' } };

  it('returns null when not configured', () => {
    expect(createFacebookAdapter({})).toBeNull();
  });

  it('posts to a page successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'page-123_post-789' }),
    });
    const adapter = createFacebookAdapter(config)!;
    const result = await adapter.post('Hello Facebook!');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://facebook.com/page-123_post-789');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message).toBe('Hello Facebook!');
    expect(body.access_token).toBe('pat-456');
  });

  it('handles API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Insufficient permissions',
    });
    const adapter = createFacebookAdapter(config)!;
    const result = await adapter.post('Test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('403');
  });

  it('uses correct Graph API URL with pageId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123_456' }),
    });
    const adapter = createFacebookAdapter(config)!;
    await adapter.post('test');
    expect(mockFetch.mock.calls[0][0]).toBe('https://graph.facebook.com/v19.0/page-123/feed');
  });
});

// ─── Reddit ──────────────────────────────────────────────────────────

describe('Reddit adapter', () => {
  const config: PosTreeConfig = {
    reddit: { clientId: 'cid', clientSecret: 'csec', username: 'user', password: 'pass' }
  };

  it('returns null when not configured', () => {
    expect(createRedditAdapter({})).toBeNull();
  });

  it('authenticates and posts', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'reddit-tok-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ json: { errors: [], data: { url: 'https://reddit.com/r/test/comments/abc' } } }),
      });
    const adapter = createRedditAdapter(config)!;
    const result = await adapter.post('# My Post\nBody text', { subreddit: 'typescript' });
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://reddit.com/r/test/comments/abc');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('targets specified subreddit', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ json: { errors: [], data: { url: '' } } }),
      });
    const adapter = createRedditAdapter(config)!;
    await adapter.post('# Title\nBody', { subreddit: 'javascript' });
    const submitBody = mockFetch.mock.calls[1][1].body as string;
    expect(submitBody).toContain('sr=javascript');
  });

  it('defaults to r/test subreddit', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ json: { errors: [], data: { url: '' } } }),
      });
    const adapter = createRedditAdapter(config)!;
    await adapter.post('# Title\nBody');
    const submitBody = mockFetch.mock.calls[1][1].body as string;
    expect(submitBody).toContain('sr=test');
  });

  it('handles submission errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ json: { errors: [['SUBREDDIT_NOEXIST', 'not found', 'sr']] } }),
      });
    const adapter = createRedditAdapter(config)!;
    const result = await adapter.post('# Title\nBody');
    expect(result.success).toBe(false);
    expect(result.error).toContain('SUBREDDIT_NOEXIST');
  });
});

// ─── Discord ─────────────────────────────────────────────────────────

describe('Discord adapter', () => {
  const config: PosTreeConfig = { discord: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' } };

  it('returns null when not configured', () => {
    expect(createDiscordAdapter({})).toBeNull();
  });

  it('posts via webhook', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channel_id: '111', id: '222' }),
    });
    const adapter = createDiscordAdapter(config)!;
    const result = await adapter.post('Hello Discord!');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://discord.com/channels/111/222');
  });

  it('truncates content to 2000 chars', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channel_id: '111', id: '222' }),
    });
    const adapter = createDiscordAdapter(config)!;
    const longContent = 'x'.repeat(3000);
    await adapter.post(longContent);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content.length).toBe(2000);
    expect(body.content.endsWith('...')).toBe(true);
  });

  it('does not truncate content under 2000 chars', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channel_id: '111', id: '222' }),
    });
    const adapter = createDiscordAdapter(config)!;
    const shortContent = 'Hello';
    await adapter.post(shortContent);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content).toBe('Hello');
  });

  it('handles webhook errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Unknown Webhook',
    });
    const adapter = createDiscordAdapter(config)!;
    const result = await adapter.post('Test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('404');
  });

  it('appends ?wait=true to webhook URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channel_id: '1', id: '2' }),
    });
    const adapter = createDiscordAdapter(config)!;
    await adapter.post('test');
    expect(mockFetch.mock.calls[0][0]).toBe('https://discord.com/api/webhooks/123/abc?wait=true');
  });
});

// ─── Discourse ───────────────────────────────────────────────────────

describe('Discourse adapter', () => {
  const config: PosTreeConfig = {
    discourse: { instanceUrl: 'https://forum.example.com', apiKey: 'dk-123', apiUsername: 'system' }
  };

  it('returns null when not configured', () => {
    expect(createDiscourseAdapter({})).toBeNull();
  });

  it('creates a topic', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ topic_slug: 'my-topic', topic_id: 42 }),
    });
    const adapter = createDiscourseAdapter(config)!;
    const result = await adapter.post('# My Topic\nSome content');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://forum.example.com/t/my-topic/42');
  });

  it('includes category when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ topic_slug: 'test', topic_id: 1 }),
    });
    const adapter = createDiscourseAdapter(config)!;
    await adapter.post('# Topic\nBody', { category: '5' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.category).toBe(5);
  });

  it('sends correct auth headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ topic_slug: 'x', topic_id: 1 }),
    });
    const adapter = createDiscourseAdapter(config)!;
    await adapter.post('# T\nBody');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Api-Key']).toBe('dk-123');
    expect(headers['Api-Username']).toBe('system');
  });

  it('handles server errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    const adapter = createDiscourseAdapter(config)!;
    const result = await adapter.post('# Topic\nBody');
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });
});
