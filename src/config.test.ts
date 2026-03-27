import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, getConfiguredPlatforms } from './config.js';
import { PosTreeConfig } from './types.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all relevant env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('TWITTER_') || key.startsWith('MASTODON_') || key.startsWith('BLUESKY_') ||
          key.startsWith('LINKEDIN_') || key.startsWith('DEVTO_') || key.startsWith('MEDIUM_') ||
          key.startsWith('FACEBOOK_') || key.startsWith('REDDIT_') || key.startsWith('DISCORD_') ||
          key.startsWith('DISCOURSE_') || key.startsWith('POSTIZ_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('TWITTER_') || key.startsWith('MASTODON_') || key.startsWith('BLUESKY_') ||
          key.startsWith('LINKEDIN_') || key.startsWith('DEVTO_') || key.startsWith('MEDIUM_') ||
          key.startsWith('FACEBOOK_') || key.startsWith('REDDIT_') || key.startsWith('DISCORD_') ||
          key.startsWith('DISCOURSE_') || key.startsWith('POSTIZ_')) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it('returns empty config when no env vars set', () => {
    const config = loadConfig('/dev/null');
    expect(Object.keys(config)).toHaveLength(0);
  });

  it('loads twitter config from env vars', () => {
    process.env.TWITTER_API_KEY = 'key';
    process.env.TWITTER_API_SECRET = 'secret';
    process.env.TWITTER_ACCESS_TOKEN = 'token';
    process.env.TWITTER_ACCESS_SECRET = 'tokensecret';

    const config = loadConfig('/dev/null');
    expect(config.twitter).toBeDefined();
    expect(config.twitter!.apiKey).toBe('key');
    expect(config.twitter!.apiSecret).toBe('secret');
    expect(config.twitter!.accessToken).toBe('token');
    expect(config.twitter!.accessSecret).toBe('tokensecret');
  });

  it('loads bluesky config from env vars', () => {
    process.env.BLUESKY_HANDLE = 'user.bsky.social';
    process.env.BLUESKY_APP_PASSWORD = 'pass123';

    const config = loadConfig('/dev/null');
    expect(config.bluesky).toBeDefined();
    expect(config.bluesky!.handle).toBe('user.bsky.social');
    expect(config.bluesky!.appPassword).toBe('pass123');
  });

  it('loads mastodon config with default instance URL', () => {
    process.env.MASTODON_ACCESS_TOKEN = 'masto-token';

    const config = loadConfig('/dev/null');
    expect(config.mastodon).toBeDefined();
    expect(config.mastodon!.instanceUrl).toBe('https://mastodon.social');
    expect(config.mastodon!.accessToken).toBe('masto-token');
  });

  it('loads mastodon config with custom instance URL', () => {
    process.env.MASTODON_ACCESS_TOKEN = 'masto-token';
    process.env.MASTODON_INSTANCE_URL = 'https://hachyderm.io';

    const config = loadConfig('/dev/null');
    expect(config.mastodon!.instanceUrl).toBe('https://hachyderm.io');
  });

  it('loads discord config from webhook URL', () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc';

    const config = loadConfig('/dev/null');
    expect(config.discord).toBeDefined();
    expect(config.discord!.webhookUrl).toBe('https://discord.com/api/webhooks/123/abc');
  });

  it('loads multiple platforms simultaneously', () => {
    process.env.TWITTER_API_KEY = 'key';
    process.env.TWITTER_API_SECRET = 'secret';
    process.env.TWITTER_ACCESS_TOKEN = 'token';
    process.env.TWITTER_ACCESS_SECRET = 'tokensecret';
    process.env.DEVTO_API_KEY = 'devto-key';

    const config = loadConfig('/dev/null');
    expect(config.twitter).toBeDefined();
    expect(config.devto).toBeDefined();
    expect(config.devto!.apiKey).toBe('devto-key');
  });
});

describe('getConfiguredPlatforms', () => {
  it('returns empty array for empty config', () => {
    const platforms = getConfiguredPlatforms({});
    expect(platforms).toEqual([]);
  });

  it('returns list of configured platform names', () => {
    const config: PosTreeConfig = {
      twitter: { apiKey: 'k', apiSecret: 's', accessToken: 't', accessSecret: 'ts' },
      bluesky: { handle: 'h', appPassword: 'p' },
    };
    const platforms = getConfiguredPlatforms(config);
    expect(platforms).toContain('twitter');
    expect(platforms).toContain('bluesky');
    expect(platforms).toHaveLength(2);
  });
});
