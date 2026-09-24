'use client';

import { useRef } from 'react';
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from '@/lib/gsap';

const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO;

// Key light + fill light per "room", in the titanium palette.
const scenes = [
  'radial-gradient(80% 65% at 28% 22%, rgb(217 199 167 / 0.55), transparent 70%), linear-gradient(160deg, #3a3530, #131211)',
  'radial-gradient(80% 65% at 72% 18%, rgb(130 150 190 / 0.5), transparent 70%), linear-gradient(200deg, #262b35, #0f1014)',
  'radial-gradient(70% 60% at 50% 12%, rgb(255 214 170 / 0.42), transparent 70%), linear-gradient(180deg, #3b302a, #12100e)',
  'radial-gradient(75% 65% at 22% 28%, rgb(170 178 188 / 0.45), transparent 70%), linear-gradient(170deg, #2e3033, #0f0f10)',
  'radial-gradient(80% 60% at 78% 28%, rgb(210 180 150 / 0.45), transparent 70%), linear-gradient(190deg, #342e2a, #111010)',
];
const skins = ['#b09a86', '#8a7060', '#c4ab94', '#6e5a4c', '#a8968a', '#94806f'];
const hairs = ['#2a211b', '#15110f', '#4a3626', '#0e0c0b', '#3a2d24', '#1c1714'];
const names = ['Maya', 'Kenji', 'Lucía', 'Omar', 'Anya', 'Theo', 'Priya', 'Jonas', 'Amara', 'Leo', 'Sofia', 'Ravi', 'Nora', 'Mateo', 'Ines'];
const lines = ['Hey! 👋', 'Where are you from?', 'Lisbon ☀️', 'haha no way', 'Nice to meet you!', 'What time is it there?', 'I love that song', 'Same here 😄', 'Tokyo, 2am 😅', 'Wait, really?'];

const COLUMNS = 7;
const PER_COLUMN = 3;

