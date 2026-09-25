'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap, MOTION_OK, MOTION_REDUCED, useGSAP } from '@/lib/gsap';
import { AppIcon } from './ui';

/** Apple-style activity indicator: eight fading bars stepping around a circle. */
export function ActivityIndicator({ size = 28, label = 'Loading' }: { size?: number; label?: string }) {
  return (
    <span role="status" aria-label={label} className="activity" style={{ width: size, height: size }}>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} style={{ transform: `rotate(${i * 45}deg)`, opacity: 1 - i * 0.1 }} />
      ))}
    </span>
  );
}

/** Centered full-screen loading state. */
export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <div className="wallpaper" />
      <ActivityIndicator size={32} label={label} />
      <span className="text-[13px] font-medium text-label-3">{label}…</span>
    </div>
  );
}

const WORD = 'VibeCall';

/**
 * Branded intro: icon materializes, the wordmark rises, a hairline fills,
 * then the curtain lifts. Plays once per browser session (see layout script).
 */
export function IntroLoader() {
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (document.documentElement.dataset.intro !== 'play') setGone(true);
  }, []);

  useGSAP(
    () => {
      if (document.documentElement.dataset.intro !== 'play') return;

      const finish = () => {
        try { sessionStorage.setItem('vm-intro', '1'); } catch {}
        const wasPlaying = document.documentElement.dataset.intro === 'play';
        document.documentElement.dataset.intro = 'done';
        if (wasPlaying) window.dispatchEvent(new Event('intro:done'));
        setGone(true);
      };
      const fontsReady = document.fonts?.ready ?? Promise.resolve();
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        const enter = gsap.timeline();
        enter
          .from('.intro-icon', { scale: 0.7, autoAlpha: 0, filter: 'blur(12px)', duration: 1.1 })
          .from('.intro-char', { yPercent: 110, autoAlpha: 0, stagger: 0.035, duration: 0.9 }, '-=0.75')
          .fromTo('.intro-bar', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, '-=0.5');

        // Lift the curtain once the entrance has played and fonts are in, whichever is later.
        Promise.all([enter.then(), fontsReady]).then(() => {
          gsap.timeline({ onComplete: finish })
            .to('.intro-content', { autoAlpha: 0, y: -16, filter: 'blur(6px)', duration: 0.5, ease: 'power2.in' })
            .to(root.current, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, '-=0.15')
            // Page entrances start while the curtain is still moving, so the two feel like one motion.
            .add(() => {
              document.documentElement.dataset.intro = 'lifting';
              window.dispatchEvent(new Event('intro:done'));
            }, '-=0.55');
        });
      });

      mm.add(MOTION_REDUCED, () => {
        fontsReady.then(() => gsap.to(root.current, { autoAlpha: 0, duration: 0.3, ease: 'none', onComplete: finish }));
      });
    },
    { scope: root },
  );

  if (gone) return null;

  return (
    <div ref={root} className="intro" style={{ clipPath: 'inset(0% 0% 0% 0%)' }} aria-hidden="true">
      <div className="intro-content flex flex-col items-center">
        <div className="intro-icon"><AppIcon size={76} /></div>
        <p className="mt-6 flex overflow-hidden text-[26px] font-semibold tracking-[-0.02em] text-silver">
          {WORD.split('').map((c, i) => (
            <span key={i} className="intro-char inline-block">{c}</span>
          ))}
        </p>
        <span className="mt-7 block h-px w-40 overflow-hidden bg-white/10">
          <span className="intro-bar block h-full w-full origin-left bg-gradient-to-r from-champagne/40 via-white to-champagne/40" />
        </span>
      </div>
    </div>
  );
}
