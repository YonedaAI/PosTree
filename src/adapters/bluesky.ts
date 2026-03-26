import { PlatformAdapter, PosTreeConfig, PublishResult } from '../types.js';

const BSKY_BASE = 'https://bsky.social/xrpc';

export function createBlueskyAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.bluesky) return null;
  const { handle, appPassword } = config.bluesky;

  let session: { accessJwt: string; did: string } | null = null;

  async function ensureSession(): Promise<{ accessJwt: string; did: string }> {
    if (session) return session;
    const res = await fetch(`${BSKY_BASE}/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
    });
    if (!res.ok) throw new Error(`Bluesky auth failed: ${res.status}`);
    session = (await res.json()) as { accessJwt: string; did: string };
    return session;
  }

  return {
    name: 'bluesky',
    isConfigured: () => true,

    async post(content: string): Promise<PublishResult> {
      const { accessJwt, did } = await ensureSession();
      const record = {
        $type: 'app.bsky.feed.post',
        text: content,
        createdAt: new Date().toISOString(),
      };
      const res = await fetch(`${BSKY_BASE}/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: err, platform: 'bluesky', file: '', publishedAt: new Date().toISOString() };
      }
      const data = (await res.json()) as { uri: string; cid: string };
      const rkey = data.uri.split('/').pop();
      const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
      return { success: true, url, platform: 'bluesky', file: '', publishedAt: new Date().toISOString() };
    },

    async postThread(parts: string[]): Promise<PublishResult> {
      const { accessJwt, did } = await ensureSession();
      const urls: string[] = [];
      let parentRef: { uri: string; cid: string } | undefined;
      let rootRef: { uri: string; cid: string } | undefined;

      for (const part of parts) {
        const record: Record<string, unknown> = {
          $type: 'app.bsky.feed.post',
          text: part,
          createdAt: new Date().toISOString(),
        };
        if (parentRef) {
          record.reply = { root: rootRef ?? parentRef, parent: parentRef };
        }

        const res = await fetch(`${BSKY_BASE}/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessJwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }),
        });
        if (!res.ok) {
          return { success: false, error: `Thread failed at post ${urls.length + 1}`, platform: 'bluesky', file: '', publishedAt: new Date().toISOString() };
        }
        const data = (await res.json()) as { uri: string; cid: string };
        if (!rootRef) rootRef = { uri: data.uri, cid: data.cid };
        parentRef = { uri: data.uri, cid: data.cid };
        const rkey = data.uri.split('/').pop();
        urls.push(`https://bsky.app/profile/${handle}/post/${rkey}`);
      }

      return { success: true, urls, url: urls[0], platform: 'bluesky', file: '', publishedAt: new Date().toISOString() };
    },
  };
}
