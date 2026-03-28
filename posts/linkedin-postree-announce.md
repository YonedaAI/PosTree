---
platform: linkedin
type: post
schedule: 2026-03-30T15:00:00.000Z
status: published
---
Tired of manually reformatting the same content for every social platform? Same.

That's why we built PosTree.

🌳 PosTree is an open-source CLI that generates platform-specific social media posts from your existing content — articles, papers, release notes, anything — and publishes them to 33+ platforms via Postiz.

Here's how it works:

📝 Write once in markdown
🤖 LLM adapts it per platform (Claude, GPT-4, Gemini)
📅 Schedule with natural language ("next monday 10am")
🚀 Publish to LinkedIn, Twitter/X, Mastodon, Bluesky, Instagram, YouTube, TikTok, and more

What makes it different:

- Per-repo config — each project gets its own posts/ directory and .env
- Channel IDs auto-populated from your Postiz instance
- Zero OAuth in PosTree — Postiz handles all the tokens
- Postiz Temporal for reliable scheduled delivery
- Works as a CLI or a Claude Code plugin

Install in 30 seconds:
npm install -g @yonedaai/postree
postree init
postree generate --from your-article.md --platforms linkedin,twitter
postree publish

Built by YonedaAI Research Collective.

github.com/YonedaAI/PosTree

#OpenSource #DevTools #SocialMedia #ContentCreation #AI #TypeScript
