'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  createdAt?: string;
}

export interface ChatPrefs {
  name: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const CHAT_KEY = 'chatData';

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const session = {
  token: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  user: () => (typeof window === 'undefined' ? null : readJSON<User>(USER_KEY)),
  save(token: string, user: User) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(CHAT_KEY);
  },
  chatPrefs: () => (typeof window === 'undefined' ? null : readJSON<ChatPrefs>(CHAT_KEY)),
  saveChatPrefs: (prefs: ChatPrefs) => localStorage.setItem(CHAT_KEY, JSON.stringify(prefs)),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = session.token();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = Array.isArray(data.error) ? data.error[0] : data.error;
    throw new ApiError(err || 'Something went wrong', res.status);
  }
  return data as T;
}

/**
 * Returns the signed-in user, redirecting to the auth page when there is no
 * valid session. The cached user renders immediately; /auth/me refreshes it.
 */
export function useSession() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const cached = session.user();
    if (!session.token() || !cached) {
      router.replace('/Authpage');
      return;
    }
    setUser(cached);

    api<{ user: User }>('/auth/me')
      .then(({ user }) => {
        session.save(session.token()!, user);
        setUser(user);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          session.clear();
          router.replace('/Authpage');
        }
      });
  }, [router]);

  const logout = () => {
    session.clear();
    router.replace('/');
  };

  return { user, logout };
}

/** Live count of people connected to the matchmaking server. */
export function useOnlineCount(pollMs = 15000) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${API_URL}/stats`)
        .then((r) => r.json())
        .then((d) => alive && setCount(d.online))
        .catch(() => {});
    load();
    const id = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);
  return count;
}

export function formatDuration(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}
