'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { Avatar } from './ui';

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Apple's momentum projection (Designing Fluid Interfaces, WWDC 2018).
const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

// Progressive resistance past an edge instead of a hard stop.
const rubberband = (overshoot: number, dimension: number, c = 0.55) =>
  (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));

/**
 * Picture-in-picture self view, FaceTime style: drag it 1:1, flick it, and it
 * springs to whichever corner the gesture was heading for.
 */
export function SelfView({
  stream,
  videoOn,
  name,
  insets,
}: {
  stream: MediaStream | null;
  videoOn: boolean;
  name: string;
  insets: Insets;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const corner = useRef<Corner>('br');
  const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; history: { x: number; y: number; t: number }[] } | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const cornerPoints = useCallback(() => {
    const el = ref.current;
    const stage = el?.parentElement;
    if (!el || !stage) return null;
    const w = el.offsetWidth, h = el.offsetHeight;
    const W = stage.clientWidth, H = stage.clientHeight;
    const left = insets.left, right = W - w - insets.right;
    const top = insets.top, bottom = H - h - insets.bottom;
    return {
      bounds: { left, right, top, bottom },
      points: { tl: { x: left, y: top }, tr: { x: right, y: top }, bl: { x: left, y: bottom }, br: { x: right, y: bottom } } as Record<Corner, { x: number; y: number }>,
    };
  }, [insets]);

  const snapTo = useCallback(
    (c: Corner, velocity = { x: 0, y: 0 }, momentum = false) => {
      const geo = cornerPoints();
      if (!geo) return;
      corner.current = c;
      const target = geo.points[c];
      if (reduceMotion) {
        x.set(target.x);
        y.set(target.y);
        return;
      }
      // Independent X/Y springs; a little bounce only when a flick carried momentum.
      const spring = { type: 'spring' as const, visualDuration: 0.4, bounce: momentum ? 0.2 : 0 };
      animate(x, target.x, { ...spring, velocity: velocity.x });
      animate(y, target.y, { ...spring, velocity: velocity.y });
    },
    [cornerPoints, reduceMotion, x, y],
  );

  // Place without animation on mount; re-snap when the safe area changes (chat opens, resize).
  const placed = useRef(false);
  useLayoutEffect(() => {
    const geo = cornerPoints();
    if (!geo) return;
    if (!placed.current) {
      x.set(geo.points[corner.current].x);
      y.set(geo.points[corner.current].y);
      placed.current = true;
    } else {
      snapTo(corner.current);
    }
  }, [cornerPoints, snapTo, x, y]);

  useEffect(() => {
    const onResize = () => snapTo(corner.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [snapTo]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (drag.current) return; // ignore extra fingers mid-drag
    e.currentTarget.setPointerCapture(e.pointerId);
    x.stop();
    y.stop();
    // Start from the live, on-screen position so grabbing mid-flight never jumps.
    drag.current = {
      dx: e.clientX - x.get(),
      dy: e.clientY - y.get(),
      startX: e.clientX,
      startY: e.clientY,
      history: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const geo = cornerPoints();
    if (!d || !geo) return;
    const { left, right, top, bottom } = geo.bounds;
    const el = ref.current!;
    const clampRubber = (v: number, min: number, max: number, dim: number) =>
      v < min ? min + rubberband(v - min, dim) : v > max ? max + rubberband(v - max, dim) : v;
    x.set(clampRubber(e.clientX - d.dx, left, right, el.offsetWidth));
    y.set(clampRubber(e.clientY - d.dy, top, bottom, el.offsetHeight));
    d.history.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (d.history.length > 6) d.history.shift();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    const geo = cornerPoints();
    if (!d || !geo) return;

    const first = d.history[0];
    const dt = Math.max(e.timeStamp - first.t, 1);
    const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4;
    const velocity = moved ? { x: ((e.clientX - first.x) / dt) * 1000, y: ((e.clientY - first.y) / dt) * 1000 } : { x: 0, y: 0 };

    // Choose the corner nearest to where the throw would come to rest.
    const px = x.get() + project(velocity.x);
    const py = y.get() + project(velocity.y);
    const { left, right, top, bottom } = geo.bounds;
    const c = `${py < (top + bottom) / 2 ? 't' : 'b'}${px < (left + right) / 2 ? 'l' : 'r'}` as Corner;
    const fast = Math.hypot(velocity.x, velocity.y) > 400;
    snapTo(c, velocity, fast);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const [v, h] = corner.current.split('') as ['t' | 'b', 'l' | 'r'];
    const next: Record<string, string> = { ArrowUp: `t${h}`, ArrowDown: `b${h}`, ArrowLeft: `${v}l`, ArrowRight: `${v}r` };
    if (next[e.key]) {
      e.preventDefault();
      snapTo(next[e.key] as Corner);
    }
  };

  return (
    <motion.div
      ref={ref}
      style={{ x, y, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-label="Your camera. Drag, or use arrow keys, to move it to another corner."
      className="absolute left-0 top-0 z-10 aspect-[3/4] w-28 cursor-grab select-none overflow-hidden rounded-[18px] bg-[#1c1c1e] shadow-[0_12px_40px_-8px_rgb(0_0_0/0.6)] outline outline-1 -outline-offset-1 outline-white/10 active:cursor-grabbing sm:w-36 md:aspect-video md:w-60"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`mirror pointer-events-none h-full w-full object-cover ${videoOn ? '' : 'invisible'}`}
      />
      {!videoOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar name={name} size={48} />
        </div>
      )}
    </motion.div>
  );
}
