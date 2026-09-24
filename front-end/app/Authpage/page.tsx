'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button, Field, Logo, Spinner } from '@/components/ui';
import { api, session, User } from '@/lib/api';

type Mode = 'signin' | 'signup';

const emptyForm = { name: '', email: '', username: '', password: '' };

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session.token() && session.user()) router.replace('/Dashboard');
  }, [router]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError('');
    setForm(emptyForm);
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
    }
  };

  const signup = mode === 'signup';

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r border-line bg-ink-2 p-10 md:flex md:flex-col md:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,91,46,0.28),transparent_55%)]" />
        <Logo className="relative" />
        <blockquote className="relative">
          <p className="font-serif text-5xl leading-[1.05] lg:text-6xl">
            “We talked for an hour about <em className="text-signal">bread.</em> Best conversation of my week.”
          </p>
          <footer className="label mt-6">— someone, somewhere</footer>
        </blockquote>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          <button onClick={() => router.push('/')} className="label mb-12 inline-flex items-center gap-2 hover:text-cream">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>

          <h1 className="font-serif text-5xl">
            {signup ? <>Pull up a <em className="text-signal">chair.</em></> : <>Welcome <em className="text-signal">back.</em></>}
          </h1>
          <p className="mt-3 text-muted">
            {signup ? 'Create an account to start meeting people.' : 'Sign in with your username or email.'}
          </p>

          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            {signup && (
              <>
                <Field label="Full name" name="name" value={form.name} onChange={onChange} autoComplete="name" required minLength={2} placeholder="Ada Lovelace" />
                <Field label="Email" name="email" type="email" value={form.email} onChange={onChange} autoComplete="email" required placeholder="ada@example.com" />
              </>
            )}
            <Field
              label={signup ? 'Username' : 'Username or email'}
              name="username"
              value={form.username}
              onChange={onChange}
              autoComplete="username"
              required
              minLength={3}
              placeholder="ada_l"
              hint={signup ? 'Letters, numbers, _ and . only' : undefined}
            />
            <div className="relative">
              <Field
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={onChange}
                autoComplete={signup ? 'new-password' : 'current-password'}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-[2.1rem] p-1.5 text-muted hover:text-cream"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading && <Spinner />}
              {signup ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-sm text-muted">
            {signup ? 'Already have an account?' : 'New here?'}{' '}
            <button onClick={switchMode} className="text-cream underline decoration-signal underline-offset-4 hover:text-signal">
              {signup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </main>
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
