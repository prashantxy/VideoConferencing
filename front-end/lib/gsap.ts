'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  gsap.defaults({ ease: 'expo.out', duration: 1 });
}

export { gsap, ScrollTrigger, SplitText, useGSAP };

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
export const MOTION_REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Runs `cb` once the intro loader has finished (or immediately if it isn't
 * playing), so page entrances start as the curtain lifts, not behind it.
 */
export function whenIntroDone(cb: () => void): () => void {
  if (document.documentElement.dataset.intro !== 'play') {
    cb();
    return () => {};
  }
  window.addEventListener('intro:done', cb, { once: true });
  return () => window.removeEventListener('intro:done', cb);
}

/** Reveals every hidden [data-reveal] element without motion. */
export function revealAll(scope?: Element | null) {
  gsap.set((scope ?? document).querySelectorAll('[data-reveal]'), { autoAlpha: 1 });
}
