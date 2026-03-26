import { describe, it, expect } from 'vitest';
import { splitFrontmatter, parseFrontmatter, parsePostFile, discoverPosts } from './parser.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('splitFrontmatter', () => {
  it('splits frontmatter from body', () => {
    const raw = '---\nplatform: twitter\ntype: thread\n---\nHello world';
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toBe('platform: twitter\ntype: thread');
    expect(body).toBe('Hello world');
  });

  it('handles no frontmatter', () => {
    const { frontmatter, body } = splitFrontmatter('Just content');
    expect(frontmatter).toBe('');
    expect(body).toBe('Just content');
  });

  it('handles multiline body', () => {
    const raw = '---\nplatform: bluesky\n---\nLine one\n\nLine two\n\nLine three';
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toBe('platform: bluesky');
    expect(body).toBe('Line one\n\nLine two\n\nLine three');
  });
});

describe('parseFrontmatter', () => {
  it('parses key-value pairs', () => {
    const result = parseFrontmatter('platform: twitter\ntype: thread');
    expect(result.platform).toBe('twitter');
    expect(result.type).toBe('thread');
  });

  it('parses arrays', () => {
    const result = parseFrontmatter('tags: [programming, rust, fp]');
    expect(result.tags).toEqual(['programming', 'rust', 'fp']);
  });

  it('strips quotes', () => {
    const result = parseFrontmatter('title: "My Article"');
    expect(result.title).toBe('My Article');
  });

  it('strips single quotes', () => {
    const result = parseFrontmatter("title: 'My Article'");
    expect(result.title).toBe('My Article');
  });

  it('handles empty frontmatter', () => {
    const result = parseFrontmatter('');
    expect(result).toEqual({});
  });
});

describe('parsePostFile', () => {
  it('parses a complete post file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'postree-'));
    const file = path.join(dir, 'test.md');
    fs.writeFileSync(file, `---
platform: twitter
type: thread
tags: [test, demo]
status: pending
---
First tweet

---

Second tweet

---

Third tweet`);

    const post = parsePostFile(file);
    expect(post.platform).toBe('twitter');
    expect(post.type).toBe('thread');
    expect(post.tags).toEqual(['test', 'demo']);
    expect(post.status).toBe('pending');
    expect(post.thread).toHaveLength(3);
    expect(post.thread![0]).toBe('First tweet');

    fs.rmSync(dir, { recursive: true });
  });

  it('parses a simple post without thread', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'postree-'));
    const file = path.join(dir, 'simple.md');
    fs.writeFileSync(file, `---
platform: bluesky
status: pending
---
Just a simple post here.`);

    const post = parsePostFile(file);
    expect(post.platform).toBe('bluesky');
    expect(post.type).toBe('post');
    expect(post.thread).toBeUndefined();
    expect(post.content).toBe('Just a simple post here.');

    fs.rmSync(dir, { recursive: true });
  });

  it('defaults status to pending', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'postree-'));
    const file = path.join(dir, 'nostatus.md');
    fs.writeFileSync(file, `---
platform: mastodon
---
Content here`);

    const post = parsePostFile(file);
    expect(post.status).toBe('pending');

    fs.rmSync(dir, { recursive: true });
  });
});

describe('discoverPosts', () => {
  it('finds markdown files in a directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'postree-'));
    fs.writeFileSync(path.join(dir, 'a.md'), 'content');
    fs.writeFileSync(path.join(dir, 'b.md'), 'content');
    fs.writeFileSync(path.join(dir, 'c.txt'), 'not markdown');

    const posts = discoverPosts(dir);
    expect(posts).toHaveLength(2);
    expect(posts[0]).toContain('a.md');
    expect(posts[1]).toContain('b.md');

    fs.rmSync(dir, { recursive: true });
  });

  it('returns empty array for nonexistent directory', () => {
    const posts = discoverPosts('/nonexistent/path');
    expect(posts).toEqual([]);
  });
});
