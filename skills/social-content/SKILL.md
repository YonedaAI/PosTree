---
name: social-content
description: Use when the user asks to create social media posts, generate posts for platforms, adapt content for social media, write tweets from articles, create threads, or schedule social posts. Also triggered by mentions of PosTree, cross-platform posting, or social media content generation.
version: 0.3.4
---

# Social Content Generation

Generate platform-specific social media posts from source content (articles, papers, conversations, announcements). Each post is saved as a markdown file with YAML frontmatter in `./posts/`.

## Post format

```markdown
---
platform: twitter
type: post
status: pending
schedule: 2026-04-01T10:00:00Z
tags: [tag1, tag2]
---
Post content here.
```

## Frontmatter fields

- `platform`: target platform (twitter, linkedin, mastodon, bluesky, etc.)
- `type`: post | thread | article
- `status`: pending | published | draft
- `schedule`: ISO datetime (optional)
- `image`: URL or local path to attach (optional, auto-detected from OG tags if post contains a URL)
- `tags`: array of tags (optional)
- `title`: article title (for devto, medium, hashnode, wordpress)

## Generation rules

1. Read platform constraints from `${CLAUDE_PLUGIN_ROOT}/skills/social-content/references/platform-constraints.md`
2. Adapt content to each platform's max length, format style, and capabilities
3. Include relevant hashtags for the platform
4. For thread-capable platforms, split long content with `---` separators
5. Never include frontmatter metadata in the post content itself

## Schedule spreading

When creating posts for multiple platforms, spread them across days:
- Distribute N posts evenly across M days (default: 14)
- Default time: 10:00 AM
- Calculate: `scheduleDate = startDate + (index / count * spreadDays) days`

## Publishing

Posts are published via the Postiz CLI:
- `postiz posts:create -c "content" -s "date" -t schedule`
- Always use `-t schedule` (not "now") — posts must go through Temporal for full lifecycle
- Use `postiz integrations:list` to find integration IDs for targeting specific channels

## Post management (via Postiz CLI)

- `postiz posts:list --startDate X --endDate Y` — list posts
- `postiz posts:delete <id>` — delete from platform + Postiz
- `postiz analytics:post <id>` — engagement metrics
- `postiz analytics:platform <id>` — channel analytics
