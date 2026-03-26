import { PosTreeState, StateEntry, Platform, PublishResult } from './types.js';
import * as fs from 'node:fs';

const DEFAULT_STATE: PosTreeState = { entries: [] };

export class StateManager {
  private state: PosTreeState;
  private path: string;

  constructor(statePath: string = '.postree-state.json') {
    this.path = statePath;
    this.state = this.load();
  }

  private load(): PosTreeState {
    if (!fs.existsSync(this.path)) return { entries: [] };
    return JSON.parse(fs.readFileSync(this.path, 'utf-8'));
  }

  save(): void {
    this.state.lastRun = new Date().toISOString();
    fs.writeFileSync(this.path, JSON.stringify(this.state, null, 2));
  }

  getEntry(file: string, platform: Platform): StateEntry | undefined {
    return this.state.entries.find(e => e.file === file && e.platform === platform);
  }

  isPublished(file: string, platform: Platform): boolean {
    const entry = this.getEntry(file, platform);
    return entry?.status === 'published';
  }

  record(result: PublishResult): void {
    const existing = this.state.entries.findIndex(
      e => e.file === result.file && e.platform === result.platform
    );

    const entry: StateEntry = {
      file: result.file,
      platform: result.platform,
      status: result.success ? 'published' : 'failed',
      url: result.url,
      urls: result.urls,
      publishedAt: result.publishedAt,
      error: result.error,
      attempts: (existing >= 0 ? this.state.entries[existing].attempts : 0) + 1,
    };

    if (existing >= 0) {
      this.state.entries[existing] = entry;
    } else {
      this.state.entries.push(entry);
    }
  }

  getPending(): StateEntry[] {
    return this.state.entries.filter(e => e.status === 'pending');
  }

  getFailed(): StateEntry[] {
    return this.state.entries.filter(e => e.status === 'failed');
  }

  getPublished(): StateEntry[] {
    return this.state.entries.filter(e => e.status === 'published');
  }

  getSummary(): { pending: number; published: number; failed: number } {
    return {
      pending: this.getPending().length,
      published: this.getPublished().length,
      failed: this.getFailed().length,
    };
  }

  getAllEntries(): StateEntry[] { return this.state.entries; }
}
