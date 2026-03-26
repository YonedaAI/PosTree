import { PlatformAdapter, PosTreeConfig, Platform } from '../types.js';
import { createTwitterAdapter } from './twitter.js';
import { createMastodonAdapter } from './mastodon.js';
import { createBlueskyAdapter } from './bluesky.js';
import { createLinkedinAdapter } from './linkedin.js';
import { createDevtoAdapter } from './devto.js';
import { createMediumAdapter } from './medium.js';
import { createFacebookAdapter } from './facebook.js';
import { createRedditAdapter } from './reddit.js';
import { createDiscordAdapter } from './discord.js';
import { createDiscourseAdapter } from './discourse.js';

const adapterFactories: Record<Platform, (config: PosTreeConfig) => PlatformAdapter | null> = {
  twitter: (c) => createTwitterAdapter(c),
  mastodon: (c) => createMastodonAdapter(c),
  bluesky: (c) => createBlueskyAdapter(c),
  linkedin: (c) => createLinkedinAdapter(c),
  devto: (c) => createDevtoAdapter(c),
  medium: (c) => createMediumAdapter(c),
  facebook: (c) => createFacebookAdapter(c),
  reddit: (c) => createRedditAdapter(c),
  discord: (c) => createDiscordAdapter(c),
  discourse: (c) => createDiscourseAdapter(c),
};

export function getAdapter(platform: Platform, config: PosTreeConfig): PlatformAdapter | null {
  const factory = adapterFactories[platform];
  return factory ? factory(config) : null;
}

export function registerAdapter(platform: Platform, factory: (config: PosTreeConfig) => PlatformAdapter | null): void {
  adapterFactories[platform] = factory;
}

export { adapterFactories };
