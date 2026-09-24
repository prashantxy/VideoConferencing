'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, LogOut, Mic, MicOff, RefreshCw, Video, VideoOff } from 'lucide-react';
import { Button, Logo, OnlinePill } from '@/components/ui';
import { api, formatDuration, session, useOnlineCount, useSession } from '@/lib/api';
import { mediaErrorText, useLocalMedia } from '@/lib/media';

interface Stats {
  totalCalls: number;
  totalSeconds: number;
  longestSeconds: number;
  recent: { id: string; partnerName: string; startedAt: string; durationSec: number }[];
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useSession();
  const online = useOnlineCount();
  const prefs = typeof window !== 'undefined' ? session.chatPrefs() : null;
  const media = useLocalMedia({ audio: prefs?.hasAudio ?? true, video: prefs?.hasVideo ?? true });
  const [name, setName] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user && !name) setName(prefs?.name || user.name.split(' ')[0]);
     
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api<Stats>('/users/me/stats').then(setStats).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = media.stream;
  }, [media.stream]);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    session.saveChatPrefs({ name: name.trim(), hasAudio: media.audioOn, hasVideo: media.videoOn });
    router.push('/Room');
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="label blink">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex"><OnlinePill count={online} /></span>
          <Button variant="ghost" onClick={logout} aria-label="Log out">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <section className="rise pb-10 pt-8">
          <p className="label">@{user.username}</p>
          <h1 className="mt-3 font-serif text-5xl md:text-7xl">
            {greeting()}, <em className="text-signal">{user.name.split(' ')[0]}.</em>
          </h1>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Camera preview */}
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-line bg-ink-2">
            <video ref={videoRef} autoPlay playsInline muted className={`mirror h-full w-full object-cover transition-opacity ${media.videoOn && media.stream ? 'opacity-100' : 'opacity-0'}`} />

            {!media.stream && !media.error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="label blink">Waking up your camera…</span>
              </div>
            )}
            {media.error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <VideoOff className="h-8 w-8 text-danger" />
                <p className="max-w-sm text-sm text-muted">{mediaErrorText[media.error]}</p>
                <Button variant="ghost" onClick={media.retry}><RefreshCw className="h-4 w-4" /> Try again</Button>
              </div>
            )}
            {media.stream && !media.videoOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-ink-3 font-serif text-5xl italic">
                  {(name || user.name)[0]?.toUpperCase()}
                </span>
              </div>
            )}

            <div className="absolute left-4 top-4 label rounded-full bg-ink/70 px-3 py-1.5 backdrop-blur">Preview</div>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              <button
                onClick={media.toggleAudio}
                disabled={!media.stream}
                aria-label={media.audioOn ? 'Mute microphone' : 'Unmute microphone'}
                className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition-colors disabled:opacity-40 ${media.audioOn ? 'bg-ink/70 hover:bg-ink-3' : 'bg-danger text-ink'}`}
              >
                {media.audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                onClick={media.toggleVideo}
                disabled={!media.stream}
                aria-label={media.videoOn ? 'Turn camera off' : 'Turn camera on'}
                className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition-colors disabled:opacity-40 ${media.videoOn ? 'bg-ink/70 hover:bg-ink-3' : 'bg-danger text-ink'}`}
              >
                {media.videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Start panel */}
          <form onSubmit={start} className="flex flex-col justify-between gap-8 rounded-3xl border border-line bg-ink-2 p-8">
            <div>
              <p className="label">Ready when you are</p>
              <h2 className="mt-3 font-serif text-4xl">Who&apos;s calling?</h2>
              <p className="mt-2 text-sm text-muted">This is the only thing your partner will know about you.</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Your display name"
                aria-label="Display name"
                className="mt-6 w-full border-b border-line-strong bg-transparent pb-3 font-serif text-3xl italic text-cream placeholder:text-muted/50 focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <Button type="submit" size="lg" disabled={!name.trim() || !media.stream} className="w-full">
                Find someone <ArrowUpRight className="h-5 w-5" />
              </Button>
              <p className="label mt-4 text-center">
                {online !== null && online > 0 ? `${online} ${online === 1 ? 'person' : 'people'} connected` : 'Be the first one in'}
              </p>
            </div>
          </form>
        </section>

        {/* History */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-3xl border border-line bg-line lg:grid-cols-1">
            {[
              { k: 'Conversations', v: stats ? String(stats.totalCalls) : '–' },
              { k: 'Time talking', v: stats ? formatDuration(stats.totalSeconds) : '–' },
              { k: 'Longest chat', v: stats ? formatDuration(stats.longestSeconds) : '–' },
            ].map(({ k, v }) => (
              <div key={k} className="bg-ink-2 p-6">
                <p className="label">{k}</p>
                <p className="mt-2 font-serif text-4xl">{v}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-line bg-ink-2 p-8">
            <p className="label">Recent conversations</p>
            {!stats || stats.recent.length === 0 ? (
              <p className="mt-6 font-serif text-2xl italic text-muted">Nobody yet. Your first stranger is one click away.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {stats.recent.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3.5">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-3 font-serif text-lg italic">
                        {c.partnerName[0]?.toUpperCase()}
                      </span>
                      <span>{c.partnerName}</span>
                    </span>
                    <span className="flex items-center gap-4 font-mono text-xs text-muted">
                      <span>{formatDuration(c.durationSec)}</span>
                      <span className="w-16 text-right">{timeAgo(c.startedAt)}</span>
                    </span>
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
