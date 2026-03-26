import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assignSchedules, resolveDate } from './scheduler.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('resolveDate', () => {
  it('resolves "tomorrow" to a date one day ahead', () => {
    const now = new Date();
    const result = resolveDate('tomorrow');
    const expected = new Date(now);
    expected.setDate(expected.getDate() + 1);
    expect(result.getDate()).toBe(expected.getDate());
  });

  it('resolves "today" to the current date', () => {
    const now = new Date();
    const result = resolveDate('today');
    expect(result.getDate()).toBe(now.getDate());
    expect(result.getMonth()).toBe(now.getMonth());
  });

  it('resolves ISO date strings', () => {
    const result = resolveDate('2025-06-15');
    // Note: new Date('2025-06-15') parses as UTC midnight
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(5); // 0-indexed
    expect(result.getUTCDate()).toBe(15);
  });

  it('resolves full ISO datetime strings', () => {
    const result = resolveDate('2025-12-25T09:00:00.000Z');
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11);
    expect(result.getUTCDate()).toBe(25);
  });
});

describe('assignSchedules', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postree-sched-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  function writePost(name: string, content: string) {
    fs.writeFileSync(path.join(tmpDir, name), content);
  }

  it('adds schedule dates to posts without schedules', () => {
    writePost('a.md', '---\nplatform: twitter\nstatus: pending\n---\nHello world');
    writePost('b.md', '---\nplatform: linkedin\nstatus: pending\n---\nAnother post');

    assignSchedules({
      postsDir: tmpDir,
      startDate: 'tomorrow',
      spreadDays: 14,
      timeOfDay: '10:00',
      overwrite: false,
    });

    const a = fs.readFileSync(path.join(tmpDir, 'a.md'), 'utf-8');
    const b = fs.readFileSync(path.join(tmpDir, 'b.md'), 'utf-8');
    expect(a).toContain('schedule:');
    expect(b).toContain('schedule:');
  });

  it('skips posts that already have schedule dates', () => {
    writePost('a.md', '---\nplatform: twitter\nstatus: pending\nschedule: 2025-05-01T10:00:00.000Z\n---\nHello');
    writePost('b.md', '---\nplatform: linkedin\nstatus: pending\n---\nNo schedule');

    assignSchedules({
      postsDir: tmpDir,
      startDate: 'tomorrow',
      spreadDays: 14,
      timeOfDay: '10:00',
      overwrite: false,
    });

    const a = fs.readFileSync(path.join(tmpDir, 'a.md'), 'utf-8');
    const b = fs.readFileSync(path.join(tmpDir, 'b.md'), 'utf-8');
    // a should keep its original schedule
    expect(a).toContain('2025-05-01');
    // b should get a new schedule (not the old one)
    expect(b).toContain('schedule:');
    expect(b).not.toContain('2025-05-01');
  });

  it('overwrites existing schedules when --overwrite is set', () => {
    writePost('a.md', '---\nplatform: twitter\nstatus: pending\nschedule: 2025-05-01T10:00:00.000Z\n---\nHello');

    assignSchedules({
      postsDir: tmpDir,
      startDate: 'tomorrow',
      spreadDays: 14,
      timeOfDay: '10:00',
      overwrite: true,
    });

    const a = fs.readFileSync(path.join(tmpDir, 'a.md'), 'utf-8');
    expect(a).not.toContain('2025-05-01');
    expect(a).toContain('schedule:');
  });

  it('spreads schedule dates evenly across the period', () => {
    writePost('a.md', '---\nplatform: twitter\nstatus: pending\n---\nPost 1');
    writePost('b.md', '---\nplatform: linkedin\nstatus: pending\n---\nPost 2');
    writePost('c.md', '---\nplatform: bluesky\nstatus: pending\n---\nPost 3');
    writePost('d.md', '---\nplatform: mastodon\nstatus: pending\n---\nPost 4');

    assignSchedules({
      postsDir: tmpDir,
      startDate: 'tomorrow',
      spreadDays: 12,
      timeOfDay: '09:30',
      overwrite: false,
    });

    const files = ['a.md', 'b.md', 'c.md', 'd.md'];
    const dates: Date[] = [];
    for (const f of files) {
      const content = fs.readFileSync(path.join(tmpDir, f), 'utf-8');
      const match = content.match(/schedule: (.+)/);
      expect(match).not.toBeNull();
      dates.push(new Date(match![1]));
    }

    // Dates should be non-decreasing
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i - 1].getTime());
    }

    // Last date should be after first date (spread across 12 days with 4 posts)
    expect(dates[3].getTime()).toBeGreaterThan(dates[0].getTime());
  });

  it('uses specified time of day', () => {
    writePost('a.md', '---\nplatform: twitter\nstatus: pending\n---\nHello');

    assignSchedules({
      postsDir: tmpDir,
      startDate: 'tomorrow',
      spreadDays: 7,
      timeOfDay: '14:30',
      overwrite: false,
    });

    const content = fs.readFileSync(path.join(tmpDir, 'a.md'), 'utf-8');
    const match = content.match(/schedule: (.+)/);
    const date = new Date(match![1]);
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
  });

  it('prints message when all posts already scheduled', () => {
    writePost('a.md', '---\nplatform: twitter\nstatus: pending\nschedule: 2025-05-01T10:00:00.000Z\n---\nHello');

    // Should not throw, just print info
    assignSchedules({
      postsDir: tmpDir,
      startDate: 'tomorrow',
      spreadDays: 7,
      timeOfDay: '10:00',
      overwrite: false,
    });

    // File should be unchanged
    const content = fs.readFileSync(path.join(tmpDir, 'a.md'), 'utf-8');
    expect(content).toContain('2025-05-01');
  });
});
