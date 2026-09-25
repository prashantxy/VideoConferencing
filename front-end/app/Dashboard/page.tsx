'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Mic, MicOff, RefreshCw, Trophy, Users, Video, VideoOff } from 'lucide-react';
import { Avatar, Button, Group, IconTile, NavBar, OnlinePill, SupportButton } from '@/components/ui';
import { api, formatDuration, session, useOnlineCount, useSession } from '@/lib/api';
import { mediaErrorText, useLocalMedia } from '@/lib/media';
import { PageLoader } from '@/components/Loader';
import { CountUp } from '@/components/CountUp';
import { gsap, MOTION_OK, MOTION_REDUCED, revealAll, useGSAP, whenIntroDone } from '@/lib/gsap';

interface Stats {
  totalCalls: number;
  totalSeconds: number;
  longestSeconds: number;
  recent: { id: string; partnerName: string; startedAt: string; durationSec: number }[];
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

function timeAgo(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  if (diff > -60) return 'Just now';
  if (diff > -3600) return relative.format(Math.round(diff / 60), 'minute');
  if (diff > -86400) return relative.format(Math.round(diff / 3600), 'hour');
  return relative.format(Math.round(diff / 86400), 'day');
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function MediaButton({ on, onClick, disabled, labelOn, labelOff, iconOn: IconOn, iconOff: IconOff }: {
  on: boolean; onClick: () => void; disabled?: boolean; labelOn: string; labelOff: string;
  iconOn: React.ElementType; iconOff: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={on ? labelOn : labelOff}
      aria-pressed={!on}
      className={`pressable flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40 ${on ? 'glass-chip text-label' : 'bg-accent text-on-accent'}`}
    >
      {on ? <IconOn className="h-5 w-5" /> : <IconOff className="h-5 w-5" />}
    </button>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useSession();
  const online = useOnlineCount();
  const [prefs] = useState(() => (typeof window === 'undefined' ? null : session.chatPrefs()));
  const media = useLocalMedia({ audio: prefs?.hasAudio ?? true, video: prefs?.hasVideo ?? true });
  const [name, setName] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!user) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ paused: true });
        tl.from('.dash-head > *', { autoAlpha: 0, y: 24, filter: 'blur(8px)', duration: 1.1, stagger: 0.08 })
          .from('.dash-start', { autoAlpha: 0, y: 40, scale: 0.97, filter: 'blur(10px)', duration: 1.3 }, 0.15)
          .from('.dash-start-side > *', { autoAlpha: 0, x: 16, duration: 1, stagger: 0.07 }, 0.45);
        const cancel = whenIntroDone(() => tl.play());
        gsap.from('.dash-activity [data-reveal]', {
          autoAlpha: 0, y: 40, filter: 'blur(8px)', duration: 1.1, stagger: 0.1,
          scrollTrigger: { trigger: '.dash-activity', start: 'top 85%', once: true },
        });
        return cancel;
      });
      mm.add(MOTION_REDUCED, () => revealAll(root.current));
    },
    { scope: root, dependencies: [!!user] },
  );

  useEffect(() => {
    if (user && !name) setName(prefs?.name || user.name.split(' ')[0]);
  }, [user, name, prefs]);

  useEffect(() => {
    if (!user) return;
    api<Stats>('/users/me/stats').then(setStats).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = media.stream;
  }, [media.stream, user]);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    session.saveChatPrefs({ name: name.trim(), hasAudio: media.audioOn, hasVideo: media.videoOn });
    router.push('/Room');
  };

  if (!user) {
    return <PageLoader label="Loading your dashboard" />;
  }

  const tiles = [
    { icon: Users, label: 'Conversations', value: stats ? stats.totalCalls : null, format: String },
    { icon: Clock, label: 'Time talking', value: stats ? stats.totalSeconds : null, format: formatDuration },
    { icon: Trophy, label: 'Longest chat', value: stats ? stats.longestSeconds : null, format: formatDuration },
  ];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div ref={root} className="min-h-dvh pb-[max(6rem,env(safe-area-inset-bottom))]">
      <div className="wallpaper" />
      <NavBar>
        <OnlinePill count={online} className="hidden sm:inline-flex" />
        <span className="hidden items-center gap-2 ps-2 md:inline-flex">
          <Avatar name={user.name} size={28} />
          <span className="text-[15px] font-medium">{user.name}</span>
        </span>
        <SupportButton />
        <Button size="sm" variant="gray" onClick={logout}>Sign out</Button>
      </NavBar>

      <main className="mx-auto max-w-[1120px] px-5">
        {/* ── Greeting ─────────────────────────────────────── */}
        <header className="dash-head pb-10 pt-12 sm:pb-12 sm:pt-14">
          <p data-reveal className="eyebrow">{today}</p>
          <h1 data-reveal className="large-title text-silver mt-3 text-[clamp(2.5rem,6vw,4rem)]">{greeting()}, {user.name.split(' ')[0]}.</h1>
          <p data-reveal className="mt-3 text-[17px] text-label-2">Signed in as @{user.username}</p>
        </header>

        {/* ── Start a conversation ─────────────────────────── */}
        <section aria-labelledby="start">
          <div data-reveal className="dash-start glass-thick grid overflow-hidden rounded-[32px] lg:grid-cols-[1.45fr_1fr]">
            {/* Camera: 10px inset keeps the video radius concentric (32 − 10 = 22). */}
            <div className="p-2.5">
              <div className="relative aspect-video overflow-hidden rounded-[22px] bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`mirror h-full w-full object-cover transition-opacity duration-300 ${media.videoOn && media.stream ? 'opacity-100' : 'opacity-0'}`}
                />
                {!media.stream && !media.error && (
                  <div className="absolute inset-0 flex items-center justify-center text-[15px] text-label-2">Starting camera…</div>
                )}
                {media.error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <VideoOff className="h-8 w-8 text-label-2" />
                    <p className="max-w-sm text-pretty text-[15px] text-label-2">{mediaErrorText[media.error]}</p>
                    <Button variant="glass" onClick={media.retry}><RefreshCw className="h-4 w-4" /> Try Again</Button>
                  </div>
                )}
                {media.stream && !media.videoOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Avatar name={name || user.name} size={96} />
                    <span className="text-[13px] font-medium text-label-2">Camera is off</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
                  <MediaButton on={media.audioOn} onClick={media.toggleAudio} disabled={!media.stream} labelOn="Mute microphone" labelOff="Unmute microphone" iconOn={Mic} iconOff={MicOff} />
                  <MediaButton on={media.videoOn} onClick={media.toggleVideo} disabled={!media.stream} labelOn="Turn camera off" labelOff="Turn camera on" iconOn={Video} iconOff={VideoOff} />
                </div>
              </div>
            </div>

            <form onSubmit={start} className="dash-start-side flex flex-col justify-between gap-10 border-t border-separator p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div>
                <h2 id="start" className="text-[28px] font-semibold tracking-[-0.025em]">Start a conversation</h2>
                <p className="mt-2 text-pretty text-[15px] leading-relaxed text-label-2">Your display name is the only thing your partner will know about you.</p>
                <Group className="mt-7">
                  <label className="flex min-h-12 items-center gap-3 px-4">
                    <span className="w-20 shrink-0 text-[15px]">Name</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={40}
                      placeholder="Display name"
                      className="h-12 min-w-0 flex-1 bg-transparent text-base placeholder:text-label-3 focus:outline-none sm:text-[15px]"
                    />
                  </label>
                </Group>
                <p className="mt-3 px-4 text-[13px] text-label-3">
                  Joining with mic {media.audioOn ? 'on' : 'off'} and camera {media.videoOn ? 'on' : 'off'}.
                </p>
              </div>
              <div>
                <Button type="submit" size="lg" disabled={!name.trim() || !media.stream} className="w-full">
                  Start Video Chat
                </Button>
                <p className="tabular mt-3 flex items-center justify-center gap-2 text-[13px] text-label-3">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" />
                  {online !== null && online > 0 ? `${online} ${online === 1 ? 'person is' : 'people are'} in chat right now` : 'Be the first one in'}
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* ── Activity ─────────────────────────────────────── */}
        <section aria-labelledby="activity" className="dash-activity mt-16 sm:mt-20">
          <div data-reveal className="flex items-end justify-between gap-4 border-b border-separator pb-4">
            <div>
              <h2 id="activity" className="text-[28px] font-semibold tracking-[-0.025em]">Your activity</h2>
              <p className="mt-1 text-[15px] text-label-2">Conversations longer than a few seconds are counted here.</p>
            </div>
          </div>

          <dl data-reveal className="glass mt-6 grid overflow-hidden rounded-[28px] sm:grid-cols-3">
            {tiles.map(({ icon, label, value, format }, i) => (
              <div key={label} className={`flex items-center gap-4 p-6 ${i > 0 ? 'border-t border-separator sm:border-l sm:border-t-0' : ''}`}>
                <IconTile icon={icon} />
                <div>
                  <dt className="text-[13px] font-medium text-label-2">{label}</dt>
                  <dd className="text-[28px] font-semibold tracking-[-0.02em]"><CountUp value={value} format={format} /></dd>
                </div>
              </div>
            ))}
          </dl>

          <div data-reveal className="glass mt-4 rounded-[28px] px-5 pb-3 pt-6 sm:px-6">
            <h3 className="text-[17px] font-semibold">Recent conversations</h3>
            {!stats || stats.recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="h-8 w-8 text-label-3" strokeWidth={1.5} />
                <p className="text-[15px] font-medium">No conversations yet</p>
                <p className="text-[13px] text-label-2">The people you talk to will show up here.</p>
              </div>
            ) : (
              <ul className="mt-2">
                {stats.recent.map((c) => (
                  <li key={c.id} className="group flex items-center gap-3 py-1.5">
                    <Avatar name={c.partnerName} size={40} />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 border-b border-separator py-3 group-last:border-b-0">
                      <span className="truncate text-[17px]">{c.partnerName}</span>
                      <span className="tabular flex shrink-0 items-baseline gap-4 text-[15px] text-label-2">
                        <span>{formatDuration(c.durationSec)}</span>
                        <span className="w-20 text-right text-[13px] text-label-3">{timeAgo(c.startedAt)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
