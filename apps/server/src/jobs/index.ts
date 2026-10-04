import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { runCleanupJob } from './cleanup.job.js';
import { runDueSoonJob } from './dueSoon.job.js';

let tasks: ScheduledTask[] = [];

/** Wraps a job so a failure is logged and never crashes the process. */
const safely = (name: string, job: () => Promise<number>) => async () => {
  try {
    const count = await job();
    if (count > 0) console.log(`[jobs] ${name}: ${count}`);
  } catch (err) {
    console.error(`[jobs] ${name} failed`, err);
  }
};

/** Schedules the background jobs, unless RUN_JOBS=false (tests, extra instances). */
export function startJobs() {
  if (!env.RUN_JOBS) return;

  const dueSoon = safely('due-soon reminders', runDueSoonJob);
  tasks = [
    cron.schedule(env.DUE_SOON_CRON, dueSoon, { name: 'due-soon' }),
    cron.schedule('0 2 * * *', safely('notification cleanup', runCleanupJob), {
      name: 'cleanup',
    }),
  ];
  // The job is state-based, so one run at startup catches up on anything missed while down.
  void dueSoon();
}

export async function stopJobs() {
  await Promise.all(tasks.map((task) => task.stop()));
  tasks = [];
}
