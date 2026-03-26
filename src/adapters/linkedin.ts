import { PlatformAdapter, PosTreeConfig, PublishResult } from '../types.js';

export function createLinkedinAdapter(config: PosTreeConfig): PlatformAdapter | null {
  if (!config.linkedin) return null;
  const { accessToken } = config.linkedin;

  return {
    name: 'linkedin',
    isConfigured: () => true,

    async post(content: string): Promise<PublishResult> {
      // First get the user's person URN
      const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) {
        return { success: false, error: 'LinkedIn auth failed', platform: 'linkedin', file: '', publishedAt: new Date().toISOString() };
      }
      const me = (await meRes.json()) as { sub: string };
      const authorUrn = `urn:li:person:${me.sub}`;

      const body = {
        author: authorUrn,
        commentary: content,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [] as unknown[],
          thirdPartyDistributionChannels: [] as unknown[],
        },
        lifecycleState: 'PUBLISHED',
      };

      const res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        const postId = res.headers.get('x-restli-id') ?? '';
        return { success: true, url: `https://www.linkedin.com/feed/update/${postId}`, platform: 'linkedin', file: '', publishedAt: new Date().toISOString() };
      }
      const err = await res.text();
      return { success: false, error: `LinkedIn ${res.status}: ${err}`, platform: 'linkedin', file: '', publishedAt: new Date().toISOString() };
    },
  };
}
