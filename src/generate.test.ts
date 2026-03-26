import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildGenerationPrompt, truncateForPlatform, PLATFORM_CONSTRAINTS, generatePosts } from './generate.js';
import { Platform } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as child_process from 'node:child_process';

describe('PLATFORM_CONSTRAINTS', () => {
  it('has constraints for all 10 platforms', () => {
    const platforms: Platform[] = ['twitter', 'mastodon', 'bluesky', 'linkedin', 'devto', 'medium', 'facebook', 'reddit', 'discord', 'discourse'];
    for (const p of platforms) {
      expect(PLATFORM_CONSTRAINTS[p]).toBeDefined();
      expect(PLATFORM_CONSTRAINTS[p].maxLength).toBeGreaterThan(0);
      expect(typeof PLATFORM_CONSTRAINTS[p].format).toBe('string');
      expect(typeof PLATFORM_CONSTRAINTS[p].supportsThread).toBe('boolean');
      expect(typeof PLATFORM_CONSTRAINTS[p].supportsArticle).toBe('boolean');
    }
  });

  it('twitter has 280 char limit', () => {
    expect(PLATFORM_CONSTRAINTS.twitter.maxLength).toBe(280);
  });

  it('article platforms support articles', () => {
    expect(PLATFORM_CONSTRAINTS.devto.supportsArticle).toBe(true);
    expect(PLATFORM_CONSTRAINTS.medium.supportsArticle).toBe(true);
  });

  it('short-form platforms support threads', () => {
    expect(PLATFORM_CONSTRAINTS.twitter.supportsThread).toBe(true);
    expect(PLATFORM_CONSTRAINTS.mastodon.supportsThread).toBe(true);
    expect(PLATFORM_CONSTRAINTS.bluesky.supportsThread).toBe(true);
  });
});

describe('buildGenerationPrompt', () => {
  it('includes platform name', () => {
    const prompt = buildGenerationPrompt('Test content', 'twitter', PLATFORM_CONSTRAINTS.twitter);
    expect(prompt).toContain('twitter');
  });

  it('includes max length constraint', () => {
    const prompt = buildGenerationPrompt('Test content', 'twitter', PLATFORM_CONSTRAINTS.twitter);
    expect(prompt).toContain('280');
  });

  it('includes thread instruction for thread-capable platforms', () => {
    const prompt = buildGenerationPrompt('Test content', 'twitter', PLATFORM_CONSTRAINTS.twitter);
    expect(prompt).toContain('thread');
    expect(prompt).toContain('---');
  });

  it('does not include thread instruction for non-thread platforms', () => {
    const prompt = buildGenerationPrompt('Test content', 'linkedin', PLATFORM_CONSTRAINTS.linkedin);
    expect(prompt).not.toContain('split into a thread');
  });

  it('includes content in prompt', () => {
    const prompt = buildGenerationPrompt('My amazing blog post content', 'linkedin', PLATFORM_CONSTRAINTS.linkedin);
    expect(prompt).toContain('My amazing blog post content');
  });

  it('truncates very long content to 4000 chars in the CONTENT TO ADAPT section', () => {
    const longContent = 'Q'.repeat(5000);
    const prompt = buildGenerationPrompt(longContent, 'twitter', PLATFORM_CONSTRAINTS.twitter);
    // The prompt should contain at most 4000 Q's from the content (Q doesn't appear in the template)
    const qCount = (prompt.match(/Q/g) || []).length;
    expect(qCount).toBe(4000);
  });

  it('includes format guide for each platform type', () => {
    const shortPrompt = buildGenerationPrompt('c', 'twitter', PLATFORM_CONSTRAINTS.twitter);
    expect(shortPrompt).toContain('Concise, punchy');

    const proPrompt = buildGenerationPrompt('c', 'linkedin', PLATFORM_CONSTRAINTS.linkedin);
    expect(proPrompt).toContain('Professional tone');

    const articlePrompt = buildGenerationPrompt('c', 'devto', PLATFORM_CONSTRAINTS.devto);
    expect(articlePrompt).toContain('Full article format');
  });
});

describe('truncateForPlatform', () => {
  it('returns content unchanged if within limit', () => {
    const result = truncateForPlatform('short', { maxLength: 280 });
    expect(result).toBe('short');
  });

  it('truncates and adds ellipsis for long content', () => {
    const long = 'a'.repeat(300);
    const result = truncateForPlatform(long, { maxLength: 280 });
    expect(result.length).toBe(280);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles exact length content', () => {
    const exact = 'a'.repeat(280);
    const result = truncateForPlatform(exact, { maxLength: 280 });
    expect(result).toBe(exact);
  });
});

describe('generatePosts', () => {
  let tmpDir: string;
  let sourceFile: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postree-gen-'));
    sourceFile = path.join(tmpDir, 'source.md');
    outputDir = path.join(tmpDir, 'output');
    fs.writeFileSync(sourceFile, '# My Blog Post\n\nThis is some great content about TypeScript.');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates output files for each platform', () => {
    // execFileSync will fail since claude CLI is not available in tests, triggering fallback
    const files = generatePosts({
      source: sourceFile,
      platforms: ['twitter', 'linkedin'],
      outputDir,
    });

    expect(files).toHaveLength(2);
    expect(fs.existsSync(path.join(outputDir, 'twitter-source.md'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'linkedin-source.md'))).toBe(true);
  });

  it('creates files with correct frontmatter', () => {
    const files = generatePosts({
      source: sourceFile,
      platforms: ['twitter'],
      outputDir,
    });

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('platform: twitter');
    expect(content).toContain('status: pending');
  });

  it('includes schedule date in frontmatter when provided', () => {
    const files = generatePosts({
      source: sourceFile,
      platforms: ['twitter'],
      outputDir,
      schedule: '2025-06-01',
      spreadDays: 14,
    });

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('schedule:');
  });

  it('creates output directory if it does not exist', () => {
    const nestedOut = path.join(tmpDir, 'nested', 'deep', 'output');
    generatePosts({
      source: sourceFile,
      platforms: ['discord'],
      outputDir: nestedOut,
    });

    expect(fs.existsSync(nestedOut)).toBe(true);
  });

  it('generates a valid post file regardless of claude CLI availability', () => {
    const files = generatePosts({
      source: sourceFile,
      platforms: ['discord'],
      outputDir,
    });

    const content = fs.readFileSync(files[0], 'utf-8');
    // Whether claude succeeds or falls back, we get a valid post file with frontmatter
    expect(content).toContain('platform: discord');
    expect(content).toContain('status: pending');
    // Content should be non-empty after frontmatter
    const body = content.split('---').slice(2).join('---').trim();
    expect(body.length).toBeGreaterThan(0);
  });
});
