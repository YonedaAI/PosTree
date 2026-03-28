# PosTree

**Generate social media posts from source content, publish to 33+ platforms via [Postiz](https://postiz.com).**

Write once, post everywhere. PosTree generates platform-specific content from articles, papers, or any text using LLMs (Claude, GPT-4, Gemini). Postiz handles OAuth, scheduling via Temporal, and platform management.

## How it works

```
Source content (markdown, paper, text)
  ↓
postree generate → platform-specific posts in ./posts/
  ↓
postree publish → sends to Postiz with schedule dates
  ↓
Postiz Temporal → publishes at scheduled time
  ↓
LinkedIn, Twitter/X, Mastodon, Bluesky, Instagram, YouTube, TikTok, ...
```

## Install

### CLI

```bash
npm install -g @yonedaai/postree
```

This installs the `postree` CLI with bundled Postiz CLI, Anthropic SDK, OpenAI SDK, and Gemini SDK.

### Claude Code Plugin

```bash
claude plugin add /path/to/PosTree
```

This adds `/postree` and `/postree-publish` commands plus the social-content skill to Claude Code. Works in any repo — just run `postree init` in each repo to create `.env` and `posts/`.

## Postiz Setup

PosTree requires a [Postiz](https://postiz.com) instance to publish. Two options:

### Railway (one click)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/postiz-with-temporal?projectId=8d6901cd-9865-4e39-8aea-446d1460fbbc)

After deploy:
1. Open your Postiz dashboard
2. Connect your social accounts (LinkedIn, Twitter/X, etc.)
3. Settings -> API Keys -> Generate a key

### Local Docker

```bash
git clone https://github.com/gitroomhq/postiz-app && cd postiz-app
docker-compose -f docker/docker-compose.yml up -d
# Dashboard at http://localhost:5000
```

## Quick Start

```bash
# 1. Initialize repo
cd my-project
postree init
# Edit .env: add POSTIZ_API_URL, POSTIZ_API_KEY, ANTHROPIC_API_KEY

# 2. Run init again to auto-populate channel IDs from Postiz
postree init

# 3. Generate posts from your content
postree generate --from paper.md --platforms linkedin,twitter

# 4. Review posts in ./posts/, then publish
postree publish
```

## Commands

### Generate

```bash
# From a file
postree generate --from paper.md --platforms twitter,linkedin,mastodon

# From raw text
postree generate --text "We just released v2.0" --platforms linkedin,twitter

# With scheduling (natural language)
postree generate --from paper.md --platforms linkedin,twitter --schedule "next monday 10am" --spread 7
```

### Schedule

```bash
# Auto-assign dates to existing posts in ./posts/
postree schedule assign --start tomorrow --spread 14 --time 10:00

# List scheduled posts
postree schedule list
```

### Publish

```bash
# Publish all pending posts (sends to Postiz with schedule dates)
postree publish

# Publish specific file
postree publish --file posts/linkedin-announcement.md

# Only posts whose schedule has passed
postree publish --pending
```

Posts with a `schedule:` date are sent to Postiz Temporal, which publishes them at the scheduled time. Posts without a schedule are published immediately (5s delay for Temporal).

### Manage

```bash
# List published posts
postree list --startDate 2026-03-01 --endDate 2026-04-01

# Delete a post from platform
postree delete <post-id>

# Upload media
postree upload <file>

# Post analytics
postree analytics <post-id>

# Connected platforms
postree channels
```

## Post Format

Posts are markdown files with YAML frontmatter in `./posts/`:

```markdown
---
platform: linkedin
type: post
status: pending
schedule: 2026-04-01T15:00:00Z
---
Your post content here. #hashtags #included
```

Platform values: `linkedin`, `linkedin_page`, `twitter`, `mastodon`, `bluesky`, `instagram`, `facebook`, `youtube`, `tiktok`, `threads`, `reddit`, `discord`, `telegram`, `devto`, `medium`, `hashnode`, `wordpress`, `pinterest`, `slack`, and more.

## Configuration

`postree init` creates a `.env` file per repo:

```env
# Postiz instance
POSTIZ_API_URL=https://your-instance.up.railway.app/api
POSTIZ_API_KEY=your-key

# LLM for content generation (at least one)
ANTHROPIC_API_KEY=your-key
# OPENAI_API_KEY=
# GEMINI_API_KEY=

# Channel IDs (auto-populated by postree init)
# POSTIZ_LINKEDIN=abc123...
# POSTIZ_LINKEDIN_PAGE=def456...
# POSTIZ_TWITTER=ghi789...
```

Channel IDs are auto-populated when you run `postree init` with valid Postiz credentials.

## Claude Code Plugin

PosTree includes a Claude Code plugin for conversational content creation. When working in a repo with PosTree:

```
You: create linkedin and twitter posts about our JAPL v0.1 release,
     schedule starting next monday, spread across the week

Claude: [reads platform constraints from plugin]
        [generates platform-specific posts]
        [writes to ./posts/ with schedule dates]

        Created:
          posts/linkedin-japl-release.md  (Mon 10am)
          posts/twitter-japl-release.md   (Wed 10am)

        Want me to publish?

You: yes

Claude: [runs postree publish]
        Published 2 posts via Postiz.
        LinkedIn scheduled for Mon, Twitter for Wed.
```

The plugin provides skills for platform constraints and commands for `/postree` and `/postree-publish`.

## Architecture

PosTree generates content. Postiz manages everything else.

| PosTree | Postiz |
|---------|--------|
| LLM content generation (Claude, GPT-4, Gemini) | OAuth for 33+ platforms |
| Platform-specific formatting | Temporal scheduling & publishing |
| Natural language scheduling | Platform-side delete |
| Per-repo markdown posts | Analytics, media upload |

**Zero OAuth in PosTree.** Postiz holds all tokens and handles all platform APIs.

## License

MIT — [YonedaAI Research Collective](https://github.com/YonedaAI)
