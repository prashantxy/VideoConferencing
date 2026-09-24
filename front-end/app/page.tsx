'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Lock, MessageCircle, Mic, PhoneOff, Shuffle, Video, VideoOff } from 'lucide-react';
import { Avatar, Button, IconTile, Logo, NavBar, OnlinePill, SectionHeader } from '@/components/ui';
import { session, useOnlineCount } from '@/lib/api';
import { gsap, MOTION_OK, MOTION_REDUCED, revealAll, ScrollTrigger, SplitText, useGSAP, whenIntroDone } from '@/lib/gsap';
import { ChatterWall } from '@/components/ChatterWall';

const steps = [
  { n: '01', title: 'Check your camera', body: 'Preview yourself, choose the name your partner sees, and mute anything you like.' },
  { n: '02', title: 'Get matched', body: 'We pair you with the next person who’s waiting. It usually takes a second or two.' },
  { n: '03', title: 'Talk, or tap Next', body: 'Stay as long as the conversation is good. When it isn’t, someone new is one tap away.' },
];

/** A still frame of the call screen, drawn with the same materials as the real one. */
function CallPreview() {
  return (
    <div aria-hidden="true" className="glass-thick rounded-[36px] p-2.5">
      <div className="relative aspect-[16/9] overflow-hidden rounded-[26px] bg-[#111113]">
        <div className="absolute inset-0 bg-[radial-gradient(55%_75%_at_42%_38%,rgb(217_199_167/0.22),transparent_70%),radial-gradient(40%_60%_at_85%_80%,rgb(96_116_156/0.18),transparent_70%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar name="Maya" size={128} className="shadow-[0_24px_60px_-12px_rgb(0_0_0/0.8)]" />
        </div>
        <div className="glass-chip absolute left-4 top-4 flex items-center gap-2 rounded-full py-1.5 ps-1.5 pe-3.5 text-[13px] font-medium">
          <Avatar name="Maya" size={24} />
          Maya
          <span className="tabular flex items-center gap-1.5 text-label-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green" /> 04:12
          </span>
        </div>
        <div className="absolute bottom-4 right-4 aspect-[3/4] w-[17%] overflow-hidden rounded-[14px] bg-gradient-to-b from-[#3a3a3d] to-[#18181a] shadow-2xl outline outline-1 -outline-offset-1 outline-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_40%,rgb(217_199_167/0.2),transparent_70%)]" />
        </div>
        <div className="glass-chip absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full p-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill"><Mic className="h-[18px] w-[18px]" /></span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill"><Video className="h-[18px] w-[18px]" /></span>
          <span className="flex h-10 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent">Next</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red text-white"><PhoneOff className="h-[18px] w-[18px]" /></span>
        </div>
      </div>
    </div>
  );
}

const cities = [
  { name: 'Tokyo', tz: 'Asia/Tokyo' },
  { name: 'Lisbon', tz: 'Europe/Lisbon' },
  { name: 'Lagos', tz: 'Africa/Lagos' },
  { name: 'São Paulo', tz: 'America/Sao_Paulo' },
  { name: 'Seoul', tz: 'Asia/Seoul' },
  { name: 'Mumbai', tz: 'Asia/Kolkata' },
  { name: 'Berlin', tz: 'Europe/Berlin' },
  { name: 'Mexico City', tz: 'America/Mexico_City' },
];

const greetings = [
  'Hello', 'Hola', 'こんにちは', 'Bonjour', 'Olá', 'नमस्ते', 'Ciao', '안녕하세요', 'Hallo', 'Merhaba', 'Привет', 'مرحبا', 'Sawubona', '你好', 'Hej', 'Kia ora',
];

const manifesto =
  'No profiles. No feeds. No followers to perform for. Just two people, a camera each, and whatever you feel like talking about, for as long as it’s good.';

function localTime(tz: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date());
}

