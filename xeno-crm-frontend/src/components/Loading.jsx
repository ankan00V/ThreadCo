import React, { useEffect, useState } from 'react';

/**
 * Loading state that becomes honest if the wait runs long.
 *
 * The API is on Render's free tier, so a first request after an idle period can
 * take ~30-50s while the instance wakes. A spinner that says nothing for 40
 * seconds reads as broken. After 4s this explains itself instead.
 */
export default function Loading({ label = 'Loading' }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const cold = elapsed >= 4;

  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#ef4d23]" />
      {cold ? (
        <div className="max-w-md">
          <p className="text-sm font-medium text-neutral-800">
            Waking the backend — this takes about 30 seconds.
          </p>
          <p className="mt-1.5 text-[13px] text-neutral-500 leading-relaxed">
            The API runs on a free Render instance, which sleeps after inactivity.
            It stays warm once it is up. ({elapsed}s)
          </p>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">{label}…</p>
      )}
    </div>
  );
}
