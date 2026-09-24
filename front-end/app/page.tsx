'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Lock, Shuffle, MessageSquare } from 'lucide-react';
import { Button, Logo, OnlinePill } from '@/components/ui';
import { session, useOnlineCount } from '@/lib/api';

const steps = [
  { n: '01', title: 'Check your light', body: 'Preview your camera, pick the name people will see, mute whatever you like.' },
  { n: '02', title: 'Get matched', body: 'We pair you with whoever is waiting. Usually in a second or two.' },
  { n: '03', title: 'Talk, or skip', body: 'Video, audio and a text side-channel. Press Esc to meet someone new.' },
];

const notes = [
  { icon: Lock, title: 'Peer to peer', body: 'Video flows directly between browsers over WebRTC. The server only makes the introduction.' },
  { icon: Shuffle, title: 'Always someone new', body: 'Skip at any time. Your partner is put straight back in line, no hard feelings.' },
  { icon: MessageSquare, title: 'Chat on the side', body: 'Share a link, spell a name, or just type when the mic is off.' },
];

export default function HomePage() {
  const router = useRouter();
  const online = useOnlineCount();

  useEffect(() => {
    if (session.token() && session.user()) router.replace('/Dashboard');
  }, [router]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex"><OnlinePill count={online} /></span>
          <Button variant="ghost" onClick={() => router.push('/Authpage')}>Sign in</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="grid items-end gap-12 pb-20 pt-12 md:grid-cols-[1.4fr_1fr] md:pt-24">
          <div className="rise">
            <p className="label mb-6">Random video conversations · peer to peer</p>
            <h1 className="font-serif text-[clamp(3.5rem,11vw,9rem)] leading-[0.88] tracking-tight">
              Say hello<br />
              to a <em className="text-signal">stranger.</em>
            </h1>
            <p className="mt-8 max-w-md text-lg leading-relaxed text-muted">
              One click puts you face to face with someone new, somewhere in the world.
              No feeds, no followers. Just a conversation.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => router.push('/Authpage?mode=signup')}>
                Start talking <ArrowUpRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="ghost" onClick={() => router.push('/Authpage')}>
                I have an account
              </Button>
            </div>
          </div>

          {/* A faux call window to set the mood. */}
          <div className="rise relative hidden aspect-[4/5] overflow-hidden rounded-[2rem] border border-line bg-ink-2 md:block" style={{ animationDelay: '150ms' }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,91,46,0.35),transparent_55%),radial-gradient(circle_at_80%_90%,rgba(182,243,106,0.12),transparent_50%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <span className="ring absolute inset-0 rounded-full border border-signal/60" />
                <span className="ring absolute inset-0 rounded-full border border-signal/60" style={{ animationDelay: '1.2s' }} />
                <span className="font-serif text-5xl italic">?</span>
              </div>
            </div>
            <div className="absolute left-5 top-5 label">● live</div>
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
              <div>
                <p className="label">Up next</p>
                <p className="font-serif text-3xl italic">someone new</p>
              </div>
              <div className="h-24 w-20 rounded-xl border border-line-strong bg-ink-3" />
            </div>
          </div>
        </section>

        <section className="border-t border-line py-20">
          <p className="label mb-10">How it works</p>
          <div className="grid gap-10 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <p className="font-mono text-sm text-signal">{s.n}</p>
                <h3 className="mt-3 font-serif text-3xl">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-3">
          {notes.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-ink p-8">
              <Icon className="h-5 w-5 text-signal" />
              <h3 className="mt-6 text-lg font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </section>

        <section className="py-28 text-center">
          <h2 className="font-serif text-5xl md:text-7xl">
            Somebody is <em className="text-signal">waiting.</em>
          </h2>
          <Button size="lg" className="mt-10" onClick={() => router.push('/Authpage?mode=signup')}>
            Create a free account
          </Button>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-8">
        <Logo />
        <p className="label">Be kind. Everyone on the other side is a person.</p>
      </footer>
    </div>
  );
}
