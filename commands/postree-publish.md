---
allowed-tools: Bash, Read, Write, Glob, Edit
description: "Publish pending posts from ./posts/ via Postiz CLI"
---

Publish pending posts to social media platforms via the Postiz CLI.

## Steps

1. Scan `./posts/` for `.md` files
2. Read each file's frontmatter — filter to `status: pending`
3. If a schedule date exists and is in the future, skip it
4. For each ready post, run:
   ```
   postiz posts:create -c "{content}" -s "{schedule_date_5s_from_now}" -t schedule
   ```
   IMPORTANT: Always use `-t schedule` with a near-future date. Never use "now" — posts must go through Postiz's Temporal workflow for full lifecycle management (including platform-side delete).

5. On success, update the post's frontmatter: `status: pending` -> `status: published`
6. Report results

## Prerequisites

- Postiz CLI installed: `npm install -g postiz`
- Environment: `POSTIZ_API_KEY` and `POSTIZ_API_URL` must be set
- Integration IDs: use `postiz integrations:list` to find connected channels

## Post-publish management

Use the Postiz CLI directly:
- `postiz posts:list --startDate ... --endDate ...`
- `postiz posts:delete <id>`
- `postiz analytics:post <id>`