/** "It's 2:14 AM in Tokyo": the real local time of the city on screen. */
function CityClock({ index }: { index: number }) {
  const [time, setTime] = React.useState<string | null>(null);
  const city = cities[index];
  useEffect(() => {
    const tick = () => setTime(localTime(city.tz));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [city.tz]);
  return (
    <span className="tabular inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-label-2 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" />
      {time ? <>It’s {time} in {city.name}</> : 'Live now'}
    </span>
  );
}

/** Two rows of greetings that drift, and speed up or reverse with your scroll. */
function GreetingBand() {
  const row = (reverse: boolean) => (
    <div className={`greet-row flex w-max ${reverse ? 'greet-rev' : ''}`}>
      {[0, 1].map((copy) => (
        <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
          {(reverse ? [...greetings].reverse() : greetings).map((g) => (
            <span key={g} className="flex items-center whitespace-nowrap">
              <span className={`px-6 text-[clamp(2.5rem,7vw,5.5rem)] font-semibold tracking-[-0.03em] sm:px-10 ${reverse ? 'text-label-3' : 'text-silver'}`}>{g}</span>
              <span className="h-2 w-2 rounded-full bg-champagne/50" />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <section aria-label="Hello in many languages" className="greet overflow-hidden border-t border-separator py-16 sm:py-20 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      {row(false)}
      <div className="mt-2 sm:mt-4">{row(true)}</div>
    </section>
  );
}

function Tile({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <article data-reveal className={`glass relative flex flex-col overflow-hidden rounded-[28px] p-6 sm:rounded-[32px] sm:p-8 ${className}`}>{children}</article>;
}

export default function HomePage() {
  const router = useRouter();
  const online = useOnlineCount();
  const root = useRef<HTMLDivElement>(null);
  const [cityIndex, setCityIndex] = React.useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        // Hero: words rise out of a mask as the intro curtain lifts.
        gsap.set('.hero-title', { autoAlpha: 1 });
        const slot = document.querySelector<HTMLElement>('.city-slot')!;
        const words = gsap.utils.toArray<HTMLElement>('.city-word');
        const widths = () => words.map((w) => w.offsetWidth);
        gsap.set(words, { y: 0, yPercent: (i: number) => (i === 0 ? 0 : 115) });
        gsap.set(slot, { width: widths()[0] });
        const split = SplitText.create('.hero-line', { type: 'words', mask: 'words', wordsClass: 'text-silver' });
        const hero = gsap.timeline({ paused: true });
        hero
          .from('.hero-wall', { autoAlpha: 0, scale: 1.08, duration: 2.4, ease: 'power2.out' }, 0)
          .from('.hero-eyebrow', { autoAlpha: 0, y: 12, duration: 0.8 }, 0.1)
          .from(split.words, { yPercent: 115, duration: 1.3, stagger: 0.07 }, 0.15)
          .from(words[0], { yPercent: 115, duration: 1.3 }, 0.45)
          .from('.hero-sub', { autoAlpha: 0, y: 18, filter: 'blur(8px)', duration: 1.1 }, 0.65)
          .from('.hero-cta', { autoAlpha: 0, y: 18, duration: 1, stagger: 0.08 }, 0.8)
          .from('.hero-cue', { autoAlpha: 0, duration: 1 }, 1.3);
        const cancel = whenIntroDone(() => hero.play());

        // The city rolls over every few seconds; the slot resizes to fit each name.
        let current = 0;
        const roll = gsap.timeline({ repeat: -1, delay: 3.2 });
        words.forEach((_, i) => {
          const next = (i + 1) % words.length;
          roll
            .to(words[i], { yPercent: -115, duration: 0.8, ease: 'expo.inOut' }, '+=2.4')
            .fromTo(words[next], { yPercent: 115 }, { yPercent: 0, duration: 0.8, ease: 'expo.inOut' }, '<')
            .to(slot, { width: () => widths()[next], duration: 0.8, ease: 'expo.inOut' }, '<')
            .call(() => { current = next; setCityIndex(current); }, [], '<0.4');
        });

        // Hero content drifts up and fades as you scroll past it.
        gsap.to('.hero-content', {
          yPercent: -18,
          autoAlpha: 0.2,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });

        // Showcase: the call screen settles into place, scrubbed to scroll.
        gsap.fromTo(
          '.showcase-frame',
          { scale: 0.84, yPercent: 10, rotateX: 14, autoAlpha: 0.3 },
          {
            scale: 1, yPercent: 0, rotateX: 0, autoAlpha: 1, ease: 'none',
            scrollTrigger: { trigger: '.showcase', start: 'top 90%', end: 'center 60%', scrub: 0.8 },
          },
        );

        // Every other section: its pieces stagger in once, as it enters.
        gsap.utils.toArray<HTMLElement>('.reveal-group').forEach((group) => {
          gsap.from(group.querySelectorAll('[data-reveal]'), {
            autoAlpha: 0, y: 48, filter: 'blur(8px)', duration: 1.2, stagger: 0.1,
            scrollTrigger: { trigger: group, start: 'top 82%', once: true },
          });
        });

        // A packet of light travelling peer to peer.
        gsap.fromTo('.p2p-dot', { left: '0%' }, { left: '100%', duration: 2.2, ease: 'power1.inOut', repeat: -1, repeatDelay: 0.6 });

        // Manifesto: pinned while each word lights up with the scroll.
        const statement = SplitText.create('.manifesto-text', { type: 'words' });
        gsap.fromTo(statement.words, { opacity: 0.12 }, {
          opacity: 1, stagger: 0.1, ease: 'none',
          scrollTrigger: { trigger: '.manifesto', start: 'top top', end: '+=140%', pin: true, scrub: 0.5 },
        });

        // Greetings drift; scrolling pushes them faster, in the direction you scroll.
        const rows = gsap.utils.toArray<HTMLElement>('.greet-row').map((r) =>
          gsap.fromTo(r, { xPercent: r.classList.contains('greet-rev') ? -50 : 0 }, {
            xPercent: r.classList.contains('greet-rev') ? 0 : -50, duration: 40, ease: 'none', repeat: -1,
          }),
        );
        ScrollTrigger.create({
          trigger: '.greet',
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            const boost = gsap.utils.clamp(-8, 8, self.getVelocity() / 250);
            rows.forEach((t) => {
              gsap.to(t, { timeScale: self.direction * (1 + Math.abs(boost)), duration: 0.2, overwrite: true });
              gsap.to(t, { timeScale: self.direction, duration: 1.2, delay: 0.2, ease: 'power2.out' });
            });
          },
        });

        return () => {
          cancel();
          split.revert();
          statement.revert();
        };
      });

      mm.add(MOTION_REDUCED, () => revealAll(root.current));
    },
    { scope: root },
  );

  useEffect(() => {
    if (session.token() && session.user()) router.replace('/Dashboard');
  }, [router]);

  return (
    <div ref={root} className="min-h-dvh overflow-x-clip">
      <div className="wallpaper" />
      <NavBar>
        <OnlinePill count={online} className="hidden sm:inline-flex" />
        <Button size="sm" variant="gray" onClick={() => router.push('/Authpage')}>Sign in</Button>
      </NavBar>

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="hero relative isolate flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden">
          <div className="hero-wall absolute inset-0 -z-10"><ChatterWall /></div>
          <div className="hero-content mx-auto w-full max-w-[1120px] px-5 py-24 text-center">
            <p data-reveal className="hero-eyebrow">
              <CityClock index={cityIndex} />
            </p>
            <h1 data-reveal className="hero-title large-title mx-auto mt-7 max-w-5xl text-[clamp(3rem,13vw,6.5rem)] leading-[1.02] sm:text-[clamp(3rem,9vw,6.5rem)]">
              <span className="hero-line block">Say hello to</span>
              <span className="block">
                <span className="hero-line">someone in</span>{' '}
                {/* On phones the city gets its own line so long names still fit. */}
                <span className="block sm:inline">
                {/* Rolling city: every name is stacked in one masked slot. */}
                <span className="city-slot relative inline-block overflow-hidden pb-[0.14em] align-top">
                  <span className="invisible" aria-hidden="true">{cities[0].name}.</span>
                  {cities.map((c, i) => (
                    <span key={c.name} aria-hidden={i !== cityIndex} className="city-word text-titanium absolute left-0 top-0 whitespace-nowrap">
                      {c.name}.
                    </span>
                  ))}
                </span>
                </span>
              </span>
            </h1>
            <p data-reveal className="hero-sub mx-auto mt-7 max-w-md text-pretty text-[clamp(1.0625rem,2vw,1.25rem)] leading-snug text-label-2">
              Random one-on-one video, anywhere in the world. Tap Next whenever you like.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-7">
              {/* Animate a wrapper: the button's own press transition would fight GSAP. */}
              <div data-reveal className="hero-cta w-full max-w-xs sm:w-auto">
                <Button size="lg" className="w-full" onClick={() => router.push('/Authpage?mode=signup')}>Get started</Button>
              </div>
              <Link data-reveal href="/Authpage" className="hero-cta group inline-flex h-11 items-center gap-0.5 text-[17px] text-tint hover:underline">
                Sign in <ChevronRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
          <div data-reveal aria-hidden="true" className="hero-cue absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-label-3">
            Scroll
            <span className="h-8 w-px bg-gradient-to-b from-label-3 to-transparent" />
          </div>
        </section>

        {/* ── Manifesto (pinned, scrubbed) ─────────────────── */}
        <section aria-label="What VideoMeet is" className="manifesto flex min-h-svh items-center border-t border-separator">
          <div className="mx-auto max-w-[1120px] px-5 py-24">
            <p className="eyebrow">What this is</p>
            <p className="manifesto-text large-title mt-6 max-w-4xl text-[clamp(1.875rem,5vw,3.75rem)] leading-[1.12]">{manifesto}</p>
          </div>
        </section>

        {/* ── Showcase ─────────────────────────────────────── */}
        <section aria-labelledby="showcase" className="showcase py-24 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-5">
            <div className="reveal-group">
              <div data-reveal>
                <SectionHeader
                  eyebrow="The call screen"
                  title={<span id="showcase">Everything you need.<br className="hidden sm:block" /> Nothing in the way.</span>}
                  intro="Their face fills the screen. Your controls float out of the way. Flick your own video into any corner."
                />
              </div>
            </div>
            <div className="relative mx-auto mt-14 max-w-4xl [perspective:1400px] sm:mt-16">
              <div className="spotlight absolute -inset-x-24 -inset-y-16 -z-10" />
              <div className="showcase-frame [transform-origin:50%_100%]"><CallPreview /></div>
            </div>
          </div>
        </section>

        <GreetingBand />

        {/* ── Features (bento) ─────────────────────────────── */}
        <section aria-labelledby="features" className="border-t border-separator bg-surface/60 py-24 sm:py-28">
          <div className="reveal-group mx-auto max-w-[1120px] px-5">
            <div data-reveal>
              <SectionHeader
                eyebrow="Why it feels different"
                title={<span id="features">Built for the conversation.<br className="hidden sm:block" /> Nothing else.</span>}
              />
            </div>
            <div className="mt-14 grid gap-4 sm:mt-16 md:grid-cols-3">
              <Tile className="md:col-span-2">
                <IconTile icon={Lock} />
                <h3 className="mt-6 text-[24px] font-semibold tracking-[-0.02em]">Peer to peer, end to end.</h3>
                <p className="mt-2 max-w-md text-pretty text-[17px] leading-relaxed text-label-2">
                  Video travels directly between your browsers, encrypted by WebRTC. Our server makes the introduction, then steps away.
                </p>
                <div aria-hidden="true" className="mt-10 flex items-center gap-3 sm:gap-4">
                  <Avatar name="You" size={52} />
                  <span className="relative h-px flex-1 bg-gradient-to-r from-transparent via-champagne/40 to-champagne/40">
                    <span className="p2p-dot absolute top-1/2 h-1.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-champagne blur-[1px]" />
                  </span>
                  <span className="glass-chip shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium text-label-2">DTLS-SRTP</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-champagne/40 via-champagne/40 to-transparent" />
                  <Avatar name="Maya" size={52} />
                </div>
              </Tile>

              <Tile>
                <IconTile icon={Shuffle} />
                <h3 className="mt-6 text-[24px] font-semibold tracking-[-0.02em]">Next, whenever.</h3>
                <p className="mt-2 text-pretty text-[17px] leading-relaxed text-label-2">One key moves you on. Your partner goes straight back in line.</p>
                <kbd aria-hidden="true" className="mt-auto self-start rounded-[12px] bg-fill px-4 pb-2 pt-6 font-sans text-[15px] text-label-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-2px_0_rgb(0_0_0/0.4)]">
                  esc
                </kbd>
              </Tile>

              <Tile>
                <IconTile icon={VideoOff} />
                <h3 className="mt-6 text-[24px] font-semibold tracking-[-0.02em]">Your camera, your call.</h3>
                <p className="mt-2 text-pretty text-[17px] leading-relaxed text-label-2">Preview first. Mute or turn your camera off any time. Your partner sees it change.</p>
              </Tile>

              <Tile className="md:col-span-2">
                <IconTile icon={MessageCircle} />
                <h3 className="mt-6 text-[24px] font-semibold tracking-[-0.02em]">Messages on the side.</h3>
                <p className="mt-2 max-w-md text-pretty text-[17px] leading-relaxed text-label-2">Share a link, spell a name, or keep talking with your mic off.</p>
                <div aria-hidden="true" className="mt-8 flex max-w-md flex-col gap-1.5 text-[15px]">
                  <span className="self-start rounded-[18px] rounded-bl-[6px] bg-fill px-3.5 py-2">Where are you calling from?</span>
                  <span className="self-end rounded-[18px] rounded-br-[6px] bg-accent px-3.5 py-2 text-on-accent">Lisbon! You?</span>
                </div>
              </Tile>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section aria-labelledby="how" className="border-t border-separator py-24 sm:py-28">
          <div className="reveal-group mx-auto max-w-[1120px] px-5">
            <div data-reveal>
              <SectionHeader eyebrow="How it works" title={<span id="how">Three steps. About ten seconds.</span>} />
            </div>
            <ol className="mt-14 grid gap-10 sm:mt-16 md:grid-cols-3 md:gap-8">
              {steps.map((s) => (
                <li data-reveal key={s.n} className="border-t border-separator pt-6">
                  <p className="tabular text-[15px] font-semibold text-champagne">{s.n}</p>
                  <h3 className="mt-3 text-[21px] font-semibold tracking-[-0.015em]">{s.title}</h3>
                  <p className="mt-2 text-pretty text-[17px] leading-relaxed text-label-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Closing call to action ───────────────────────── */}
        <section className="relative isolate overflow-hidden border-t border-separator py-28 sm:py-32">
          <div className="spotlight absolute left-1/2 top-1/2 -z-10 h-[420px] w-[min(720px,100%)] -translate-x-1/2 -translate-y-1/2" />
          <div className="reveal-group mx-auto max-w-[1120px] px-5 text-center">
            <h2 data-reveal className="large-title text-silver text-[clamp(2.25rem,6vw,4rem)]">Somebody’s waiting<br />to say hi.</h2>
            <p data-reveal className="mt-4 text-[17px] text-label-2">Free to use. Your camera stays off until you say so.</p>
            <div data-reveal className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={() => router.push('/Authpage?mode=signup')}>Create your account</Button>
              <OnlinePill count={online} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-separator">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 pb-[max(3rem,env(safe-area-inset-bottom))] sm:grid-cols-[1fr_auto]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-label-3">
              Random one-on-one video chat, peer to peer. Be kind: there’s a real person on the other side.
            </p>
          </div>
          <nav aria-label="Footer" className="flex gap-12 text-[13px]">
            <div className="flex flex-col gap-2.5">
              <p className="font-semibold text-label">Account</p>
              <Link href="/Authpage" className="text-label-2 hover:text-label">Sign in</Link>
              <Link href="/Authpage?mode=signup" className="text-label-2 hover:text-label">Create account</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="font-semibold text-label">Chat</p>
              <Link href="/Dashboard" className="text-label-2 hover:text-label">Dashboard</Link>
              <Link href="/Room" className="text-label-2 hover:text-label">Start a call</Link>
            </div>
          </nav>
        </div>
        <div className="mx-auto max-w-[1120px] border-t border-separator px-5 py-5 text-[12px] text-label-3">
          © {new Date().getFullYear()} VideoMeet. Built on WebRTC.
        </div>
      </footer>
    </div>
  );
}
