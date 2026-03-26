import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTwitterAdapter, buildOAuthHeaders } from './twitter.js';
import { createMastodonAdapter } from './mastodon.js';
import { createBlueskyAdapter } from './bluesky.js';
import { createLinkedinAdapter } from './linkedin.js';
import { PosTreeConfig } from '../types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(headers),
  } as unknown as Response;
}

// --- Twitter ---

const twitterConfig: PosTreeConfig = {
  twitter: { apiKey: 'ck', apiSecret: 'cs', accessToken: 'at', accessSecret: 'as' },
};

describe('Twitter adapter', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns null when config missing', () => {
    expect(createTwitterAdapter({})).toBeNull();
  });

  it('isConfigured returns true', () => {
    const adapter = createTwitterAdapter(twitterConfig)!;
    expect(adapter.isConfigured()).toBe(true);
  });

  it('post returns URL on success', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: { id: '123' } }));
    const adapter = createTwitterAdapter(twitterConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://x.com/i/status/123');
    expect(result.platform).toBe('twitter');
  });

  it('post returns error on failure', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'rate limit' }, 429));
    const adapter = createTwitterAdapter(twitterConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('429');
  });

  it('thread chains reply IDs correctly', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'tweet1' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'tweet2' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'tweet3' } }));

    const adapter = createTwitterAdapter(twitterConfig)!;
    const result = await adapter.postThread!(['a', 'b', 'c']);
    expect(result.success).toBe(true);
    expect(result.urls).toHaveLength(3);
    expect(result.url).toBe('https://x.com/i/status/tweet1');

    // First call: no reply field
    const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(firstBody.reply).toBeUndefined();

    // Second call: reply to tweet1
    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondBody.reply.in_reply_to_tweet_id).toBe('tweet1');

    // Third call: reply to tweet2
    const thirdBody = JSON.parse(mockFetch.mock.calls[2][1].body);
    expect(thirdBody.reply.in_reply_to_tweet_id).toBe('tweet2');
  });

  it('thread returns error if a tweet fails', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'tweet1' } }))
      .mockResolvedValueOnce(jsonResponse({ error: 'fail' }, 500));

    const adapter = createTwitterAdapter(twitterConfig)!;
    const result = await adapter.postThread!(['a', 'b']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('tweet 2');
  });

  it('OAuth headers contain required fields', () => {
    const headers = buildOAuthHeaders('POST', 'https://api.twitter.com/2/tweets', 'ck', 'cs', 'at', 'as');
    const auth = headers.Authorization;
    expect(auth).toMatch(/^OAuth /);
    expect(auth).toContain('oauth_consumer_key="ck"');
    expect(auth).toContain('oauth_token="at"');
    expect(auth).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(auth).toContain('oauth_signature=');
    expect(auth).toContain('oauth_nonce=');
    expect(auth).toContain('oauth_timestamp=');
    expect(auth).toContain('oauth_version="1.0"');
  });
});

// --- Mastodon ---

const mastodonConfig: PosTreeConfig = {
  mastodon: { instanceUrl: 'https://mastodon.social', accessToken: 'masto_token' },
};

describe('Mastodon adapter', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns null when config missing', () => {
    expect(createMastodonAdapter({})).toBeNull();
  });

  it('isConfigured returns true', () => {
    const adapter = createMastodonAdapter(mastodonConfig)!;
    expect(adapter.isConfigured()).toBe(true);
  });

  it('post returns URL on success', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: '456', url: 'https://mastodon.social/@user/456' }));
    const adapter = createMastodonAdapter(mastodonConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://mastodon.social/@user/456');
  });

  it('post returns error on failure', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));
    const adapter = createMastodonAdapter(mastodonConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('thread chains in_reply_to_id', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: 'p1', url: 'https://mastodon.social/@u/1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'p2', url: 'https://mastodon.social/@u/2' }));

    const adapter = createMastodonAdapter(mastodonConfig)!;
    const result = await adapter.postThread!(['a', 'b']);
    expect(result.success).toBe(true);
    expect(result.urls).toHaveLength(2);

    const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(firstBody.in_reply_to_id).toBeUndefined();

    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondBody.in_reply_to_id).toBe('p1');
  });

  it('thread returns error if a post fails', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: 'p1', url: 'https://mastodon.social/@u/1' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limit' }, 429));

    const adapter = createMastodonAdapter(mastodonConfig)!;
    const result = await adapter.postThread!(['a', 'b']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('rate limit');
  });

  it('uses correct instance URL', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: '1', url: 'https://mastodon.social/@u/1' }));
    const adapter = createMastodonAdapter(mastodonConfig)!;
    await adapter.post('test');
    expect(mockFetch.mock.calls[0][0]).toBe('https://mastodon.social/api/v1/statuses');
  });
});

// --- Bluesky ---

const blueskyConfig: PosTreeConfig = {
  bluesky: { handle: 'user.bsky.social', appPassword: 'app-pass-1234' },
};

function mockBlueskySession() {
  mockFetch.mockResolvedValueOnce(jsonResponse({ accessJwt: 'jwt123', did: 'did:plc:abc' }));
}

