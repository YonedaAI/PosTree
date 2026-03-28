# Plan: Add Platform-Side Post Deletion to Postiz

## Problem

Postiz's `deletePost` only soft-deletes from its own database (`SET deletedAt = NOW()`). It never calls any platform API to remove the actual post from LinkedIn, Twitter/X, etc. The `ISocialMediaIntegration` interface defines only `post()` and `comment()` — no `delete()`. Zero of 21 provider adapters implement platform deletion.

This means "deleting" a post in Postiz leaves it live on all social platforms. This is a blocker for PosTree and any serious social media management workflow.

## Scope

Add an optional `delete?()` method to the provider interface. Implement for all platforms whose APIs support deletion. Wire it into `PostsService.deletePost()` so that deleting a post from Postiz also deletes it from the platform.

## Platform Delete API Support

| Platform | API Delete | Endpoint | Scope Needed | Scopes Postiz Already Requests |
|----------|-----------|----------|--------------|-------------------------------|
| LinkedIn Personal | YES | `DELETE /rest/posts/{urn}` | `w_member_social` | `w_member_social` ✓ |
| LinkedIn Page | YES | `DELETE /rest/posts/{urn}` | `w_organization_social` | `w_organization_social` ✓ |
| X/Twitter | YES | `DELETE /2/tweets/:id` | `tweet.write` | Needs verification |
| Facebook Page | YES | `DELETE /{post-id}` (Graph API) | `pages_manage_posts` | Needs verification |
| Mastodon | YES | `DELETE /api/v1/statuses/:id` | `write:statuses` | Needs verification |
| Bluesky | YES | `com.atproto.repo.deleteRecord` | Session auth | ✓ (same as post) |
| Reddit | YES | `POST /api/del` with `id=t3_{id}` | `edit` | Needs verification |
| Discord | YES | `DELETE /webhooks/{id}/{token}/messages/{id}` | Webhook token | ✓ (same as post) |
| Pinterest | YES | `DELETE /v5/pins/{pin_id}` | `pins:write` | Needs verification |
| YouTube | YES | `DELETE /youtube/v3/videos?id={id}` | `youtube` scope | Needs verification |
| Telegram | YES | `POST /bot{token}/deleteMessage` | Bot admin | ✓ (same as post) |
| Slack | YES | `POST /api/chat.delete` | `chat:write` | Needs verification |
| WordPress | YES | `DELETE /wp/v2/posts/{id}` | `delete_posts` | Needs verification |
| Hashnode | YES | GraphQL `removePost(id)` | PAT | Needs verification |
| Instagram | NO | No public delete API | N/A | N/A |
| Threads | NO | No delete endpoint | N/A | N/A |
| Medium | NO | API frozen, no delete | N/A | N/A |
| TikTok | NO* | Heavily gated, partner-only | N/A | N/A |

## Architecture

### Current (no platform delete)

```
Public API: DELETE /posts/:id
  → PostsService.deletePost(orgId, group)
    → PostsRepository.deletePost()  → SET deletedAt = NOW()
    → TermporalService              → terminate scheduled workflows
    → return { error: true }        ← hardcoded, misleading
```

### Proposed (with platform delete)

```
Public API: DELETE /posts/:id
  → PostsService.deletePost(orgId, group)
    → Query all posts in group (need releaseId + integration details)
    → For each post with releaseId:
        → Load provider for integration.providerIdentifier
        → Load integration token from DB
        → Call provider.delete(integrationId, accessToken, releaseId)
        → Log success/failure per platform
    → PostsRepository.deletePost()  → SET deletedAt = NOW()
    → TermporalService              → terminate scheduled workflows
    → return { deleted: true, platforms: [{name, success, error?}] }
```

## Implementation Steps

### Step 1: Add `delete?()` to the interface

**File:** `libraries/nestjs-libraries/src/integrations/social/social.integrations.interface.ts`

```typescript
export interface ISocialMediaIntegration {
  post(...): Promise<PostResponse[]>;
  comment?(...): Promise<PostResponse[]>;

  // NEW: Delete a published post from the platform
  delete?(
    id: string,           // integration's internalId (person/org ID)
    accessToken: string,
    postId: string,        // platform-specific post ID (releaseId from DB)
    integration: Integration
  ): Promise<void>;
}
```

