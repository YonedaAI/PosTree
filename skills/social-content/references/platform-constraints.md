# Platform Constraints

## Short-form platforms

| Platform | Max Length | Format | Threads | Notes |
|----------|-----------|--------|---------|-------|
| twitter | 280 | short | Yes | Hook-first, punchy. Use line breaks. |
| mastodon | 500 | short | Yes | Similar to twitter but more room. |
| bluesky | 300 | short | Yes | Concise, hashtag-friendly. |
| threads | 500 | short | Yes | Meta's text platform. |
| discord | 2000 | short | No | Plain text, no markdown rendering. |
| slack | 4000 | short | No | Supports basic formatting. |
| telegram | 4096 | casual | No | Supports markdown formatting. |

## Professional platforms

| Platform | Max Length | Format | Articles | Notes |
|----------|-----------|--------|----------|-------|
| linkedin | 3000 | professional | No | Professional tone, structured paragraphs, minimal emojis. |
| facebook | 63206 | casual | No | Plain text only, no markdown. Conversational. |

## Article platforms

| Platform | Max Length | Format | Notes |
|----------|-----------|--------|-------|
| devto | 100000 | article | Full markdown. 4-tag limit. Title on first line. |
| medium | 100000 | article | Full markdown. 5-tag limit. |
| hashnode | 100000 | article | Full markdown via GraphQL. |
| wordpress | 100000 | article | Full HTML/markdown. |

## Visual/Video platforms

| Platform | Max Length | Format | Notes |
|----------|-----------|--------|-------|
| instagram | 2200 | casual | Caption for image/video. No links in captions. |
| youtube | 5000 | casual | Video description. |
| tiktok | 2200 | short | Video caption. |
| pinterest | 500 | short | Pin description with link. |

## Other platforms

| Platform | Max Length | Format | Notes |
|----------|-----------|--------|-------|
| reddit | 40000 | technical | Technical audience. Self-posts. Needs subreddit. |
| discourse | 32000 | technical | Forum topic. Needs category. |
| lemmy | 40000 | technical | Fediverse Reddit alternative. |
| vk | 15000 | casual | Russian social network. |
| nostr | 1000 | short | Decentralized protocol. |
| farcaster | 1024 | short | Web3 social. |

## Format styles

- **short**: Concise, punchy, hook-first. Use line breaks for readability.
- **professional**: Professional tone, structured paragraphs, insight-driven. No emojis unless tasteful.
- **article**: Full article with `# Title` on first line. Well-structured with headers.
- **casual**: Conversational, accessible. Plain text only for Facebook.
- **technical**: Technical audience. Include relevant details, code examples if applicable.

## Thread rules

For platforms that support threads, if content exceeds max length:
- Split into parts separated by `---` on its own line
- Each part must be under the platform's max length
- First part should hook the reader
- Last part should have a call to action

## Default (unknown platforms)

Max length: 3000, format: casual, no threads, no articles.
