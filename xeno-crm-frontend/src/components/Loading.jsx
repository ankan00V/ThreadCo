import React, { useEffect, useState } from 'react';
import Loader from './Loader';

// Render's own dashboard warns that a spun-down free instance "can delay
// requests by 50 seconds or more", so that is the budget the countdown uses
// rather than a number chosen to look good.
const COLD_START_SECONDS = 50;

// Only claim the backend is asleep once a warm response has clearly not
// arrived. Below this, a brief wait is just a normal request.
const COLD_AFTER_SECONDS = 2.5;

const STAGES = [
  { at: 0,  text: 'Waking the server' },
  { at: 8,  text: 'Starting the API process' },
  { at: 18, text: 'Connecting to Postgres' },
  { at: 30, text: 'Warming the query planner' },
  { at: 40, text: 'Fetching your data' },
];

/**
 * Loading state that tells the truth about a cold start.
 *
 * The API runs on Render's free tier, which sleeps after ~15 minutes idle. A
 * bare spinner for 50 seconds reads as a broken page, so once the wait passes
 * the threshold this explains what is happening and counts down against
 * Render's stated wake time. If it overruns, it says so rather than sitting at
 * zero pretending.
 */
export default function Loading({ label = 'Loading' }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, []);

  const cold = elapsed >= COLD_AFTER_SECONDS;
  const remaining = Math.max(0, Math.ceil(COLD_START_SECONDS - elapsed));
  const overrun = cold && remaining === 0;
  const pct = Math.min(100, (elapsed / COLD_START_SECONDS) * 100);

  const stage = [...STAGES].reverse().find((s) => elapsed >= s.at) || STAGES[0];

  if (!cold) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-5">
        <Loader label={label} />
        <p className="text-sm text-neutral-500 font-body">{label}…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center gap-6 px-6 text-center font-body">
      <Loader label={label} />

      <div className="max-w-md">
        <p className="font-display text-2xl text-neutral-900 tracking-tight">
          {overrun ? 'Almost there' : stage.text}
          <span className="text-neutral-400">…</span>
        </p>

        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
          {overrun ? (
            <>Past Render's usual wake time. The instance is starting from cold — it will come up.</>
          ) : (
            <>The API sleeps on Render's free tier after inactivity. Waking it takes about{' '}
            <strong className="font-semibold text-neutral-800">{remaining}s</strong>, and it stays
            warm afterwards.</>
          )}
        </p>

        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-neutral-200/80">
          <div
            className="h-full rounded-full bg-[#ef4d23] transition-[width] duration-300 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="mt-3 text-[11px] uppercase tracking-wider text-neutral-400">
          {Math.floor(elapsed)}s elapsed
        </p>
      </div>
    </div>
  );
}
