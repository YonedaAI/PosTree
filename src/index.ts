#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { parsePostFile, discoverPosts } from './parser.js';
import { Post } from './types.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const VERSION = '0.3.4';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':      return cmdInit();
    case 'generate':  return cmdGenerate(args.slice(1));
    case 'publish':   return cmdPublish(args.slice(1));
    case 'schedule':  return cmdSchedule(args.slice(1));
    case 'list':      return cmdPostiz('posts:list', args.slice(1));
    case 'delete':    return cmdPostiz('posts:delete', args.slice(1));
    case 'upload':    return cmdPostiz('upload', args.slice(1));
    case 'analytics': return cmdPostiz('analytics:post', args.slice(1));
    case 'channels':  return cmdPostiz('integrations:list', args.slice(1));
    case 'version':   return console.log(`postree v${VERSION}`);
    case 'help':      return printHelp();
    default:
      if (!command) return printHelp();
      console.error(`Unknown command: ${command}\nRun 'postree help' for usage.`);
      process.exit(1);
  }
}

// ─── Config ─────────────────────────────────────────────────────

function requirePostiz(): { apiKey: string; apiUrl: string } {
  const apiKey = process.env.POSTIZ_API_KEY;
  const apiUrl = process.env.POSTIZ_API_URL;
  if (!apiKey || !apiUrl) {
    console.error('Missing POSTIZ_API_KEY or POSTIZ_API_URL in .env');
    console.error('Run `postree init` to set up this repo.');
    process.exit(1);
  }
  return { apiKey, apiUrl };
}

function postizEnv(): Record<string, string> {
  const { apiKey, apiUrl } = requirePostiz();
  return { ...process.env as Record<string, string>, POSTIZ_API_KEY: apiKey, POSTIZ_API_URL: apiUrl };
}

