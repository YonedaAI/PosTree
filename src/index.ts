#!/usr/bin/env node
import { loadConfig, getConfiguredPlatforms } from './config.js';
import { parsePostFile, discoverPosts } from './parser.js';
import { StateManager } from './state.js';
import { getAdapter } from './adapters/index.js';
import { Post, Platform, PublishResult } from './types.js';
import * as path from 'node:path';

const VERSION = '0.1.0';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'publish': return cmdPublish(args.slice(1));
    case 'status': return cmdStatus(args.slice(1));
    case 'dry-run': return cmdDryRun(args.slice(1));
    case 'platforms': return cmdPlatforms();
    case 'schedule': return cmdSchedule(args.slice(1));
    case 'version': return console.log(`postree v${VERSION}`);
    case 'help': return printHelp();
    default:
      if (!command) return printHelp();
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

async function cmdPublish(args: string[]) {
  const config = loadConfig();
  const state = new StateManager();
  const flags = parseFlags(args);

  const platform = flags['platform'] as Platform | undefined;
  const file = flags['file'];
  const pending = args.includes('--pending');
  const all = args.includes('--all');
  const postsDir = flags['dir'] ?? 'posts';

  let posts: Post[] = [];

  if (file) {
    posts = [parsePostFile(file)];
  } else {
    const files = discoverPosts(postsDir);
    posts = files.map(parsePostFile);
  }

  if (platform) {
    posts = posts.filter(p => p.platform === platform);
  }

  if (pending) {
    const now = new Date().toISOString();
    posts = posts.filter(p => {
      if (state.isPublished(p.file, p.platform)) return false;
      if (p.schedule && p.schedule > now) return false; // not yet scheduled
      if (p.status === 'draft') return false;
      return true;
    });
  }

  if (posts.length === 0) {
    console.log('No posts to publish.');
    return;
  }

  console.log(`Publishing ${posts.length} post(s)...\n`);

  for (const post of posts) {
    const adapter = getAdapter(post.platform, config);
    if (!adapter) {
      console.log(`  [SKIP] ${post.platform} — no adapter or not configured`);
      continue;
    }
    if (!adapter.isConfigured()) {
      console.log(`  [SKIP] ${post.platform} — missing API keys`);
      continue;
    }
    if (state.isPublished(post.file, post.platform)) {
      console.log(`  [SKIP] ${post.platform} — already published: ${post.file}`);
      continue;
    }

    console.log(`  [POST] ${post.platform} ← ${path.basename(post.file)}`);

    let result: PublishResult;
    try {
      if (post.type === 'thread' && post.thread && adapter.postThread) {
        result = await adapter.postThread(post.thread);
      } else if (post.type === 'article' && post.title && adapter.postArticle) {
        result = await adapter.postArticle(post.title, post.content, {
          tags: post.tags, canonical_url: post.canonical_url
        });
      } else {
        result = await adapter.post(post.content, {
          tags: post.tags, subreddit: post.subreddit, channel: post.channel
        });
      }
      result.file = post.file;
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        platform: post.platform,
        file: post.file,
        publishedAt: new Date().toISOString(),
      };
    }

    state.record(result);

    if (result.success) {
      console.log(`    ✓ Published: ${result.url ?? result.urls?.[0] ?? 'OK'}`);
    } else {
      console.log(`    ✗ Failed: ${result.error}`);
    }
  }

  state.save();

  const summary = state.getSummary();
  console.log(`\nDone. Published: ${summary.published}, Failed: ${summary.failed}, Pending: ${summary.pending}`);
}

async function cmdStatus(_args: string[]) {
  const state = new StateManager();
  const entries = state.getAllEntries();

  if (entries.length === 0) {
    console.log('No publishing history. Run `postree publish` first.');
    return;
  }

  console.log('Publishing Status:\n');
  for (const entry of entries) {
    const icon = entry.status === 'published' ? '✓' : entry.status === 'failed' ? '✗' : '○';
    const url = entry.url ? ` → ${entry.url}` : '';
    const err = entry.error ? ` (${entry.error})` : '';
    console.log(`  ${icon} [${entry.platform}] ${path.basename(entry.file)}${url}${err}`);
  }

  const summary = state.getSummary();
  console.log(`\nTotal: ${summary.published} published, ${summary.failed} failed, ${summary.pending} pending`);
}

async function cmdDryRun(args: string[]) {
  const config = loadConfig();
  const postsDir = args[0] ?? 'posts';
  const files = discoverPosts(postsDir);
  const configured = getConfiguredPlatforms(config);

  console.log(`Configured platforms: ${configured.join(', ') || 'none'}\n`);
  console.log(`Posts found in ${postsDir}/:\n`);

  for (const file of files) {
    const post = parsePostFile(file);
    const hasAdapter = configured.includes(post.platform);
    const icon = hasAdapter ? '✓' : '○';
    console.log(`  ${icon} [${post.platform}] ${path.basename(file)} — ${post.type}${post.schedule ? ` @ ${post.schedule}` : ''}`);
    if (post.thread) {
      console.log(`    ${post.thread.length} parts in thread`);
    }
  }
}

