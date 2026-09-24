'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { AppIcon, Button, FieldRow, Group, Spinner } from '@/components/ui';
import { api, session, User } from '@/lib/api';

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
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[8px] bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-200 ease-[var(--ease-out)] dark:bg-[#636366]"
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

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
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
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="wallpaper" />

      <div className="w-full max-w-[420px]">
        <button
          onClick={() => router.push('/')}
          className="pressable mb-4 inline-flex h-11 items-center gap-0.5 rounded-full pe-3 text-[17px] text-tint"
        >
          <ChevronLeft className="h-6 w-6" /> Home
        </button>

        <main className="glass-thick materialize rounded-[32px] p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <AppIcon size={64} />
            <h1 className="large-title mt-5 text-[28px]">{signup ? 'Create your account' : 'Sign in to VideoMeet'}</h1>
            <p className="mt-1.5 text-[15px] text-label-2">
              {signup ? 'It takes less than a minute.' : 'Use your username or email.'}
            </p>
          </div>

          <div className="mt-7">
            <SegmentedControl value={mode} onChange={switchMode} />
          </div>

          <form onSubmit={onSubmit} className="mt-5">
            <Group>
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

            <Button type="submit" size="lg" disabled={loading} className="mt-6 w-full">
              {loading && <Spinner />}
              {signup ? 'Create Account' : 'Sign In'}
            </Button>
          </form>
        </main>

        <p className="mt-6 text-center text-[13px] text-label-3">
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
