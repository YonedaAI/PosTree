import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from './state.js';
import { PublishResult } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('StateManager', () => {
  let tmpDir: string;
  let statePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postree-state-'));
    statePath = path.join(tmpDir, '.postree-state.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates empty state when no file exists', () => {
    const sm = new StateManager(statePath);
    expect(sm.getAllEntries()).toEqual([]);
  });

  it('records a successful publish result', () => {
    const sm = new StateManager(statePath);
    const result: PublishResult = {
      success: true,
      url: 'https://twitter.com/status/123',
      platform: 'twitter',
      file: 'posts/hello.md',
      publishedAt: '2024-01-01T00:00:00Z',
    };
    sm.record(result);

    const entry = sm.getEntry('posts/hello.md', 'twitter');
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('published');
    expect(entry!.url).toBe('https://twitter.com/status/123');
    expect(entry!.attempts).toBe(1);
  });

  it('records a failed publish result', () => {
    const sm = new StateManager(statePath);
    const result: PublishResult = {
      success: false,
      error: 'Rate limited',
      platform: 'twitter',
      file: 'posts/hello.md',
      publishedAt: '2024-01-01T00:00:00Z',
    };
    sm.record(result);

    const entry = sm.getEntry('posts/hello.md', 'twitter');
    expect(entry!.status).toBe('failed');
    expect(entry!.error).toBe('Rate limited');
  });

  it('increments attempts on re-record', () => {
    const sm = new StateManager(statePath);
    const result: PublishResult = {
      success: false,
      error: 'Rate limited',
      platform: 'twitter',
      file: 'posts/hello.md',
      publishedAt: '2024-01-01T00:00:00Z',
    };
    sm.record(result);
    sm.record(result);

    const entry = sm.getEntry('posts/hello.md', 'twitter');
    expect(entry!.attempts).toBe(2);
  });

  it('checks isPublished correctly', () => {
    const sm = new StateManager(statePath);
    expect(sm.isPublished('posts/hello.md', 'twitter')).toBe(false);

    sm.record({
      success: true,
      platform: 'twitter',
      file: 'posts/hello.md',
      publishedAt: '2024-01-01T00:00:00Z',
    });

    expect(sm.isPublished('posts/hello.md', 'twitter')).toBe(true);
  });

  it('saves and loads state from disk', () => {
    const sm1 = new StateManager(statePath);
    sm1.record({
      success: true,
      url: 'https://bsky.app/post/123',
      platform: 'bluesky',
      file: 'posts/test.md',
      publishedAt: '2024-01-01T00:00:00Z',
    });
    sm1.save();

    const sm2 = new StateManager(statePath);
    const entry = sm2.getEntry('posts/test.md', 'bluesky');
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('published');
    expect(entry!.url).toBe('https://bsky.app/post/123');
  });

  it('returns correct summary counts', () => {
    const sm = new StateManager(statePath);
    sm.record({ success: true, platform: 'twitter', file: 'a.md', publishedAt: '2024-01-01T00:00:00Z' });
    sm.record({ success: true, platform: 'bluesky', file: 'b.md', publishedAt: '2024-01-01T00:00:00Z' });
    sm.record({ success: false, error: 'err', platform: 'mastodon', file: 'c.md', publishedAt: '2024-01-01T00:00:00Z' });

    const summary = sm.getSummary();
    expect(summary.published).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.pending).toBe(0);
  });

  it('getFailed returns only failed entries', () => {
    const sm = new StateManager(statePath);
    sm.record({ success: true, platform: 'twitter', file: 'a.md', publishedAt: '2024-01-01T00:00:00Z' });
    sm.record({ success: false, error: 'err', platform: 'mastodon', file: 'b.md', publishedAt: '2024-01-01T00:00:00Z' });

    const failed = sm.getFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].platform).toBe('mastodon');
  });

  it('getPublished returns only published entries', () => {
    const sm = new StateManager(statePath);
    sm.record({ success: true, platform: 'twitter', file: 'a.md', publishedAt: '2024-01-01T00:00:00Z' });
    sm.record({ success: false, error: 'err', platform: 'mastodon', file: 'b.md', publishedAt: '2024-01-01T00:00:00Z' });

    const published = sm.getPublished();
    expect(published).toHaveLength(1);
    expect(published[0].platform).toBe('twitter');
  });

  it('records thread URLs', () => {
    const sm = new StateManager(statePath);
    sm.record({
      success: true,
      urls: ['https://twitter.com/1', 'https://twitter.com/2'],
      platform: 'twitter',
      file: 'thread.md',
      publishedAt: '2024-01-01T00:00:00Z',
    });

    const entry = sm.getEntry('thread.md', 'twitter');
    expect(entry!.urls).toEqual(['https://twitter.com/1', 'https://twitter.com/2']);
  });
});