function findPostizBin(): string {
  // Look in node_modules relative to this script, then up the tree
  const candidates = [
    path.resolve(__dirname, '..', 'node_modules', '.bin', 'postiz'),
    path.resolve(__dirname, '..', 'node_modules', 'postiz', 'dist', 'index.js'),
    path.resolve(process.cwd(), 'node_modules', '.bin', 'postiz'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Last resort: global PATH
  return 'postiz';
}

function postizExec(args: string[]): string {
  const bin = findPostizBin();
  const cmd = bin.endsWith('.js') ? process.execPath : bin;
  const fullArgs = bin.endsWith('.js') ? [bin, ...args] : args;
  return execFileSync(cmd, fullArgs, {
    encoding: 'utf-8',
    timeout: 30000,
    env: postizEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Get integration IDs for a platform from .env
 * Supports: POSTIZ_LINKEDIN=id1,id2 (both accounts)
 *           POSTIZ_LINKEDIN_PAGE=id1 (specific)
 * Frontmatter platform value maps to env key: linkedin -> POSTIZ_LINKEDIN
 *                                             linkedin_page -> POSTIZ_LINKEDIN_PAGE
 * Falls back to runtime query if not in .env.
 */
function getChannelIds(platform: string): string[] {
  const ids: string[] = [];
  const key = platform.toUpperCase().replace(/-/g, '_');

  // Collect all matching env vars: POSTIZ_LINKEDIN, POSTIZ_LINKEDIN_PAGE, etc.
  for (const [envKey, envVal] of Object.entries(process.env)) {
    if (!envVal || !envKey.startsWith('POSTIZ_') || envKey.startsWith('POSTIZ_API_')) continue;
    const envPlatform = envKey.replace('POSTIZ_', '');
    // Match exact (LINKEDIN -> linkedin) or prefix (LINKEDIN_PAGE -> linkedin)
    if (envPlatform === key || envPlatform.startsWith(key + '_') || key.startsWith(envPlatform + '_')) {
      ids.push(...envVal.split(',').map(s => s.trim()).filter(Boolean));
    }
  }
  if (ids.length > 0) return [...new Set(ids)];

  // Fallback: query integrations at runtime
  try {
    const raw = postizExec(['integrations:list']);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const integrations = JSON.parse(jsonMatch[0]);
    const aliases: Record<string, string[]> = {
      twitter: ['twitter', 'x'],
      linkedin: ['linkedin', 'linkedin-page'],
      facebook: ['facebook', 'facebook-page'],
      instagram: ['instagram', 'instagram-standalone'],
    };
    const identifiers = aliases[platform] ?? [platform];
    return integrations
      .filter((i: any) => identifiers.some((id: string) => i.identifier.startsWith(id)))
      .map((i: any) => i.id);
  } catch { return []; }
}

// ─── Postiz Passthrough ─────────────────────────────────────────

function cmdPostiz(postizCmd: string, args: string[]) {
  requirePostiz();
  try {
    const result = postizExec([postizCmd, ...args]);
    if (result) console.log(result);
  } catch (err: any) {
    if (err.stderr?.trim()) console.error(err.stderr.trim());
    else if (err.stdout?.trim()) console.log(err.stdout.trim());
    else console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

// ─── Init ───────────────────────────────────────────────────────

async function cmdInit() {
  if (!fs.existsSync('posts')) fs.mkdirSync('posts');

  const hasEnv = fs.existsSync('.env');
  const hasPostizKey = process.env.POSTIZ_API_KEY && process.env.POSTIZ_API_URL;

  // If .env exists and has Postiz credentials, query integrations and update channel IDs
  if (hasEnv && hasPostizKey) {
    console.log('Querying Postiz for connected channels...\n');
    try {
      const raw = postizExec(['integrations:list']);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const integrations = JSON.parse(jsonMatch[0]) as Array<{ id: string; name: string; identifier: string; profile: string; disabled: boolean }>;
        const active = integrations.filter(i => !i.disabled);

        if (active.length === 0) {
          console.log('No channels connected in Postiz. Add them in your Postiz dashboard.\n');
          return;
        }

        // Group by base platform
        const grouped: Record<string, Array<{ id: string; name: string; identifier: string; profile: string }>> = {};
        for (const i of active) {
          const key = i.identifier.replace(/-/g, '_').toUpperCase();
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(i);
        }

        // Build channel lines
        const channelLines: string[] = [];
        for (const [key, channels] of Object.entries(grouped)) {
          const ids = channels.map(c => c.id).join(',');
          const names = channels.map(c => `${c.name} (@${c.profile})`).join(', ');
          channelLines.push(`POSTIZ_${key}=${ids}  # ${names}`);
        }

        // Update .env — replace or append channel section
        let envContent = fs.readFileSync('.env', 'utf-8');
        // Remove old channel lines
        envContent = envContent.replace(/^POSTIZ_(?!API_)[A-Z_]+=.*\n?/gm, '');
        // Remove old channel comment block
        envContent = envContent.replace(/^# Channel IDs.*\n(#.*\n)*/gm, '');
        // Clean up extra blank lines
        envContent = envContent.replace(/\n{3,}/g, '\n\n').trimEnd();

        envContent += '\n\n# Channel IDs (auto-populated by postree init)\n';
        envContent += channelLines.join('\n') + '\n';

        fs.writeFileSync('.env', envContent);

        console.log(`Found ${active.length} channel(s):\n`);
        for (const i of active) {
          console.log(`  + ${i.identifier} — ${i.name} (@${i.profile})`);
        }
        console.log(`\nChannel IDs written to .env`);
      }
    } catch (err: any) {
      console.error(`Could not query Postiz: ${err.message}`);
      console.log('Add channel IDs manually: run `postiz integrations:list`');
    }

    console.log('\nReady. Run `postree generate --from <file> --platforms <list>`');
    return;
  }

  // Fresh init — create .env template
  if (!hasEnv) {
    fs.writeFileSync('.env', `# PosTree Configuration

# Postiz (publishing gateway)
# Deploy: https://railway.com/new/template/postiz-with-temporal
POSTIZ_API_URL=
POSTIZ_API_KEY=

# LLM for content generation (at least one)
ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
# GEMINI_API_KEY=
`);
  }

  console.log(`
PosTree initialized.

You need a Postiz instance to publish. Two options:

  Railway (one click):
    https://railway.com/new/template/postiz-with-temporal?projectId=8d6901cd-9865-4e39-8aea-446d1460fbbc

  Local Docker:
    git clone https://github.com/gitroomhq/postiz-app && cd postiz-app
    docker-compose -f docker/docker-compose.yml up -d

Then:
  1. Open Postiz dashboard -> connect your social accounts
  2. Settings -> API Keys -> generate a key
  3. Edit .env with your POSTIZ_API_URL and POSTIZ_API_KEY
  4. Run \`postree init\` again to auto-populate channel IDs
`);
}

// ─── Generate ───────────────────────────────────────────────────

async function cmdGenerate(args: string[]) {
  const flags = parseFlags(args);
  const source = flags['from'] ?? flags['text'] ?? args.find(a => !a.startsWith('--'));

  if (!source) {
    console.error('Usage: postree generate --from <file> [--platforms list] [--llm provider]');
    process.exit(1);
  }

  const platforms = (flags['platforms'] ?? 'twitter,linkedin,mastodon,bluesky').split(',').map(s => s.trim());
  const outputDir = flags['dir'] ?? 'posts';

  console.log(`Generating for: ${platforms.join(', ')}\n`);

  const { generatePosts } = await import('./generate.js');
  const files = await generatePosts({
    source, platforms, outputDir,
    schedule: flags['schedule'],
    spreadDays: flags['spread'] ? parseInt(flags['spread']) : 14,
    llm: flags['llm'] as any,
    model: flags['model'],
    name: flags['name'],
  });

  console.log(`\nGenerated ${files.length} posts in ${outputDir}/`);
  console.log('Review, then run `postree publish` to publish via Postiz.');
}

// ─── Publish ────────────────────────────────────────────────────

async function cmdPublish(args: string[]) {
  requirePostiz();

  const flags = parseFlags(args);
  const postsDir = flags['dir'] ?? 'posts';
  const fileArg = flags['file'];
  const platformFilter = flags['platform'];
  const pending = args.includes('--pending');

  // Check Postiz CLI
  try { execFileSync('which', ['postiz'], { encoding: 'utf-8', stdio: 'pipe' }); } catch {
    console.error('Postiz CLI not found. It should be bundled — try: npm install');
    process.exit(1);
  }

  let posts: Post[] = [];
  if (fileArg) {
    posts = [parsePostFile(fileArg)];
  } else {
    posts = discoverPosts(postsDir).map(parsePostFile);
  }

  if (platformFilter) posts = posts.filter(p => p.platform === platformFilter);

  // Filter to pending posts
  const now = new Date().toISOString();
  posts = posts.filter(p => {
    if (p.status !== 'pending') return false;
    if (pending && p.schedule && p.schedule > now) return false;
    return true;
  });

  if (posts.length === 0) { console.log('No pending posts to publish.'); return; }

  console.log(`Publishing ${posts.length} post(s) via Postiz...\n`);

  let published = 0;

  for (const post of posts) {
    const ids = getChannelIds(post.platform);
    if (ids.length === 0) {
      console.log(`  [SKIP] ${post.platform} — no channel ID. Set POSTIZ_${post.platform.toUpperCase()}=<id> in .env`);
      console.log(`         Run: postiz integrations:list`);
      continue;
    }

    console.log(`  [POST] ${post.platform} <- ${path.basename(post.file)} (${ids.length} channel(s))`);

    // Use post's schedule date, or 5s from now if none (Temporal requires schedule type)
    const schedDate = post.schedule ?? new Date(Date.now() + 5000).toISOString();

    try {
      const result = postizExec([
        'posts:create',
        '-c', post.content,
        '-s', schedDate,
        '-t', 'schedule',
        '-i', ids.join(','),
      ]);

      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const created = JSON.parse(jsonMatch[0]);
        for (const p of created) {
          console.log(`    -> ${p.postId}`);
        }
      } else {
        console.log(`    -> Scheduled`);
      }

      // Mark as published in frontmatter
      const raw = fs.readFileSync(post.file, 'utf-8');
      fs.writeFileSync(post.file, raw.replace(/status:\s*pending/, 'status: published'));
      published++;
    } catch (err: any) {
      const msg = err.stderr?.trim() || err.stdout?.trim() || err.message;
      console.log(`    x  Failed: ${msg}`);
    }
  }

  console.log(`\nDone. Published: ${published}/${posts.length}`);
}

// ─── Schedule ───────────────────────────────────────────────────

async function cmdSchedule(args: string[]) {
  const subcommand = args[0];

  if (subcommand === 'assign') {
    const { assignSchedules } = await import('./scheduler.js');
    const flags = parseFlags(args.slice(1));
    assignSchedules({
      postsDir: flags['dir'] ?? 'posts',
      startDate: flags['start'] ?? 'tomorrow',
      spreadDays: parseInt(flags['spread'] ?? '14'),
      timeOfDay: flags['time'] ?? '10:00',
      overwrite: args.includes('--overwrite'),
    });
    return;
  }

  if (subcommand === 'list') {
    const postsDir = 'posts';
    if (!fs.existsSync(postsDir)) { console.log('No posts/ directory.'); return; }
    const posts = discoverPosts(postsDir).map(parsePostFile).filter(p => p.schedule);
    posts.sort((a, b) => (a.schedule ?? '').localeCompare(b.schedule ?? ''));
    console.log('Scheduled Posts:\n');
    for (const p of posts) {
      const icon = p.status === 'published' ? '+' : 'o';
      console.log(`  ${icon} ${p.schedule} [${p.platform}] ${path.basename(p.file)}`);
    }
    if (posts.length === 0) console.log('  No scheduled posts.');
    return;
  }

  console.log(`
postree schedule assign [--start tomorrow] [--spread 14] [--time 10:00] [--overwrite]
postree schedule list
`);
}

// ─── Helpers ────────────────────────────────────────────────────

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function printHelp() {
  console.log(`
postree v${VERSION} -- Generate and publish social media content

Setup:
  postree init                Set up repo (.env, channels, posts/)

Content:
  postree generate --from <file> [--platforms list] [--llm provider]
  postree generate --text "content" --platforms twitter,linkedin
  postree publish [--pending] [--file X] [--dir X] [--platform X]

Schedule:
  postree schedule assign [--start date] [--spread days] [--time HH:MM]
  postree schedule list

Manage:
  postree list [--startDate X --endDate Y]   List published posts
  postree delete <post-id>                   Delete from platform
  postree upload <file>                      Upload media
  postree analytics <post-id>                Post engagement
  postree channels                           Connected platforms
`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
