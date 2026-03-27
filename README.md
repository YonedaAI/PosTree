# PosTree

**Plant your posts everywhere** — a multi-platform social media publishing CLI.

Write posts as markdown with frontmatter. PosTree publishes them to 10 platforms.
Claude Code schedules the publishing automatically.

## Setup

### Quick Start with Postiz (recommended)

PosTree uses [Postiz](https://github.com/gitroomhq/postiz-app) — a free, open-source social media scheduler — to handle all platform authentication.

```bash
# 1. Start Postiz
cd docker && docker-compose up -d

# 2. Connect your social accounts
open http://localhost:5000
# → Settings → Integrations → Connect Twitter, LinkedIn, Facebook, etc.

# 3. Get your API key
# → Settings → API Keys → Generate

# 4. Configure PosTree
echo "POSTIZ_URL=http://localhost:3000" >> .env
echo "POSTIZ_API_KEY=your-key" >> .env

# 5. Test
postree platforms
postree publish --file posts/test.md
```

### Alternative: Direct API Keys

If you prefer not to run Postiz, configure individual platform API keys in `.env`. See `.env.example` for all options.

### Quick Start (CLI)

```bash
# Install
npm install -g postree

# Preview what would be published
postree dry-run posts/

# Publish all pending posts
postree publish --pending

# Check status
postree status

# Set up Claude auto-scheduling
postree schedule
```

## Post Format

Posts are markdown files with YAML frontmatter:

```markdown
---
platform: twitter
type: thread
schedule: 2026-03-28T10:00:00Z
tags: [programming, research]
status: pending
---
First tweet in the thread.

---

Second tweet continues here.

---

Third tweet with the link.
https://example.com
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `platform` | Yes | twitter, mastodon, bluesky, linkedin, devto, medium, facebook, reddit, discord, discourse |
| `type` | No | post (default), thread, article |
| `schedule` | No | ISO datetime — post won't publish until this time |
| `tags` | No | Tags/hashtags for the platform |
| `status` | No | pending (default), draft, published, failed |
| `title` | No | Article title (for Medium, Dev.to) |
| `subreddit` | No | Target subreddit (for Reddit) |
| `channel` | No | Target channel (for Discord) |
| `instance_url` | No | Instance URL (for Mastodon, Discourse) |
| `canonical_url` | No | Original URL (for cross-posts) |

## Platforms

| Platform | Auth Method | Threads | Articles | Setup |
|----------|------------|---------|----------|-------|
| Twitter/X | OAuth 1.0a | Yes | No | [developer.twitter.com](https://developer.twitter.com) |
| Mastodon | Bearer token | Yes | No | Instance Settings → Development |
| Bluesky | App password | Yes | No | Settings → App Passwords |
| LinkedIn | OAuth 2.0 | No | No | [developer.linkedin.com](https://developer.linkedin.com) |
| Dev.to | API key | No | Yes | [dev.to/settings/extensions](https://dev.to/settings/extensions) |
| Medium | Integration token | No | Yes | Settings → Integration tokens |
| Facebook | Page token | No | No | [developers.facebook.com](https://developers.facebook.com) |
| Reddit | OAuth 2.0 | No | No | [reddit.com/prefs/apps](https://reddit.com/prefs/apps) |
| Discord | Webhook URL | No | No | Channel Settings → Integrations |
| Discourse | API key | No | No | Admin → API Keys |

## Commands

```
postree publish [options]      Publish posts
  --pending                    Only unpublished + scheduled posts
  --all                        All posts regardless of status
  --platform <name>            Only this platform
  --file <path>                Only this file
  --dir <path>                 Posts directory (default: posts/)

postree status                 Show publishing history
postree dry-run [dir]          Preview without publishing
postree platforms              Show configured platforms
postree schedule               Set up Claude auto-scheduling
postree schedule list          List scheduled posts
postree version                Show version
postree help                   Show help
```

## Scheduling with Claude Code

PosTree doesn't run its own cron. Instead, **Claude Code** runs `postree publish --pending` on a schedule and reports results.

### Setup (pick one)

**CLI:**
```
/schedule daily at 10am: cd /path/to/project && npx postree publish --pending && npx postree status
```

**Desktop App:** Schedule page → New remote task → set prompt and cron

**Web:** claude.ai/code/scheduled → New scheduled task

### How It Works

1. You write posts as `.md` files with `schedule:` dates
2. Claude's trigger fires on your chosen schedule
3. PosTree checks: `schedule <= now` AND `status != published`
4. Matching posts get published to their platforms
5. State saved to `.postree-state.json`
6. Claude reports results to Telegram/Slack

## Configuration

**With Postiz (recommended):** Run `postree setup` for guided instructions. One Docker container handles all platforms.

**Without Postiz:** Copy `.env.example` to `.env` and add individual platform API keys:

```bash
cp .env.example .env
```

Only configure the platforms you want to use. PosTree skips unconfigured platforms.

## Development

```bash
npm install          # Install dependencies
npm test             # Run tests
npm run build        # Compile TypeScript
```

## License

MIT

## Author

**Matthew Long** — [YonedaAI Research Collective](https://github.com/YonedaAI)