Optional method — providers that don't support delete simply don't implement it.

### Step 2: Implement LinkedIn delete

**File:** `libraries/nestjs-libraries/src/integrations/social/linkedin.provider.ts`

```typescript
async delete(
  id: string,
  accessToken: string,
  postId: string,        // e.g., "urn:li:share:7443383974099533824"
  integration: Integration
): Promise<void> {
  const response = await this.fetch(
    `https://api.linkedin.com/rest/posts/${encodeURIComponent(postId)}`,
    {
      method: 'DELETE',
      headers: {
        'LinkedIn-Version': '202601',
        'X-Restli-Protocol-Version': '2.0.0',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (response.status !== 204 && response.status !== 200) {
    const body = await response.text();
    throw new Error(`LinkedIn delete failed (${response.status}): ${body}`);
  }
}
```

**File:** `libraries/nestjs-libraries/src/integrations/social/linkedin.page.provider.ts`

Inherits from `LinkedinProvider` — the same `delete()` method works for pages since the endpoint is the same. The URN format (`urn:li:share:...`) already encodes whether it's a personal or org post.

### Step 3: Implement X/Twitter delete

**File:** `libraries/nestjs-libraries/src/integrations/social/x.provider.ts`

```typescript
async delete(
  id: string,
  accessToken: string,
  postId: string,        // tweet ID
  integration: Integration
): Promise<void> {
  const response = await this.fetch(
    `https://api.twitter.com/2/tweets/${postId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`X delete failed (${response.status}): ${body}`);
  }
}
```

### Step 4: Implement remaining providers

Each is a single method, ~10-15 lines. Priority order:
1. LinkedIn + LinkedIn Page (our immediate need)
2. X/Twitter, Facebook, Mastodon, Bluesky (high-use platforms)
3. Reddit, Discord, Telegram, Slack, Pinterest (medium-use)
4. YouTube, WordPress, Hashnode (lower priority)
5. Instagram, Threads, Medium, TikTok — skip (no API support)

### Step 5: Wire into PostsService.deletePost()

**File:** `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts`

The key change — before soft-deleting, load integration tokens and call provider delete:

```typescript
async deletePost(orgId: string, group: string) {
  // NEW: Get all posts in group WITH their integration details
  const postsInGroup = await this._postRepository.getPostsByGroup(orgId, group);

  const platformResults: Array<{platform: string, success: boolean, error?: string}> = [];

  for (const post of postsInGroup) {
    if (!post.releaseId || !post.integration) continue;

    const provider = this._integrationManager.getAllSocials().find(
      s => s.identifier === post.integration.providerIdentifier
    );

    if (!provider?.delete) continue; // provider doesn't support delete

    try {
      await provider.delete(
        post.integration.internalId,
        post.integration.token,
        post.releaseId,
        post.integration
      );
      platformResults.push({ platform: post.integration.providerIdentifier, success: true });
    } catch (err) {
      platformResults.push({
        platform: post.integration.providerIdentifier,
        success: false,
        error: err.message
      });
    }
  }

  // Existing: soft delete from DB
  const dbPost = await this._postRepository.deletePost(orgId, group);

  // Existing: terminate Temporal workflows
  if (dbPost?.id) {
    // ... existing Temporal termination code ...
  }

  return { deleted: true, platforms: platformResults };
}
```

### Step 6: Add repository helper

**File:** `libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts`

```typescript
async getPostsByGroup(orgId: string, group: string) {
  return this._post.model.post.findMany({
    where: {
      organizationId: orgId,
      group,
      deletedAt: null,
    },
    select: {
      id: true,
      releaseId: true,
      integration: {
        select: {
          id: true,
          internalId: true,
          token: true,
          providerIdentifier: true,
        },
      },
    },
  });
}
```

### Step 7: Update public API response

**File:** `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`

The delete endpoint already exists. The response changes from `{ error: true }` to `{ deleted: true, platforms: [...] }`, which is backward-compatible (new fields added, no fields removed that clients depend on).

## Test Plan

### Local Development Setup

1. Fork `gitroomhq/postiz-app` to `YonedaAI/postiz-app`
2. Clone fork locally
3. Modify `docker/docker-compose.yml` in PosTree to build from local source:
   ```yaml
   services:
     postiz:
       build: /path/to/local/postiz-app
       # instead of: image: ghcr.io/gitroomhq/postiz-app:latest
   ```
4. Start local Postiz: `docker-compose up -d --build`
5. Connect LinkedIn accounts via local Postiz dashboard (http://localhost:5000)
6. Get API key from local instance

### Test Matrix

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | Delete scheduled (unpublished) LinkedIn post | `postiz posts:delete <id>` | Removed from Postiz, never reaches LinkedIn |
| 2 | Delete published LinkedIn personal post | `postiz posts:delete <id>` | Removed from Postiz AND LinkedIn |
| 3 | Delete published LinkedIn page post | `postiz posts:delete <id>` | Removed from Postiz AND LinkedIn page |
| 4 | Delete post group (both platforms) | `DELETE /posts/:id` | Both LinkedIn posts deleted |
| 5 | Delete post where provider doesn't support delete | Create Instagram post, delete | Removed from Postiz, Instagram post persists, response shows `{success: false}` |
| 6 | Delete post with expired token | Expire token, try delete | Platform delete fails gracefully, DB soft-delete still happens |
| 7 | PosTree publish then delete | `postree publish` → `postree delete` | Full lifecycle works |
| 8 | Verify via LinkedIn API | `GET /rest/posts/{urn}` after delete | Returns 404 |
| 9 | Verify via Postiz list | `postiz posts:list` after delete | Post gone |

### Verification Script

```bash
# 1. Create
postiz posts:create -c "Delete test" -i $INTEGRATION_ID -s "$(date -u -v+5S '+%Y-%m-%dT%H:%M:%SZ')" -t schedule
# Wait for publish
sleep 30
# 2. List (capture post ID and releaseURL)
postiz posts:list --startDate $(date -u '+%Y-%m-%dT00:00:00Z') --endDate $(date -u -v+1d '+%Y-%m-%dT00:00:00Z')
# 3. Delete
postiz posts:delete $POST_ID
# 4. Verify gone from Postiz
postiz posts:list ...
# 5. Verify gone from LinkedIn (should 404 or show as deleted)
curl -s "https://www.linkedin.com/feed/update/$RELEASE_ID"
```

## Deployment Plan

1. **Develop locally** — fork, implement, test against local Docker
2. **Push to fork** — `YonedaAI/postiz-app`
3. **Deploy fork to Railway** — point Railway at the fork instead of official image
4. **Test against Railway** — full lifecycle with real LinkedIn
5. **Submit PR upstream** — `YonedaAI/postiz-app` → `gitroomhq/postiz-app`
6. **Once merged** — switch Railway back to official image

## Effort Estimate

| Task | Size |
|------|------|
| Interface change | ~5 lines |
| LinkedIn delete (personal + page) | ~20 lines |
| Wire into PostsService | ~30 lines |
| Repository helper | ~15 lines |
| Fix response (remove `{error: true}`) | ~5 lines |
| X/Twitter delete | ~15 lines |
| Mastodon delete | ~10 lines |
| Bluesky delete | ~15 lines |
| Facebook delete | ~10 lines |
| All other providers | ~10 lines each |
| Testing | ~2 hours |
| **Total new code** | **~200 lines across 25 files** |

## Risk

- **Token refresh timing**: If a token expires between the platform delete and the DB soft-delete, we could delete from platform but fail to mark as deleted in Postiz. Mitigation: delete from platform first, then soft-delete DB (current order in the plan).
- **Rate limits**: LinkedIn has API rate limits. Deleting many posts quickly could hit them. Mitigation: sequential deletion with error handling per post.
- **Partial failure in groups**: A group with posts on LinkedIn + Twitter could succeed on LinkedIn but fail on Twitter. Mitigation: return per-platform results, still soft-delete from DB.
