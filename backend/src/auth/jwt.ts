import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../prisma';

// The session JWT lives in an httpOnly cookie, so page scripts can never read it.
// Sockets can't reuse that cookie (they connect to the backend's own domain), so
// they authenticate with a short-lived ticket fetched through /auth/socket-ticket.
export const AUTH_COOKIE = 'token';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Purpose = 'session' | 'socket';

interface TokenPayload {
  userId: string;
  purpose: Purpose;
  // Session tokens only: must equal user.tokenVersion, so bumping it revokes them.
  v?: number;
}

function sign(payload: TokenPayload, expiresIn: string): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn, algorithm: 'HS256' } as jwt.SignOptions);
}

export const signSocketTicket = (userId: string) => sign({ userId, purpose: 'socket' }, '60s');

function decode(token: string, purpose: Purpose): TokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
    return payload.purpose === purpose && payload.userId ? payload : null;
  } catch {
    return null;
  }
}

/** Returns the user id if the token is valid and was issued for `purpose`. */
export function verifyToken(token: string, purpose: Purpose): string | null {
  return decode(token, purpose)?.userId ?? null;
}

/** Validates a session cookie against the user's current tokenVersion. */
export async function verifySession(token: string | null): Promise<string | null> {
  const payload = token ? decode(token, 'session') : null;
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { tokenVersion: true } });
  // Cookies issued before versioning carry no `v`; they count as version 0.
  return user && user.tokenVersion === (payload.v ?? 0) ? payload.userId : null;
}

export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setAuthCookie(res: Response, user: { id: string; tokenVersion: number }) {
  res.cookie(AUTH_COOKIE, sign({ userId: user.id, purpose: 'session', v: user.tokenVersion }, config.jwtExpiresIn), {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/' });
}

export interface AuthedRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = await verifySession(readCookie(req.headers.cookie, AUTH_COOKIE));
    if (!userId) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}
