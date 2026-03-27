import * as dotenv from 'dotenv';
import { PosTreeConfig } from './types.js';

export function loadConfig(envPath?: string): PosTreeConfig {
  dotenv.config({ path: envPath ?? '.env' });

  const config: PosTreeConfig = {};

  if (process.env.POSTIZ_API_KEY) {
    config.postiz = {
      baseUrl: process.env.POSTIZ_URL ?? 'http://localhost:3000',
      apiKey: process.env.POSTIZ_API_KEY,
    };
  }

  if (process.env.TWITTER_API_KEY) {
    config.twitter = {
      apiKey: process.env.TWITTER_API_KEY!,
      apiSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    };
  }

  if (process.env.MASTODON_ACCESS_TOKEN) {
    config.mastodon = {
      instanceUrl: process.env.MASTODON_INSTANCE_URL ?? 'https://mastodon.social',
      accessToken: process.env.MASTODON_ACCESS_TOKEN!,
    };
  }

  if (process.env.BLUESKY_HANDLE) {
    config.bluesky = {
      handle: process.env.BLUESKY_HANDLE!,
      appPassword: process.env.BLUESKY_APP_PASSWORD!,
    };
  }

  if (process.env.LINKEDIN_ACCESS_TOKEN) {
    config.linkedin = { accessToken: process.env.LINKEDIN_ACCESS_TOKEN! };
  }

  if (process.env.DEVTO_API_KEY) {
    config.devto = { apiKey: process.env.DEVTO_API_KEY! };
  }

  if (process.env.MEDIUM_INTEGRATION_TOKEN) {
    config.medium = {
      integrationToken: process.env.MEDIUM_INTEGRATION_TOKEN!,
      authorId: process.env.MEDIUM_AUTHOR_ID ?? '',
    };
  }

  if (process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
    config.facebook = {
      pageId: process.env.FACEBOOK_PAGE_ID!,
      pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN!,
    };
  }

  if (process.env.REDDIT_CLIENT_ID) {
    config.reddit = {
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      username: process.env.REDDIT_USERNAME!,
      password: process.env.REDDIT_PASSWORD!,
    };
  }

  if (process.env.DISCORD_WEBHOOK_URL) {
    config.discord = { webhookUrl: process.env.DISCORD_WEBHOOK_URL! };
  }

  if (process.env.DISCOURSE_API_KEY) {
    config.discourse = {
      instanceUrl: process.env.DISCOURSE_INSTANCE_URL!,
      apiKey: process.env.DISCOURSE_API_KEY!,
      apiUsername: process.env.DISCOURSE_API_USERNAME!,
    };
  }

  return config;
}

export function getConfiguredPlatforms(config: PosTreeConfig): string[] {
  return Object.keys(config).filter(k => config[k as keyof PosTreeConfig] !== undefined);
}
