import * as fs from 'node:fs';
import * as path from 'node:path';

export type LLMProvider = 'claude' | 'haiku' | 'openai' | 'gemini' | 'fallback';

export interface GenerateOptions {
  source: string;
  platforms: string[];
  outputDir: string;
  schedule?: string;       // natural language: "tomorrow", "next monday 10am", ISO date
  spreadDays?: number;
  llm?: LLMProvider;
  model?: string;
  name?: string;
}

// Platform constraints
export const PLATFORM_CONSTRAINTS: Record<string, { maxLength: number; format: string; supportsThread: boolean; supportsArticle: boolean }> = {
  twitter:   { maxLength: 280,    format: 'short',        supportsThread: true,  supportsArticle: false },
  mastodon:  { maxLength: 500,    format: 'short',        supportsThread: true,  supportsArticle: false },
  bluesky:   { maxLength: 300,    format: 'short',        supportsThread: true,  supportsArticle: false },
  linkedin:  { maxLength: 3000,   format: 'professional', supportsThread: false, supportsArticle: false },
  devto:     { maxLength: 100000, format: 'article',      supportsThread: false, supportsArticle: true },
  medium:    { maxLength: 100000, format: 'article',      supportsThread: false, supportsArticle: true },
  facebook:  { maxLength: 63206,  format: 'casual',       supportsThread: false, supportsArticle: false },
  reddit:    { maxLength: 40000,  format: 'technical',    supportsThread: false, supportsArticle: false },
  discord:   { maxLength: 2000,   format: 'short',        supportsThread: false, supportsArticle: false },
  discourse: { maxLength: 32000,  format: 'technical',    supportsThread: false, supportsArticle: false },
  instagram: { maxLength: 2200,   format: 'casual',       supportsThread: false, supportsArticle: false },
  threads:   { maxLength: 500,    format: 'short',        supportsThread: true,  supportsArticle: false },
  youtube:   { maxLength: 5000,   format: 'casual',       supportsThread: false, supportsArticle: false },
  tiktok:    { maxLength: 2200,   format: 'short',        supportsThread: false, supportsArticle: false },
  telegram:  { maxLength: 4096,   format: 'casual',       supportsThread: false, supportsArticle: false },
  hashnode:  { maxLength: 100000, format: 'article',      supportsThread: false, supportsArticle: true },
  wordpress: { maxLength: 100000, format: 'article',      supportsThread: false, supportsArticle: true },
  slack:     { maxLength: 4000,   format: 'short',        supportsThread: false, supportsArticle: false },
  pinterest: { maxLength: 500,    format: 'short',        supportsThread: false, supportsArticle: false },
};

const DEFAULT_CONSTRAINT = { maxLength: 3000, format: 'casual', supportsThread: false, supportsArticle: false };

export function getConstraints(platform: string) {
  return PLATFORM_CONSTRAINTS[platform] ?? DEFAULT_CONSTRAINT;
}

// ─── LLM Providers ──────────────────────────────────────────────

async function callLLM(prompt: string, provider: LLMProvider, model?: string): Promise<string> {
  switch (provider) {
    case 'claude':
    case 'haiku':
      return callClaude(prompt, provider === 'haiku' ? (model ?? 'claude-haiku-4-5-20251001') : model);

    case 'openai':
      return callOpenAI(prompt, model);

    case 'gemini':
      return callGemini(prompt, model);

    case 'fallback':
      throw new Error('Fallback — no LLM called');

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

async function callClaude(prompt: string, model?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: model ?? 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  return block.type === 'text' ? block.text.trim() : '';
}

async function callOpenAI(prompt: string, model?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set in .env');

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: model ?? 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
  });
  return response.choices[0]?.message?.content?.trim() ?? '';
}

async function callGemini(prompt: string, model?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model: model ?? 'gemini-2.0-flash' });
  const result = await genModel.generateContent(prompt);
  return result.response.text().trim();
}

// ─── Provider Detection ─────────────────────────────────────────

export function detectProviders(): LLMProvider[] {
  const available: LLMProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) available.push('claude', 'haiku');
  if (process.env.OPENAI_API_KEY) available.push('openai');
  if (process.env.GEMINI_API_KEY) available.push('gemini');
  available.push('fallback');
  return available;
}

// ─── Generation ─────────────────────────────────────────────────

