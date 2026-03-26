import * as fs from 'node:fs';
import * as path from 'node:path';
import { Platform } from './types.js';
import { execFileSync } from 'node:child_process';

interface GenerateOptions {
  source: string;           // path to source content (markdown, URL, or text)
  platforms: Platform[];    // which platforms to generate for
  outputDir: string;        // where to write generated posts
  schedule?: string;        // optional base schedule date
  spreadDays?: number;      // spread posts over N days
  dryRun?: boolean;
}

// Platform-specific constraints
export const PLATFORM_CONSTRAINTS: Record<Platform, { maxLength: number; format: string; supportsThread: boolean; supportsArticle: boolean }> = {
  twitter: { maxLength: 280, format: 'short', supportsThread: true, supportsArticle: false },
  mastodon: { maxLength: 500, format: 'short', supportsThread: true, supportsArticle: false },
  bluesky: { maxLength: 300, format: 'short', supportsThread: true, supportsArticle: false },
  linkedin: { maxLength: 3000, format: 'professional', supportsThread: false, supportsArticle: false },
  devto: { maxLength: 100000, format: 'article', supportsThread: false, supportsArticle: true },
  medium: { maxLength: 100000, format: 'article', supportsThread: false, supportsArticle: true },
  facebook: { maxLength: 63206, format: 'casual', supportsThread: false, supportsArticle: false },
  reddit: { maxLength: 40000, format: 'technical', supportsThread: false, supportsArticle: false },
  discord: { maxLength: 2000, format: 'short', supportsThread: false, supportsArticle: false },
  discourse: { maxLength: 32000, format: 'technical', supportsThread: false, supportsArticle: false },
};

export function generatePosts(options: GenerateOptions): string[] {
  const { source, platforms, outputDir, schedule, spreadDays } = options;

  // Read source content
  const content = fs.readFileSync(source, 'utf-8');

  // Ensure output dir exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const createdFiles: string[] = [];
  const baseDate = schedule ? new Date(schedule) : new Date();

  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    const constraints = PLATFORM_CONSTRAINTS[platform];

    // Calculate schedule date (spread across days)
    let scheduleDate: string | undefined;
    if (schedule || spreadDays) {
      const postDate = new Date(baseDate);
      if (spreadDays) {
        const dayOffset = Math.floor((i / platforms.length) * (spreadDays || 14));
        postDate.setDate(postDate.getDate() + dayOffset);
      }
      postDate.setHours(10, 0, 0, 0); // Default 10am
      scheduleDate = postDate.toISOString();
    }

    // Generate platform-specific content using Claude
    const prompt = buildGenerationPrompt(content, platform, constraints);
    let generatedContent: string;

    try {
      // Use claude CLI to generate the post
      const result = execFileSync('claude', ['-p', prompt], {
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 1024 * 1024
      });
      generatedContent = result.trim();
    } catch (_err) {
      // Fallback: use the source content directly, truncated
      console.log(`  [WARN] Claude generation failed for ${platform}, using source content`);
      generatedContent = truncateForPlatform(content, constraints);
    }

    // Build the post file with frontmatter
    const type = constraints.supportsThread && generatedContent.includes('\n---\n') ? 'thread'
      : constraints.supportsArticle ? 'article' : 'post';

    const frontmatter = [
      '---',
      `platform: ${platform}`,
      `type: ${type}`,
      scheduleDate ? `schedule: ${scheduleDate}` : null,
      `status: pending`,
      '---',
    ].filter(Boolean).join('\n');

    const fileContent = `${frontmatter}\n${generatedContent}\n`;
    const fileName = `${platform}-generated.md`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, fileContent);
    createdFiles.push(filePath);

    console.log(`  \u2713 Generated ${platform} post \u2192 ${fileName}${scheduleDate ? ` (scheduled: ${scheduleDate.split('T')[0]})` : ''}`);
  }

  return createdFiles;
}

export function buildGenerationPrompt(content: string, platform: Platform, constraints: { maxLength: number; format: string; supportsThread: boolean }): string {
  const threadInstruction = constraints.supportsThread
    ? `\nIf the content is too long for a single post, split into a thread. Separate thread parts with "---" on its own line.`
    : '';

  const formatGuide: Record<string, string> = {
    short: 'Concise, punchy, hook-first. Use line breaks for readability.',
    professional: 'Professional tone, structured paragraphs, insight-driven. No emojis unless tasteful.',
    article: 'Full article format with title on first line (# Title). Well-structured with headers, code blocks if relevant.',
    casual: 'Conversational, accessible. Use line breaks for sections. Plain text only (no markdown).',
    technical: 'Technical audience. Include relevant details, code examples if applicable.',
  };

  return `You are a social media content writer. Convert the following content into a ${platform} post.

RULES:
- Maximum length: ${constraints.maxLength} characters per post
- Format: ${formatGuide[constraints.format]}
- Do NOT include frontmatter or metadata
- Do NOT use markdown formatting for Facebook (plain text only)
- Include relevant hashtags for ${platform}
- Make it engaging and shareable${threadInstruction}

CONTENT TO ADAPT:
${content.slice(0, 4000)}

OUTPUT ONLY THE POST CONTENT, nothing else.`;
}

export function truncateForPlatform(content: string, constraints: { maxLength: number }): string {
  if (content.length <= constraints.maxLength) return content;
  return content.slice(0, constraints.maxLength - 3) + '...';
}
