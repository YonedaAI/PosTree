import * as fs from 'node:fs';
import * as path from 'node:path';
import { discoverPosts, parsePostFile } from './parser.js';

interface AssignOptions {
  postsDir: string;
  startDate: string;    // ISO date or "tomorrow"
  spreadDays: number;   // spread posts over N days
  timeOfDay: string;    // "10:00"
  overwrite: boolean;   // overwrite existing schedules
}

export function assignSchedules(options: AssignOptions): void {
  const { postsDir, startDate, spreadDays, timeOfDay, overwrite } = options;

  const files = discoverPosts(postsDir);
  const posts = files.map(f => ({ file: f, post: parsePostFile(f) }));

  // Filter to posts needing schedule
  const needsSchedule = overwrite
    ? posts
    : posts.filter(p => !p.post.schedule);

  if (needsSchedule.length === 0) {
    console.log('All posts already have schedule dates.');
    return;
  }

  const base = resolveDate(startDate);
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  console.log(`Assigning schedules to ${needsSchedule.length} posts:`);
  console.log(`  Start: ${base.toISOString().split('T')[0]}`);
  console.log(`  Spread: ${spreadDays} days`);
  console.log(`  Time: ${timeOfDay}\n`);

  for (let i = 0; i < needsSchedule.length; i++) {
    const { file, post } = needsSchedule[i];

    // Distribute evenly across the spread
    const dayOffset = Math.floor((i / needsSchedule.length) * spreadDays);
    const schedDate = new Date(base);
    schedDate.setDate(schedDate.getDate() + dayOffset);
    schedDate.setHours(hours, minutes, 0, 0);
    const isoDate = schedDate.toISOString();

    // Read file, update or add schedule in frontmatter
    const raw = fs.readFileSync(file, 'utf-8');
    let updated: string;

    if (raw.includes('schedule:')) {
      // Replace existing schedule line
      updated = raw.replace(/schedule:.*/, `schedule: ${isoDate}`);
    } else {
      // Add schedule after status line, or after platform line
      updated = raw.replace(/(status:.*\n)/, `$1schedule: ${isoDate}\n`);
      if (updated === raw) {
        // No status line, add after platform line
        updated = raw.replace(/(platform:.*\n)/, `$1schedule: ${isoDate}\n`);
      }
    }

    fs.writeFileSync(file, updated);
    console.log(`  \u2713 ${isoDate.split('T')[0]} ${timeOfDay} [${post.platform}] ${path.basename(file)}`);
  }
}

export function resolveDate(input: string): Date {
  if (input === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (input === 'today') return new Date();
  return new Date(input);
}
