export interface Post {
  // From frontmatter
  platform: Platform;
  type: 'post' | 'thread' | 'article';
  schedule?: string;          // ISO datetime
  tags?: string[];
  status: 'pending' | 'published' | 'failed' | 'draft';
  published_url?: string;
  canonical_url?: string;
  title?: string;             // for articles (Medium, Dev.to)
  subreddit?: string;         // for Reddit
  channel?: string;           // for Discord
  instance_url?: string;      // for Mastodon, Discourse
  category?: string;          // for Discourse

  // Parsed content
  content: string;            // full markdown body
  thread?: string[];          // split by --- for threads

  // Metadata
  file: string;               // source file path
  publishedAt?: string;       // when it was published
  error?: string;             // error message if failed
}

export type Platform =
  | 'twitter'
  | 'mastodon'
  | 'bluesky'
  | 'linkedin'
  | 'devto'
  | 'medium'
  | 'facebook'
  | 'reddit'
  | 'discord'
  | 'discourse';

export interface PublishResult {
  success: boolean;
  url?: string;
  urls?: string[];            // for threads
  error?: string;
  platform: Platform;
  file: string;
  publishedAt: string;
}

export interface PlatformAdapter {
  name: Platform;
  isConfigured(): boolean;    // checks if API keys present
  post(content: string, options?: PostOptions): Promise<PublishResult>;
  postThread?(parts: string[]): Promise<PublishResult>;
  postArticle?(title: string, content: string, options?: ArticleOptions): Promise<PublishResult>;
}

export interface PostOptions {
  tags?: string[];
  replyTo?: string;           // for thread chaining
  subreddit?: string;
  channel?: string;
  instance_url?: string;
  category?: string;
}

export interface ArticleOptions {
  tags?: string[];
  canonical_url?: string;
  published?: boolean;        // draft vs publish
}

export interface PosTreeConfig {
  twitter?: { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string };
  mastodon?: { instanceUrl: string; accessToken: string };
  bluesky?: { handle: string; appPassword: string };
  linkedin?: { accessToken: string };
  devto?: { apiKey: string };
  medium?: { integrationToken: string; authorId: string };
  facebook?: { pageId: string; pageAccessToken: string };
  reddit?: { clientId: string; clientSecret: string; username: string; password: string };
  discord?: { webhookUrl: string };
  discourse?: { instanceUrl: string; apiKey: string; apiUsername: string };
}

export interface StateEntry {
  file: string;
  platform: Platform;
  status: 'pending' | 'published' | 'failed';
  url?: string;
  urls?: string[];
  publishedAt?: string;
  error?: string;
  attempts: number;
}

export interface PosTreeState {
  entries: StateEntry[];
  lastRun?: string;
}
