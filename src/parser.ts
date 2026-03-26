import { Post, Platform } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function parsePostFile(filePath: string): Post {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const meta = parseFrontmatter(frontmatter);

  const thread = body.includes('\n---\n')
    ? body.split('\n---\n').map(s => s.trim()).filter(Boolean)
    : undefined;

  return {
    platform: meta.platform as Platform,
    type: meta.type ?? (thread ? 'thread' : 'post'),
    schedule: meta.schedule,
    tags: meta.tags,
    status: meta.status ?? 'pending',
    published_url: meta.published_url,
    canonical_url: meta.canonical_url,
    title: meta.title,
    subreddit: meta.subreddit,
    channel: meta.channel,
    instance_url: meta.instance_url,
    category: meta.category,
    content: body,
    thread,
    file: filePath,
  };
}

export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: raw };
  return { frontmatter: match[1], body: match[2].trim() };
}

export function parseFrontmatter(fm: string): Record<string, any> {
  const result: Record<string, any> = {};
  for (const line of fm.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      if (value.startsWith('[') && value.endsWith(']')) {
        result[key] = value.slice(1, -1).split(',').map(s => s.trim());
      } else {
        result[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }
  return result;
}

export function discoverPosts(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(dir, f))
    .sort();
}
