import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPostizAdapter, PostizConfig } from './postiz.js';
import { getAdapter } from './index.js';
import { PosTreeConfig } from '../types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const postizConfig: PostizConfig = {
  baseUrl: 'http://localhost:3000',
  apiKey: 'test-postiz-key',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as unknown as Response;
}

describe('Postiz adapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('posts to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://twitter.com/post/123' }));
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    await adapter.post('Hello world');
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:3000/api/v1/posts');
  });

  it('sends correct platform name in request body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://linkedin.com/post/456' }));
    const adapter = createPostizAdapter(postizConfig, 'linkedin');
    await adapter.post('Hello LinkedIn');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.platforms).toEqual(['linkedin']);
  });

  it('sends auth header with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://example.com/post/1' }));
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    await adapter.post('test');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer test-postiz-key');
  });

  it('sends Content-Type application/json', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://example.com/post/1' }));
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    await adapter.post('test');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('returns URL from response on success', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://twitter.com/status/789' }));
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    const result = await adapter.post('Hello');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://twitter.com/status/789');
    expect(result.platform).toBe('twitter');
  });

  it('returns URL from nested posts array', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ posts: [{ url: 'https://mastodon.social/@u/1' }] }));
    const adapter = createPostizAdapter(postizConfig, 'mastodon');
    const result = await adapter.post('Hello Mastodon');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://mastodon.social/@u/1');
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse('Rate limit exceeded', 429));
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    const result = await adapter.post('Hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Postiz 429');
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    const result = await adapter.post('Hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('handles thread posts', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      posts: [
        { url: 'https://twitter.com/status/1' },
        { url: 'https://twitter.com/status/2' },
        { url: 'https://twitter.com/status/3' },
      ],
    }));
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    const result = await adapter.postThread!(['Part 1', 'Part 2', 'Part 3']);
    expect(result.success).toBe(true);
    expect(result.urls).toHaveLength(3);
    expect(result.url).toBe('https://twitter.com/status/1');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content).toBe('Part 1');
    expect(body.thread).toEqual(['Part 2', 'Part 3']);
    expect(body.type).toBe('thread');
  });

  it('handles thread API errors', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse('Server error', 500));
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    const result = await adapter.postThread!(['Part 1', 'Part 2']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Postiz 500');
  });

  it('handles article posts', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://dev.to/user/my-article' }));
    const adapter = createPostizAdapter(postizConfig, 'devto');
    const result = await adapter.postArticle!('My Article', 'Article body here', { tags: ['typescript'] });
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://dev.to/user/my-article');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content).toBe('# My Article\n\nArticle body here');
    expect(body.type).toBe('article');
    expect(body.tags).toEqual(['typescript']);
    expect(body.platforms).toEqual(['devto']);
  });

  it('handles article API errors', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse('Validation failed', 422));
    const adapter = createPostizAdapter(postizConfig, 'medium');
    const result = await adapter.postArticle!('Title', 'Body', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Postiz 422');
  });

  it('isConfigured always returns true', () => {
    const adapter = createPostizAdapter(postizConfig, 'twitter');
    expect(adapter.isConfigured()).toBe(true);
  });

  it('sends tags in post options', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://example.com/1' }));
    const adapter = createPostizAdapter(postizConfig, 'mastodon');
    await adapter.post('Hello', { tags: ['test', 'postiz'] });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tags).toEqual(['test', 'postiz']);
  });

  it('uses correct adapter name matching the platform', () => {
    const adapter = createPostizAdapter(postizConfig, 'bluesky');
    expect(adapter.name).toBe('bluesky');
  });

  it('uses custom baseUrl', async () => {
    const customConfig: PostizConfig = { baseUrl: 'https://postiz.example.com', apiKey: 'key' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://example.com/1' }));
    const adapter = createPostizAdapter(customConfig, 'twitter');
    await adapter.post('Hello');
    expect(mockFetch.mock.calls[0][0]).toBe('https://postiz.example.com/api/v1/posts');
  });
});

describe('Postiz adapter registry integration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('prefers Postiz adapter over individual adapters when configured', () => {
    const config: PosTreeConfig = {
      postiz: { baseUrl: 'http://localhost:3000', apiKey: 'pk' },
      twitter: { apiKey: 'k', apiSecret: 's', accessToken: 't', accessSecret: 'ts' },
    };
    const adapter = getAdapter('twitter', config);
    expect(adapter).not.toBeNull();
    // Postiz adapter isConfigured always returns true and doesn't need per-platform config
    expect(adapter!.isConfigured()).toBe(true);
    expect(adapter!.name).toBe('twitter');
  });

  it('falls back to individual adapters when Postiz not configured', () => {
    const config: PosTreeConfig = {
      twitter: { apiKey: 'k', apiSecret: 's', accessToken: 't', accessSecret: 'ts' },
    };
    const adapter = getAdapter('twitter', config);
    expect(adapter).not.toBeNull();
    expect(adapter!.name).toBe('twitter');
  });

  it('returns Postiz adapter for all platforms when configured', () => {
    const config: PosTreeConfig = {
      postiz: { baseUrl: 'http://localhost:3000', apiKey: 'pk' },
    };
    const platforms = ['twitter', 'mastodon', 'bluesky', 'linkedin', 'devto', 'medium', 'facebook', 'reddit', 'discord', 'discourse'] as const;
    for (const platform of platforms) {
      const adapter = getAdapter(platform, config);
      expect(adapter).not.toBeNull();
      expect(adapter!.name).toBe(platform);
      expect(adapter!.isConfigured()).toBe(true);
    }
  });

  it('returns null for unconfigured individual platforms without Postiz', () => {
    const config: PosTreeConfig = {};
    const adapter = getAdapter('twitter', config);
    expect(adapter).toBeNull();
  });
});
