import React, { useEffect, useRef, useState } from 'react';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4';

// A frame pulled from the video itself, so the fallback is the same scene
// rather than an unrelated image. Also the poster while the video buffers.
const POSTER = '/stage-poster.jpg';

// Average colour of that frame — painted underneath so there is never a flash
// of white, even before the poster loads.
const BASE_TONE = 'rgb(177, 190, 190)';

const MAX_RECOVERY_ATTEMPTS = 4;

/**
 * Decorative background video that repairs itself.
 *
 * Browsers suspend looping background video to save power — Safari especially,
 * on low power mode or after a tab has been inactive. Once suspended the element
 * stays paused and paints the native play affordance. Because the video is
 * `pointer-events-none` (it must be, or it would eat clicks meant for the page),
 * that button cannot even be pressed: the background just sits there dead.
 *
 * So rather than trusting autoplay to hold, this listens for the ways playback
 * dies and restarts it: an unexpected pause, the tab becoming visible again, a
 * stall, or a decode error. After a few failed attempts it stops fighting the
 * browser and shows the poster frame, which is a legitimate outcome — some
 * devices refuse background video entirely, and a still image is the right
 * answer there rather than an endless retry loop.
 */
export default function StageBackground() {
  const videoRef = useRef(null);
  const attemptsRef = useRef(0);
  const [fallback, setFallback] = useState(false);

  // Honour a stated preference for less motion: no video at all, just the frame.
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (reduceMotion) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;

    const attemptPlay = () => {
      if (cancelled || !video.paused) return;
      if (attemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
        setFallback(true);
        return;
      }
      attemptsRef.current += 1;
      // play() rejects when the browser declines; that is expected, not an error.
      video.play().then(
        () => { attemptsRef.current = 0; },
        () => {
          if (attemptsRef.current >= MAX_RECOVERY_ATTEMPTS) setFallback(true);
        },
      );
    };

    const onVisibility = () => { if (!document.hidden) attemptPlay(); };
    const onError = () => setFallback(true);

    video.addEventListener('pause', attemptPlay);
    video.addEventListener('stalled', attemptPlay);
    video.addEventListener('suspend', attemptPlay);
    video.addEventListener('ended', attemptPlay);      // belt and braces alongside loop
    video.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', attemptPlay);

    attemptPlay();

    return () => {
      cancelled = true;
      video.removeEventListener('pause', attemptPlay);
      video.removeEventListener('stalled', attemptPlay);
      video.removeEventListener('suspend', attemptPlay);
      video.removeEventListener('ended', attemptPlay);
      video.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', attemptPlay);
    };
  }, [reduceMotion]);

  const showStill = reduceMotion || fallback;

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      style={{ backgroundColor: BASE_TONE }}
      aria-hidden="true"
    >
      {showStill ? (
        <img src={POSTER} alt="" className="w-full h-full object-cover" />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={POSTER}
          disableRemotePlayback
          disablePictureInPicture
          controls={false}
          webkit-playsinline="true"
          x5-playsinline="true"
          className="w-full h-full object-cover"
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
