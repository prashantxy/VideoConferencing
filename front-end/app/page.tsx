'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Lock, MessageCircle, Mic, PhoneOff, Shuffle, Video } from 'lucide-react';
import { AppIcon, Avatar, Button, IconTile, NavBar, OnlinePill } from '@/components/ui';
import { session, useOnlineCount } from '@/lib/api';

const features = [
  {
    icon: Shuffle,
    tile: 'bg-gradient-to-b from-[#ff9f0a] to-[#ff6a00]',
    title: 'Someone new, every time',
    body: 'Tap Next whenever you like. Your partner goes straight back in line.',
  },
  {
    icon: Lock,
    tile: 'bg-gradient-to-b from-[#30d158] to-[#0c9f6f]',
    title: 'Peer to peer',
    body: 'Video goes directly between your browsers over WebRTC. Our server only makes the introduction.',
  },
  {
    icon: MessageCircle,
    tile: 'bg-gradient-to-b from-[#64d2ff] to-[#0a84ff]',
    title: 'Messages on the side',
    body: 'Share a link, spell a name, or keep talking with your mic off.',
  },
];

export default function HomePage() {
  const router = useRouter();
  const online = useOnlineCount();

  useEffect(() => {
    if (session.token() && session.user()) router.replace('/Dashboard');
  }, [router]);

  return (
    <div className="min-h-dvh pb-10">
      <div className="wallpaper" />
      <NavBar>
        <OnlinePill count={online} className="hidden sm:inline-flex" />
        <Button size="sm" variant="gray" onClick={() => router.push('/Authpage')}>Sign in</Button>
      </NavBar>

      <main className="mx-auto max-w-6xl px-4">
        <section className="flex flex-col items-center pt-20 text-center md:pt-28">
          <div className="materialize"><AppIcon size={88} /></div>
          <h1 className="large-title materialize mt-8 max-w-3xl text-[clamp(2.75rem,7vw,5rem)]" style={{ '--delay': '80ms' } as React.CSSProperties}>
            Meet someone new.<br />
            <span className="bg-gradient-to-r from-[#0a84ff] via-[#5e5ce6] to-[#bf5af2] bg-clip-text text-transparent">Face to face.</span>
          </h1>
          <p className="materialize mt-6 max-w-xl text-pretty text-[19px] leading-relaxed text-label-2" style={{ '--delay': '160ms' } as React.CSSProperties}>
            One tap starts a one-on-one video chat with someone, somewhere in the world. No feeds, no followers, just a conversation.
          </p>
          <div className="materialize mt-9 flex flex-wrap justify-center gap-3" style={{ '--delay': '240ms' } as React.CSSProperties}>
            <Button size="lg" onClick={() => router.push('/Authpage?mode=signup')}>Get started</Button>
            <Button size="lg" variant="gray" onClick={() => router.push('/Authpage')} className="ps-7 pe-5">
              I have an account <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </section>

        {/* Product preview: a call window rendered in the same materials as the real one. */}
        <section aria-hidden="true" className="materialize mx-auto mt-16 max-w-4xl md:mt-20" style={{ '--delay': '320ms' } as React.CSSProperties}>
          <div className="glass-thick rounded-[36px] p-3">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1d2b64] via-[#3a2a6b] to-[#0f3d3e]">
              <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_40%_40%,rgb(255_255_255/0.14),transparent_70%)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Avatar name="Maya" size={120} className="shadow-2xl" />
              </div>
              <div className="theme-dark absolute left-4 top-4 flex items-center gap-2 rounded-full glass-chip px-3.5 py-1.5 text-[13px] font-medium text-label">
                <span className="h-2 w-2 rounded-full bg-green" /> Maya <span className="tabular text-label-2">04:12</span>
              </div>
              <div className="absolute bottom-4 right-4 aspect-[3/4] w-[18%] overflow-hidden rounded-[14px] bg-gradient-to-b from-[#ff9f0a] to-[#ff375f] shadow-xl ring-1 ring-white/20" />
              <div className="theme-dark absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full glass-chip p-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill text-label"><Mic className="h-[18px] w-[18px]" /></span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill text-label"><Video className="h-[18px] w-[18px]" /></span>
                <span className="flex h-10 items-center rounded-full bg-tint px-5 text-[15px] font-semibold text-white">Next</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red text-white"><PhoneOff className="h-[18px] w-[18px]" /></span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-24 grid max-w-5xl gap-4 md:grid-cols-3">
          {features.map(({ icon, tile, title, body }) => (
            <article key={title} className="glass rounded-[28px] p-7">
              <IconTile icon={icon} className={tile} />
              <h2 className="mt-5 text-[19px] font-semibold tracking-[-0.01em]">{title}</h2>
              <p className="mt-2 text-pretty text-[15px] leading-relaxed text-label-2">{body}</p>
            </article>
          ))}
        </section>

        <section className="glass mx-auto mt-4 flex max-w-5xl flex-col items-center gap-6 rounded-[28px] px-8 py-12 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <h2 className="large-title text-[32px]">Somebody’s waiting to say hi.</h2>
            <p className="mt-2 text-[15px] text-label-2">Free to use. Your camera never turns on until you say so.</p>
          </div>
          <Button size="lg" onClick={() => router.push('/Authpage?mode=signup')}>Create account</Button>
        </section>
      </main>

      <footer className="mx-auto mt-12 max-w-5xl px-4 text-center text-[13px] text-label-3">
        Be kind. There’s a real person on the other side.
      </footer>
    </div>
  );
}
