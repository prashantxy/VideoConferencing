import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// The session JWT lives in an httpOnly cookie, so page scripts can never read it.
// Sockets can't reuse that cookie (they connect to the backend's own domain), so
// they authenticate with a short-lived ticket fetched through /auth/socket-ticket.
export const AUTH_COOKIE = 'token';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Purpose = 'session' | 'socket';

interface TokenPayload {
  userId: string;
  purpose: Purpose;
}

function sign(userId: string, purpose: Purpose, expiresIn: string): string {
  return jwt.sign({ userId, purpose } satisfies TokenPayload, config.jwtSecret, { expiresIn } as jwt.SignOptions);
}

export const signSocketTicket = (userId: string) => sign(userId, 'socket', '60s');

/** Returns the user id if the token is valid and was issued for `purpose`. */
export function verifyToken(token: string, purpose: Purpose): string | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    return payload.purpose === purpose ? payload.userId ?? null : null;
  } catch {
    return null;
  }
}

export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setAuthCookie(res: Response, userId: string) {
  res.cookie(AUTH_COOKIE, sign(userId, 'session', config.jwtExpiresIn), {
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

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = readCookie(req.headers.cookie, AUTH_COOKIE);
  const userId = token ? verifyToken(token, 'session') : null;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = userId;
  next();
}
