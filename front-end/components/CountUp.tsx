'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';

/** Counts from the previous value to `value`, formatting every frame. */
export function CountUp({ value, format = (n) => String(Math.round(n)) }: { value: number | null; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef({ n: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || value === null) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      current.current.n = value;
      el.textContent = format(value);
      return;
    }
    const tween = gsap.to(current.current, {
      n: value,
      duration: 1.6,
      ease: 'expo.out',
      onUpdate: () => { el.textContent = format(Math.round(current.current.n)); },
    });
    return () => { tween.kill(); };
  }, [value, format]);

  return <span ref={ref} className="tabular">{value === null ? '–' : format(0)}</span>;
}