describe('Bluesky adapter', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns null when config missing', () => {
    expect(createBlueskyAdapter({})).toBeNull();
  });

  it('isConfigured returns true', () => {
    const adapter = createBlueskyAdapter(blueskyConfig)!;
    expect(adapter.isConfigured()).toBe(true);
  });

  it('creates session before posting', async () => {
    mockBlueskySession();
    mockFetch.mockResolvedValueOnce(jsonResponse({ uri: 'at://did:plc:abc/app.bsky.feed.post/rkey1', cid: 'cid1' }));

    const adapter = createBlueskyAdapter(blueskyConfig)!;
    await adapter.post('hello');

    // First call should be createSession
    expect(mockFetch.mock.calls[0][0]).toContain('createSession');
    // Second call should be createRecord
    expect(mockFetch.mock.calls[1][0]).toContain('createRecord');
  });

  it('post returns URL on success', async () => {
    mockBlueskySession();
    mockFetch.mockResolvedValueOnce(jsonResponse({ uri: 'at://did:plc:abc/app.bsky.feed.post/rkey1', cid: 'cid1' }));

    const adapter = createBlueskyAdapter(blueskyConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://bsky.app/profile/user.bsky.social/post/rkey1');
  });

  it('post returns error on API failure', async () => {
    mockBlueskySession();
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'bad' }, 400));

    const adapter = createBlueskyAdapter(blueskyConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(false);
  });

  it('throws on auth failure', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    const adapter = createBlueskyAdapter(blueskyConfig)!;
    await expect(adapter.post('hello')).rejects.toThrow('Bluesky auth failed');
  });

  it('reuses session across posts', async () => {
    mockBlueskySession();
    mockFetch.mockResolvedValueOnce(jsonResponse({ uri: 'at://did:plc:abc/app.bsky.feed.post/r1', cid: 'c1' }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ uri: 'at://did:plc:abc/app.bsky.feed.post/r2', cid: 'c2' }));

    const adapter = createBlueskyAdapter(blueskyConfig)!;
    await adapter.post('first');
    await adapter.post('second');

    // Only one createSession call
    const sessionCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('createSession'));
    expect(sessionCalls).toHaveLength(1);
  });

  it('thread chains reply references', async () => {
    mockBlueskySession();
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ uri: 'at://did:plc:abc/app.bsky.feed.post/r1', cid: 'c1' }))
      .mockResolvedValueOnce(jsonResponse({ uri: 'at://did:plc:abc/app.bsky.feed.post/r2', cid: 'c2' }));

    const adapter = createBlueskyAdapter(blueskyConfig)!;
    const result = await adapter.postThread!(['a', 'b']);
    expect(result.success).toBe(true);
    expect(result.urls).toHaveLength(2);
    expect(result.url).toBe('https://bsky.app/profile/user.bsky.social/post/r1');

    // Second createRecord should have reply field
    const secondRecordBody = JSON.parse(mockFetch.mock.calls[2][1].body);
    expect(secondRecordBody.record.reply).toBeDefined();
    expect(secondRecordBody.record.reply.root.uri).toBe('at://did:plc:abc/app.bsky.feed.post/r1');
    expect(secondRecordBody.record.reply.parent.uri).toBe('at://did:plc:abc/app.bsky.feed.post/r1');
  });

  it('thread returns error if a post fails', async () => {
    mockBlueskySession();
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ uri: 'at://did:plc:abc/app.bsky.feed.post/r1', cid: 'c1' }))
      .mockResolvedValueOnce(jsonResponse({}, 500));

    const adapter = createBlueskyAdapter(blueskyConfig)!;
    const result = await adapter.postThread!(['a', 'b']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('post 2');
  });
});

// --- LinkedIn ---

const linkedinConfig: PosTreeConfig = {
  linkedin: { accessToken: 'li_token' },
};

describe('LinkedIn adapter', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns null when config missing', () => {
    expect(createLinkedinAdapter({})).toBeNull();
  });

  it('isConfigured returns true', () => {
    const adapter = createLinkedinAdapter(linkedinConfig)!;
    expect(adapter.isConfigured()).toBe(true);
  });

  it('fetches user URN before posting', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ sub: 'user123' }))
      .mockResolvedValueOnce(jsonResponse({}, 201, { 'x-restli-id': 'urn:li:share:999' }));

    const adapter = createLinkedinAdapter(linkedinConfig)!;
    await adapter.post('hello');

    expect(mockFetch.mock.calls[0][0]).toContain('userinfo');
    const postBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(postBody.author).toBe('urn:li:person:user123');
  });

  it('post returns URL on 201', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ sub: 'user123' }))
      .mockResolvedValueOnce(jsonResponse({}, 201, { 'x-restli-id': 'urn:li:share:999' }));

    const adapter = createLinkedinAdapter(linkedinConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://www.linkedin.com/feed/update/urn:li:share:999');
  });

  it('returns error on auth failure', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    const adapter = createLinkedinAdapter(linkedinConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(false);
    expect(result.error).toBe('LinkedIn auth failed');
  });

  it('returns error on post failure', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ sub: 'user123' }))
      .mockResolvedValueOnce(jsonResponse({ message: 'bad request' }, 400));

    const adapter = createLinkedinAdapter(linkedinConfig)!;
    const result = await adapter.post('hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('400');
  });

  it('sends correct headers', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ sub: 'user123' }))
      .mockResolvedValueOnce(jsonResponse({}, 201, { 'x-restli-id': 'urn:li:share:999' }));

    const adapter = createLinkedinAdapter(linkedinConfig)!;
    await adapter.post('hello');

    const postHeaders = mockFetch.mock.calls[1][1].headers;
    expect(postHeaders['LinkedIn-Version']).toBe('202401');
    expect(postHeaders['X-Restli-Protocol-Version']).toBe('2.0.0');
  });
});