function cmdPlatforms() {
  const config = loadConfig();
  const configured = getConfiguredPlatforms(config);

  const ALL_PLATFORMS: Platform[] = ['twitter', 'mastodon', 'bluesky', 'linkedin', 'devto', 'medium', 'facebook', 'reddit', 'discord', 'discourse'];

  console.log('Platform Status:\n');
  for (const p of ALL_PLATFORMS) {
    const ok = configured.includes(p);
    console.log(`  ${ok ? '✓' : '○'} ${p}${ok ? '' : ' — not configured (missing API keys)'}`);
  }
}

function cmdSchedule(args: string[]) {
  const subcommand = args[0];
  const postsDir = 'posts';
  const projectPath = process.cwd();

  if (subcommand === 'list') {
    // List all posts with their schedule dates
    const files = discoverPosts(postsDir);
    const posts = files.map(parsePostFile);
    const scheduled = posts.filter(p => p.schedule).sort((a, b) => (a.schedule ?? '').localeCompare(b.schedule ?? ''));

    console.log('Scheduled Posts:\n');
    for (const post of scheduled) {
      const state = new StateManager();
      const published = state.isPublished(post.file, post.platform);
      const icon = published ? '\u2713' : '\u25CB';
      console.log(`  ${icon} ${post.schedule} [${post.platform}] ${path.basename(post.file)}`);
    }
    if (scheduled.length === 0) console.log('  No scheduled posts. Add schedule: <datetime> to post frontmatter.');
    return;
  }

  if (subcommand === 'show') {
    console.log('Claude Code Scheduled Trigger Configuration:\n');
    console.log('The PosTree schedule uses Claude Code scheduled tasks.');
    console.log('Claude runs `postree publish --pending` on your chosen schedule.\n');
    console.log('Current project path:', projectPath);
    console.log('Posts directory:', path.join(projectPath, postsDir));
    return;
  }

  // Default: show setup guide
  console.log(`
PosTree Schedule \u2014 Powered by Claude Code Scheduled Tasks

PosTree doesn't run its own scheduler. Instead, Claude Code runs
\`postree publish --pending\` on a cron schedule and reports results.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

SETUP OPTION 1: Claude Code CLI
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Run this in your terminal:

  /schedule daily at 10am EST: cd ${projectPath} && npx postree publish --pending && npx postree status

Claude will walk you through the setup conversationally.

SETUP OPTION 2: Claude Code Desktop App
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
1. Open the Schedule page
2. Click "New task" \u2192 "New remote task"
3. Set schedule: Daily at 10:00 AM EST
4. Set prompt:

   cd ${projectPath}
   Run: npx postree publish --pending
   Then: npx postree status
   Report results to Telegram.
   If any posts failed, show the error and suggest a fix.

SETUP OPTION 3: Claude Code Web
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
1. Visit claude.ai/code/scheduled
2. Click "New scheduled task"
3. Set prompt:

   cd ${projectPath}
   Run: npx postree publish --pending
   Then: npx postree status
   Report: what was published, what failed, what's coming up next.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

HOW IT WORKS:
  1. You write posts as markdown files with schedule dates in frontmatter
  2. Claude's scheduled trigger fires (daily, hourly, whatever you set)
  3. Claude runs \`postree publish --pending\`
  4. PosTree checks: schedule <= now? status != published? adapter configured?
  5. Posts that match get published to their platforms
  6. State saved to .postree-state.json
  7. Claude reports results via Telegram/Slack

COMMANDS:
  postree schedule            Show this setup guide
  postree schedule list       List all scheduled posts with dates
  postree schedule show       Show current trigger configuration
`);
}

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
postree v${VERSION} — Plant your posts everywhere

Usage:
  postree publish [options]     Publish posts to platforms
  postree publish --pending     Publish only unpublished posts
  postree publish --all         Publish all posts
  postree publish --platform X  Publish only to platform X
  postree publish --file X      Publish a specific file
  postree publish --dir X       Posts directory (default: posts/)

  postree status                Show publishing history
  postree dry-run [dir]         Preview what would be published
  postree platforms             Show configured platforms
  postree schedule              Set up Claude auto-scheduling
  postree schedule list         List scheduled posts
  postree schedule show         Show trigger configuration

  postree version               Show version
  postree help                  Show this help

Platforms: twitter, mastodon, bluesky, linkedin, devto, medium, facebook, reddit, discord, discourse

Configure via .env file — see .env.example for all keys.
`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