function Person({ i }: { i: number }) {
  const skin = skins[i % skins.length];
  const hair = hairs[(i * 5) % hairs.length];
  const id = `p${i}`;
  return (
    // The wrapper centers; GSAP moves the svg inside it (its transform would override the centering).
    <div className="absolute bottom-0 left-1/2 aspect-square h-[80%] -translate-x-1/2">
    <svg viewBox="0 0 100 100" className="person h-full w-full" aria-hidden="true">
      <defs>
        {/* Key light from above-left, falling off into the room. */}
        <radialGradient id={`${id}-skin`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={skin} />
          <stop offset="1" stopColor="#1a1512" />
        </radialGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4540" />
          <stop offset="1" stopColor="#121212" />
        </linearGradient>
      </defs>
      <path d="M8 100 C 10 80, 26 71, 42 69 L 58 69 C 74 71, 90 80, 92 100 Z" fill={`url(#${id}-top)`} />
      <rect x="43" y="54" width="14" height="18" rx="6" fill={`url(#${id}-skin)`} />
      <ellipse cx="50" cy="40" rx="15" ry="18" fill={`url(#${id}-skin)`} />
      <path d="M35 38 C 34 22, 44 18, 51 18 C 60 18, 67 24, 65 38 C 62 30, 56 27, 50 27 C 43 27, 38 31, 35 38 Z" fill={hair} />
    </svg>
    </div>
  );
}

function Tile({ i }: { i: number }) {
  const name = names[i % names.length];
  return (
    <div className="tile relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-[18px] outline outline-1 -outline-offset-1 outline-white/10" style={{ background: scenes[i % scenes.length] }}>
      <Person i={i} />
      {/* Speaking glow */}
      <span className="speak pointer-events-none absolute inset-0 rounded-[18px] opacity-0 shadow-[inset_0_0_0_2px_rgb(217_199_167/0.85),inset_0_0_40px_rgb(217_199_167/0.25)]" />
      <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white/90">
        <span className="h-1.5 w-1.5 rounded-full bg-green" />
        {name}
      </span>
      <span className="bubble-pop absolute right-2.5 top-2.5 max-w-[80%] rounded-[14px] rounded-br-[4px] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-black opacity-0">
        {lines[i % lines.length]}
      </span>
    </div>
  );
}

/**
 * Background for the hero: a slowly drifting wall of live calls. Set
 * NEXT_PUBLIC_HERO_VIDEO to a looping clip to use real footage instead.
 */
export function ChatterWall({ vignette = 'center' }: { vignette?: 'center' | 'bottom' }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (HERO_VIDEO) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const loops: gsap.core.Animation[] = [];

        // Columns scroll forever in alternating directions at slightly different speeds.
        gsap.utils.toArray<HTMLElement>('.wall-col').forEach((col, c) => {
          const up = c % 2 === 0;
          loops.push(
            gsap.fromTo(col, { yPercent: up ? 0 : -50 }, { yPercent: up ? -50 : 0, duration: 60 + c * 7, ease: 'none', repeat: -1 }),
          );
        });

        // Everyone is a little alive: small head movement and breathing.
        gsap.utils.toArray<SVGElement>('.person').forEach((p) => {
          loops.push(
            gsap.to(p, {
              x: () => gsap.utils.random(-5, 5),
              rotation: () => gsap.utils.random(-2.5, 2.5),
              scale: () => gsap.utils.random(0.98, 1.03),
              transformOrigin: '50% 100%',
              duration: () => gsap.utils.random(2.5, 4.5),
              ease: 'sine.inOut',
              repeat: -1,
              yoyo: true,
              repeatRefresh: true,
            }),
          );
        });

        // Someone is always talking, and messages keep popping up.
        const speakers = gsap.utils.toArray<HTMLElement>('.speak');
        const bubbles = gsap.utils.toArray<HTMLElement>('.bubble-pop');
        const pick = gsap.utils.random(speakers, true) as () => HTMLElement;
        const pickBubble = gsap.utils.random(bubbles, true) as () => HTMLElement;
        const chatter = gsap.timeline({ repeat: -1, repeatRefresh: true });
        chatter
          .add(() => {
            const s = pick();
            gsap.fromTo(s, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out', yoyo: true, repeat: 5, repeatDelay: 0.15 });
          })
          .add(() => {
            const b = pickBubble();
            gsap.timeline()
              .fromTo(b, { opacity: 0, scale: 0.85, y: 6, transformOrigin: '100% 100%' }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(2)' })
              .to(b, { opacity: 0, y: -4, duration: 0.35, ease: 'power1.in' }, '+=2.2');
          }, 0.4)
          .to({}, { duration: 0.9 });
        loops.push(chatter);

        // Don't spend frames on it once the hero is scrolled away.
        ScrollTrigger.create({
          trigger: root.current,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: ({ isActive }) => loops.forEach((l) => (isActive ? l.resume() : l.pause())),
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
      {HERO_VIDEO ? (
        <video
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover opacity-60 motion-reduce:hidden"
        />
      ) : (
        <div className="absolute inset-x-[-8%] -top-[20%] bottom-[-20%] [transform:perspective(1600px)_rotateX(12deg)]">
          <div className="grid h-full grid-cols-3 gap-2.5 sm:gap-3 md:grid-cols-5 xl:grid-cols-7">
            {Array.from({ length: COLUMNS }, (_, c) => (
              <div key={c} className={`overflow-hidden ${c >= 5 ? 'hidden xl:block' : c >= 3 ? 'hidden md:block' : ''}`}>
                {/* Two copies back to back so a -50% shift loops seamlessly. */}
                <div className="wall-col flex flex-col gap-2.5 sm:gap-3">
                  {[0, 1].map((copy) =>
                    Array.from({ length: PER_COLUMN }, (_, r) => <Tile key={`${copy}-${r}`} i={c * PER_COLUMN + r + c} />),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Dim and vignette so the copy on top always reads. */}
      {vignette === 'center' ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_48%,rgb(5_5_6/0.86)_0%,rgb(5_5_6/0.55)_60%,rgb(5_5_6/0.18)_100%)]" />
          {/* Portrait screens: the vignette is narrow, so dim a little more. */}
          <div className="absolute inset-0 bg-canvas/45 sm:hidden" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 to-canvas/10" />
      )}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-canvas to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-canvas to-transparent" />
    </div>
  );
}
