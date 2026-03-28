---
allowed-tools: Bash, Read, Write, Glob, Edit
description: "Generate social media posts from source content. Reads a file or directory and creates platform-specific markdown posts in ./posts/"
arguments:
  - name: source
    description: "Source file, directory, or text to generate posts from"
  - name: "--platforms"
    description: "Comma-separated platforms (default: twitter,linkedin,mastodon,bluesky)"
  - name: "--schedule"
    description: "Base schedule date (ISO or 'tomorrow')"
  - name: "--spread"
    description: "Spread posts over N days (default: 14)"
  - name: "--image"
    description: "URL or local path to image to attach to posts"
---

Generate platform-specific social media posts from the given source content.

## Steps

1. Determine the source content:
   - If a file path: read it
   - If a directory: read all .md files in it
   - If text: use as-is
   - If nothing provided: ask the user

2. Determine target platforms from --platforms flag (default: twitter,linkedin,mastodon,bluesky)

3. Read platform constraints from `${CLAUDE_PLUGIN_ROOT}/skills/social-content/references/platform-constraints.md`

4. For each platform, generate a post following the platform's constraints:
   - Respect max character length
   - Match the format style (short, professional, article, casual, technical)
   - Include relevant hashtags
   - Split into thread parts (separated by `---`) if content is too long and platform supports threads

5. Build each post as a markdown file with YAML frontmatter:
   ```
   ---
   platform: {platform}
   type: {post|thread|article}
   status: pending
   schedule: {ISO date if --schedule provided}
   ---
   {generated content}
   ```

6. If --schedule and --spread are provided, distribute posts across the spread days

7. Write each file to `./posts/{platform}-{name}.md`

8. Report what was created

## After generation

Tell the user they can:
- Review/edit the generated posts in ./posts/
- Publish via `postree publish` or `postiz posts:create`
- Manage posts via `postiz posts:list`, `postiz posts:delete`
