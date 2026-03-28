# PosTree

**Generate social media posts from source content, publish via [Postiz](https://postiz.com).**

Write once, post to 33+ platforms. PosTree generates platform-specific content from articles, papers, or any text. Postiz handles OAuth, scheduling, and platform management.

## How it works

```
Source content (markdown, paper, text)
  ↓
postree generate → platform-specific posts in ./posts/
  ↓
postree publish → schedules via Postiz Temporal
  ↓
Postiz → LinkedIn, Twitter/X, Mastodon, Bluesky, Instagram, YouTube, TikTok, ...
```

## Install

```bash
npm install -g @yonedaai/postree
```

This installs both `postree` CLI and the bundled Postiz CLI.

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

# 2. Run init again to auto-populate channel IDs
postree init

# 3. Generate posts from your content
postree generate --from paper.md --platforms linkedin,twitter

# 4. Review posts in ./posts/, then publish
postree publish
```

## Commands

### Content

```bash
# Generate from a file
postree generate --from paper.md --platforms twitter,linkedin,mastodon

# Generate from raw text
postree generate --text "We just released v2.0" --platforms linkedin,twitter

# Generate with scheduling
postree generate --from paper.md --platforms linkedin --schedule "next monday 10am" --spread 7

# Publish pending posts to Postiz
postree publish

# Publish specific file
postree publish --file posts/linkedin-announcement.md
```

### Schedule

```bash
# Auto-assign dates to posts
postree schedule assign --start tomorrow --spread 14 --time 10:00

# List scheduled posts
postree schedule list
```

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
schedule: 2026-04-01T10:00:00Z
---
Your post content here. #hashtags #included
```

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

PosTree also works as a Claude Code plugin for conversational content creation:

```
You: write a linkedin post about our new release, schedule tomorrow 10am
Claude: [generates post, saves to ./posts/, offers to publish]
```

## Architecture

PosTree generates content. Postiz manages everything else.

| PosTree | Postiz |
|---------|--------|
| LLM content generation | OAuth for 33+ platforms |
| Platform-specific formatting | Temporal scheduling |
| Schedule spreading | Publishing, delete, analytics |
| Per-repo markdown posts | Media upload |

**Zero OAuth in PosTree.** Postiz holds all tokens and handles all platform APIs.

## License

MIT — [YonedaAI Research Collective](https://github.com/YonedaAI)
