import * as fs from 'node:fs';
import * as path from 'node:path';
import { Platform } from './types.js';
import { execFileSync } from 'node:child_process';

export type LLMProvider = 'claude' | 'haiku' | 'openai' | 'gemini' | 'fallback';

export interface GenerateOptions {
  source: string;           // file path OR raw text
  platforms: Platform[];
  outputDir: string;
  schedule?: string;
  spreadDays?: number;
  dryRun?: boolean;
  llm?: LLMProvider;        // which LLM to use
  model?: string;           // specific model override
  name?: string;            // base name for output files
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

/**
 * Resolve source: if it's a file path, read it. If it's raw text, use as-is.
 */
function resolveSource(source: string): string {
  // Check if it's a file path
  try {
    if (fs.existsSync(source)) {
      return fs.readFileSync(source, 'utf-8');
    }
  } catch { /* not a file path */ }

  // It's raw text
  return source;
}

/**
 * Call an LLM to generate content.
 * Supports: claude, haiku (claude with haiku model), openai, gemini
 * Falls back gracefully if the LLM isn't available.
 */
function callLLM(prompt: string, provider: LLMProvider, model?: string): string {
  switch (provider) {
    case 'claude':
    case 'haiku': {
      const args = ['-p', prompt];
      if (provider === 'haiku') args.push('--model', model ?? 'claude-haiku-4-5-20251001');
      else if (model) args.push('--model', model);
      const result = execFileSync('claude', args, {
        encoding: 'utf-8',
        timeout: 90000,
        maxBuffer: 2 * 1024 * 1024,
      });
      return result.trim();
    }

    case 'openai': {
      // Use OpenAI API via curl (requires OPENAI_API_KEY in env)
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment');
      const modelName = model ?? 'gpt-4o';
      const body = JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      });
      const result = execFileSync('curl', [
        '-s', 'https://api.openai.com/v1/chat/completions',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', body,
      ], { encoding: 'utf-8', timeout: 90000 });
      const parsed = JSON.parse(result);
      if (parsed.error) throw new Error(parsed.error.message);
      return parsed.choices[0].message.content.trim();
    }

    case 'gemini': {
      // Use gemini CLI
      const args = model ? ['-m', model, '-p', prompt] : ['-p', prompt];
      const result = execFileSync('gemini', args, {
        encoding: 'utf-8',
        timeout: 90000,
        maxBuffer: 2 * 1024 * 1024,
      });
      return result.trim();
    }

    case 'fallback':
      throw new Error('Fallback — no LLM called');

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Detect which LLM providers are available on this system.
 */
export function detectProviders(): LLMProvider[] {
  const available: LLMProvider[] = [];

  try { execFileSync('which', ['claude'], { encoding: 'utf-8', stdio: 'pipe' }); available.push('claude', 'haiku'); } catch {}
  try { execFileSync('which', ['gemini'], { encoding: 'utf-8', stdio: 'pipe' }); available.push('gemini'); } catch {}
  if (process.env.OPENAI_API_KEY) available.push('openai');

  available.push('fallback');
  return available;
}

export function generatePosts(options: GenerateOptions): string[] {
  const { source, platforms, outputDir, schedule, spreadDays, llm, model, name } = options;

  // Resolve source: file path or raw text
  const content = resolveSource(source);

  // Pick LLM provider
  const provider = llm ?? detectProviders()[0] ?? 'fallback';
  console.log(`  LLM: ${provider}${model ? ` (${model})` : ''}`);

  // Ensure output dir exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const createdFiles: string[] = [];
  const baseDate = schedule ? new Date(schedule) : new Date();
  const baseName = name ?? deriveBaseName(source);

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
      postDate.setHours(10, 0, 0, 0);
      scheduleDate = postDate.toISOString();
    }

    // Generate platform-specific content via LLM
    const prompt = buildGenerationPrompt(content, platform, constraints);
    let generatedContent: string;

    try {
      generatedContent = callLLM(prompt, provider, model);
    } catch (_err) {
      // Fallback: truncate source content for the platform
      console.log(`  [WARN] ${provider} generation failed for ${platform}, using source content`);
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
    const fileName = `${platform}-${baseName}.md`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, fileContent);
    createdFiles.push(filePath);

    console.log(`  ✓ Generated ${platform} post → ${fileName}${scheduleDate ? ` (scheduled: ${scheduleDate.split('T')[0]})` : ''}`);
  }

  return createdFiles;
}

/**
 * Derive a base name for output files from the source.
 * File path → filename without extension. Raw text → "post".
 */
function deriveBaseName(source: string): string {
  try {
    if (fs.existsSync(source)) {
      return path.basename(source, path.extname(source));
    }
  } catch {}
  return 'generated';
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