function resolveSource(source: string): string {
  try {
    if (fs.existsSync(source)) {
      const stat = fs.statSync(source);
      if (stat.isDirectory()) {
        // Read all .md files in directory
        return fs.readdirSync(source)
          .filter(f => f.endsWith('.md'))
          .map(f => fs.readFileSync(path.join(source, f), 'utf-8'))
          .join('\n\n---\n\n');
      }
      return fs.readFileSync(source, 'utf-8');
    }
  } catch { /* not a file path */ }
  return source;
}

function deriveBaseName(source: string): string {
  try {
    if (fs.existsSync(source)) {
      const stat = fs.statSync(source);
      if (stat.isDirectory()) return path.basename(source);
      return path.basename(source, path.extname(source));
    }
  } catch {}
  return 'generated';
}

export function buildGenerationPrompt(
  content: string,
  platform: string,
  constraints: { maxLength: number; format: string; supportsThread: boolean }
): string {
  const threadInstruction = constraints.supportsThread
    ? '\nIf the content is too long for a single post, split into a thread. Separate thread parts with "---" on its own line.'
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
- Format: ${formatGuide[constraints.format] ?? formatGuide.casual}
- Do NOT include frontmatter or metadata
- Do NOT use markdown formatting (no **bold**, no *italic*, no # headers) for LinkedIn, Facebook, Instagram, or any platform that renders plain text. Use emojis and line breaks instead.
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

/** Resolve a natural language date to ISO string */
function resolveScheduleDate(input: string, dayOffset: number = 0): string {
  const d = new Date();

  if (input === 'tomorrow') {
    d.setDate(d.getDate() + 1);
  } else if (input === 'today') {
    // keep as-is
  } else if (input.match(/^\d{4}-\d{2}-\d{2}/)) {
    // ISO date
    return new Date(new Date(input).getTime() + dayOffset * 86400000).toISOString();
  } else {
    // Natural language — best effort parse
    // "next monday", "in 3 days", "april 5"
    const lower = input.toLowerCase();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const nextDay = days.findIndex(day => lower.includes(day));
    if (nextDay >= 0) {
      const today = d.getDay();
      const diff = (nextDay - today + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
    } else if (lower.match(/in (\d+) days?/)) {
      d.setDate(d.getDate() + parseInt(lower.match(/in (\d+) days?/)![1]));
    } else {
      // Try Date.parse as last resort
      const parsed = new Date(input);
      if (!isNaN(parsed.getTime())) return new Date(parsed.getTime() + dayOffset * 86400000).toISOString();
      // Give up — use tomorrow
      d.setDate(d.getDate() + 1);
    }
  }

  // Extract time if specified (e.g., "tomorrow at 2pm", "next monday 10am")
  const timeMatch = input.match(/(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    if (timeMatch[2].toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (timeMatch[2].toLowerCase() === 'am' && hours === 12) hours = 0;
    d.setHours(hours, 0, 0, 0);
  } else {
    d.setHours(10, 0, 0, 0); // default 10am
  }

  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
}

export async function generatePosts(options: GenerateOptions): Promise<string[]> {
  const { source, platforms, outputDir, schedule, spreadDays, llm, model, name } = options;

  const content = resolveSource(source);
  const provider = llm ?? detectProviders()[0] ?? 'fallback';
  console.log(`  LLM: ${provider}${model ? ` (${model})` : ''}`);

  if (provider === 'fallback') {
    console.log('  No LLM API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in .env');
    console.log('  Falling back to content truncation.\n');
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const createdFiles: string[] = [];
  const baseName = name ?? deriveBaseName(source);

  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    const constraints = getConstraints(platform);

    // Schedule date with spread
    let scheduleDate: string | undefined;
    if (schedule) {
      const dayOffset = spreadDays ? Math.floor((i / platforms.length) * (spreadDays || 14)) : 0;
      scheduleDate = resolveScheduleDate(schedule, dayOffset);
    }

    // Generate via SDK
    const prompt = buildGenerationPrompt(content, platform, constraints);
    let generatedContent: string;

    try {
      generatedContent = await callLLM(prompt, provider, model);
    } catch (err: any) {
      console.log(`  [WARN] ${provider} failed for ${platform}: ${err.message}`);
      generatedContent = truncateForPlatform(content, constraints);
    }

    // Build post file
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

    const fileName = `${platform}-${baseName}.md`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, `${frontmatter}\n${generatedContent}\n`);
    createdFiles.push(filePath);

    console.log(`  + ${platform} -> ${fileName}${scheduleDate ? ` (${scheduleDate.split('T')[0]})` : ''}`);
  }

  return createdFiles;
}

export { callLLM, resolveScheduleDate };
