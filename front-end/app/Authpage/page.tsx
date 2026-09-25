'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { AppIcon, Button, FieldRow, Group, Logo } from '@/components/ui';
import { ChatterWall } from '@/components/ChatterWall';
import { ActivityIndicator } from '@/components/Loader';
import { API_URL, api, session, User } from '@/lib/api';
import { gsap, MOTION_OK, MOTION_REDUCED, revealAll, useGSAP, whenIntroDone } from '@/lib/gsap';

type Mode = 'signin' | 'signup';

const emptyForm = { name: '', email: '', username: '', password: '' };

function SegmentedControl({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const options: { id: Mode; label: string }[] = [
    { id: 'signin', label: 'Sign In' },
    { id: 'signup', label: 'Create Account' },
  ];
  return (
    <div role="group" aria-label="Choose sign in or create account" className="relative grid grid-cols-2 rounded-[10px] bg-fill p-0.5">
      {/* Thumb slides between segments; 2px inset keeps its radius concentric (10 = 8 + 2). */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[8px] bg-white/[0.16] shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_3px_8px_rgb(0_0_0/0.35)] transition-transform duration-200 ease-[var(--ease-out)]"
        style={{ transform: value === 'signup' ? 'translateX(100%)' : 'none' }}
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`relative z-10 h-8 rounded-[8px] text-[13px] transition-[color] ${value === o.id ? 'font-semibold text-label' : 'font-medium text-label-2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px]">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ paused: true });
        tl.from('.auth-visual', { autoAlpha: 0, scale: 1.04, duration: 1.8, ease: 'power2.out' })
          .from('.auth-visual-copy > *', { autoAlpha: 0, y: 24, filter: 'blur(8px)', duration: 1.2, stagger: 0.1 }, 0.3)
          .from('.auth-back', { autoAlpha: 0, x: -12, duration: 0.8 }, 0.2)
          .from('.auth-card', { autoAlpha: 0, x: 24, filter: 'blur(10px)', duration: 1.2 }, 0.15)
          .from('.auth-card .auth-item', { autoAlpha: 0, y: 16, duration: 0.9, stagger: 0.06 }, 0.35)
          .from('.auth-foot', { autoAlpha: 0, duration: 1 }, 0.7);
        return whenIntroDone(() => tl.play());
      });
      mm.add(MOTION_REDUCED, () => revealAll(root.current));
    },
    { scope: root },
  );

  // Rows ripple in when switching between Sign In and Create Account.
  useGSAP(
    () => {
      if (firstRender.current) {
        firstRender.current = false;
        return;
      }
      if (window.matchMedia(MOTION_REDUCED).matches) return;
      gsap.from('.auth-card label', { autoAlpha: 0, y: 8, duration: 0.5, stagger: 0.04, ease: 'power3.out' });
      gsap.from('.auth-title', { autoAlpha: 0, y: 6, filter: 'blur(4px)', duration: 0.5, ease: 'power3.out' });
    },
    { scope: root, dependencies: [mode] },
  );

  useEffect(() => {
    // Returning from Google: the backend puts our token (or an error) in the fragment.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('token');
    const oauthError = hash.get('error');
    if (token || oauthError) window.history.replaceState(null, '', window.location.pathname + window.location.search);

    if (token) {
      setLoading(true);
      fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ user }: { user: User }) => {
          session.save(token, user);
          router.replace('/Dashboard');
        })
        .catch(() => {
          setError('Google sign-in failed, please try again');
          setLoading(false);
        });
      return;
    }
    if (oauthError) {
      setError(oauthError);
      return;
    }
    if (session.token() && session.user()) router.replace('/Dashboard');
  }, [router]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setForm((f) => ({ ...emptyForm, username: f.username }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = mode === 'signin' ? { username: form.username, password: form.password } : form;
      const { token, user } = await api<{ token: string; user: User }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      session.save(token, user);
      router.push('/Dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  };

  const signup = mode === 'signup';

  return (
    <div ref={root} className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <div className="wallpaper" />

      {/* ── Visual side: the same live wall as the home page ── */}
      <aside
        data-reveal
        className="auth-visual relative isolate flex h-[38svh] min-h-64 flex-col justify-between overflow-hidden border-b border-separator p-5 sm:p-8 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r lg:p-12"
      >
        <ChatterWall vignette="bottom" />
        <Logo />
        <div className="auth-visual-copy max-w-md">
          <p className="inline-flex items-center gap-2 text-[13px] font-medium text-label-2">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" /> Live conversations, right now
          </p>
          <p className="large-title text-silver mt-3 text-[clamp(1.75rem,3.6vw,3.25rem)]">
            Somebody’s waiting to say hi.
          </p>
          <p className="mt-3 hidden text-pretty text-[17px] leading-relaxed text-label-2 sm:block">
            One-on-one video with someone new. Peer to peer, and gone the moment you tap Next.
          </p>
        </div>
      </aside>

      {/* ── Form side ── */}
      <div className="flex flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-10 lg:px-16 lg:py-10">
        <div data-reveal className="auth-back self-start">
          <button
            onClick={() => router.push('/')}
            className="pressable inline-flex h-11 items-center gap-0.5 rounded-full pe-3 text-[17px] text-tint"
          >
            <ChevronLeft className="h-6 w-6" /> Home
          </button>
        </div>

        <main data-reveal className="auth-card my-auto w-full max-w-[400px] py-6 lg:py-8">
          <div className="auth-item">
            <span className="hidden lg:block"><AppIcon size={52} /></span>
            <h1 className="auth-title large-title text-silver lg:mt-6 text-[clamp(1.875rem,3vw,2.25rem)]">{signup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="mt-2 text-[15px] text-label-2">
              {signup ? 'It takes less than a minute.' : 'Sign in with your username or email.'}
            </p>
          </div>

          <div className="auth-item mt-8">
            <SegmentedControl value={mode} onChange={switchMode} />
          </div>

          <form onSubmit={onSubmit} className="mt-5">
            <Group className="auth-item">
              {signup && (
                <>
                  <FieldRow label="Name" name="name" value={form.name} onChange={onChange} autoComplete="name" required minLength={2} placeholder="Ada Lovelace" aria-invalid={!!error || undefined} />
                  <FieldRow label="Email" name="email" type="email" inputMode="email" value={form.email} onChange={onChange} autoComplete="email" required placeholder="ada@example.com" aria-invalid={!!error || undefined} />
                </>
              )}
              <FieldRow
                label={signup ? 'Username' : 'Account'}
                name="username"
                value={form.username}
                onChange={onChange}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={3}
                placeholder={signup ? 'ada_l' : 'Username or email'}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? 'auth-error' : undefined}
              />
              <FieldRow
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={onChange}
                autoComplete={signup ? 'new-password' : 'current-password'}
                required
                minLength={6}
                placeholder={signup ? 'At least 6 characters' : 'Required'}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? 'auth-error' : undefined}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label-3 hover:text-label-2"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                }
              />
            </Group>

            {signup && <p className="mt-2 px-4 text-[13px] text-label-3">Usernames can use letters, numbers, _ and .</p>}

            <p
              id="auth-error"
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className={`px-4 text-[13px] text-red focus:outline-none ${error ? 'mt-3' : ''}`}
            >
              {error}
            </p>

            <div className="auth-item mt-6">
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading && <ActivityIndicator size={18} label="Signing in" />}
                {signup ? 'Create Account' : 'Sign In'}
              </Button>
            </div>
          </form>

          <div className="auth-item mt-6 flex items-center gap-3 text-[13px] text-label-3" aria-hidden="true">
            <span className="h-px flex-1 bg-separator" /> or <span className="h-px flex-1 bg-separator" />
          </div>

          <div className="auth-item mt-6">
            <Button
              type="button"
              variant="gray"
              size="lg"
              disabled={loading}
              className="w-full"
              onClick={() => {
                setLoading(true);
                window.location.href = `${API_URL}/auth/google`;
              }}
            >
              <GoogleIcon /> Continue with Google
            </Button>
          </div>
        </main>

        <p data-reveal className="auth-foot text-[13px] text-label-3">
          By continuing you agree to be kind to strangers.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
