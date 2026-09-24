'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Mic, MicOff, RefreshCw, Trophy, Users, Video, VideoOff } from 'lucide-react';
import { Avatar, Button, Group, IconTile, NavBar, OnlinePill } from '@/components/ui';
import { api, formatDuration, session, useOnlineCount, useSession } from '@/lib/api';
import { mediaErrorText, useLocalMedia } from '@/lib/media';

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
      className={`pressable flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40 ${on ? 'glass-chip text-label' : 'bg-white text-black'}`}
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
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="wallpaper" />
        <span className="text-[15px] text-label-2">Loading…</span>
      </div>
    );
  }

  const tiles = [
    { icon: Users, tile: 'bg-gradient-to-b from-[#64d2ff] to-[#0a84ff]', label: 'Conversations', value: stats ? String(stats.totalCalls) : '–' },
    { icon: Clock, tile: 'bg-gradient-to-b from-[#bf5af2] to-[#5e5ce6]', label: 'Time talking', value: stats ? formatDuration(stats.totalSeconds) : '–' },
    { icon: Trophy, tile: 'bg-gradient-to-b from-[#ffd60a] to-[#ff9f0a]', label: 'Longest chat', value: stats ? formatDuration(stats.longestSeconds) : '–' },
  ];

  return (
    <div className="min-h-dvh pb-16">
      <div className="wallpaper" />
      <NavBar>
        <OnlinePill count={online} className="hidden sm:inline-flex" />
        <span className="hidden items-center gap-2 ps-2 md:inline-flex">
          <Avatar name={user.name} size={28} />
          <span className="text-[15px] font-medium">{user.name}</span>
        </span>
        <Button size="sm" variant="gray" onClick={logout}>Sign out</Button>
      </NavBar>

      <main className="mx-auto max-w-6xl px-4">
        <header className="materialize px-2 pb-8 pt-12">
          <p className="text-[15px] font-medium text-label-2">@{user.username}</p>
          <h1 className="large-title mt-1 text-[clamp(2.25rem,5vw,3.25rem)]">{greeting()}, {user.name.split(' ')[0]}</h1>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          {/* Camera preview: 8px inset, so the video radius is 28 − 8 = 20. */}
          <section aria-label="Camera preview" className="glass-thick materialize rounded-[28px] p-2" style={{ '--delay': '60ms' } as React.CSSProperties}>
            <div className="theme-dark relative aspect-video overflow-hidden rounded-[20px] bg-black">
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
          </section>

          {/* Start */}
          <form onSubmit={start} className="glass-thick materialize flex flex-col justify-between gap-8 rounded-[28px] p-7" style={{ '--delay': '120ms' } as React.CSSProperties}>
            <div>
              <h2 className="text-[22px] font-bold tracking-[-0.015em]">Ready to chat?</h2>
              <p className="mt-1 text-pretty text-[15px] text-label-2">Your display name is the only thing your partner sees.</p>
              <Group className="mt-6">
                <label className="flex min-h-12 items-center gap-3 px-4">
                  <span className="w-24 shrink-0 text-[15px]">Name</span>
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
                <Video className="h-5 w-5" fill="currentColor" /> Start Video Chat
              </Button>
              <p className="tabular mt-3 text-center text-[13px] text-label-3">
                {online !== null && online > 0 ? `${online} ${online === 1 ? 'person is' : 'people are'} in chat right now` : 'Be the first one in'}
              </p>
            </div>
          </form>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.55fr]">
          <section aria-label="Your stats" className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {tiles.map(({ icon, tile, label, value }, i) => (
              <div key={label} className="glass materialize flex items-center gap-4 rounded-[24px] p-5" style={{ '--delay': `${180 + i * 60}ms` } as React.CSSProperties}>
                <IconTile icon={icon} className={tile} />
                <div>
                  <p className="text-[13px] font-medium text-label-2">{label}</p>
                  <p className="tabular text-[22px] font-bold tracking-[-0.015em]">{value}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="glass materialize rounded-[28px] p-6" style={{ '--delay': '240ms' } as React.CSSProperties}>
            <h2 className="text-[22px] font-bold tracking-[-0.015em]">Recents</h2>
            {!stats || stats.recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="h-8 w-8 text-label-3" />
                <p className="text-[15px] font-medium">No conversations yet</p>
                <p className="text-[13px] text-label-2">People you talk to for more than a few seconds show up here.</p>
              </div>
            ) : (
              <ul className="mt-3">
                {stats.recent.map((c) => (
                  <li key={c.id} className="group flex items-center gap-3 py-2">
                    <Avatar name={c.partnerName} size={40} />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 border-b border-separator py-2 group-last:border-b-0">
                      <span className="truncate text-[17px]">{c.partnerName}</span>
                      <span className="tabular flex shrink-0 items-baseline gap-3 text-[15px] text-label-2">
                        <span>{formatDuration(c.durationSec)}</span>
                        <span className="w-20 text-right text-[13px] text-label-3">{timeAgo(c.startedAt)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
