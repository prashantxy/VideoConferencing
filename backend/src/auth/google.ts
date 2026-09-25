import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../prisma';
import { config } from '../config';
import { readCookie, setAuthCookie } from './jwt';
import { googleLimit } from './rateLimits';

// Authorization-code flow: /auth/google sends the browser to Google, Google
// sends it back to /auth/google/callback, and we set the session cookie.
// Both routes are reached through the front-end's /api proxy, so the cookies
// belong to the front-end's domain.

const router = Router();

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const STATE_COOKIE = 'g_oauth_state';

// Google's redirect back to us: either { code, state } or { error }.
const callbackQuery = z.union([
  z.object({ code: z.string().min(1), state: z.string().regex(/^[0-9a-f]{32}$/) }),
  z.object({ error: z.string() }),
]);

const tokenResponse = z.object({ access_token: z.string().min(1) });

const googleProfile = z.object({
  sub: z.string().min(1),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

const configured = () => Boolean(config.google.clientId && config.google.clientSecret);

// Errors travel as codes; the Authpage maps them to text, so a crafted
// #error=... link can't put arbitrary words on our page.
type GoogleError = 'cancelled' | 'expired' | 'unverified' | 'linked_elsewhere' | 'failed';

function backToFrontend(res: Response, params: { signedin: '1' } | { error: GoogleError }) {
  res.clearCookie(STATE_COOKIE, { path: '/' });
  res.redirect(`${config.frontendUrl}/Authpage#${new URLSearchParams(params)}`);
}

/** Derives a unique username from the email's local part, e.g. ada_l, ada_l1, ... */
async function uniqueUsername(email: string): Promise<string> {
  const base = (email.split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 20) || 'user').padEnd(3, '0');
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    if (!(await prisma.user.findUnique({ where: { username: candidate } }))) return candidate;
  }
  return `${base}${crypto.randomBytes(3).toString('hex')}`;
}

router.get('/', googleLimit, (req, res) => {
  if (!configured()) return res.status(503).json({ error: 'Google sign-in is not configured' });

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    // Browser sees /api/auth/google, backend sees /auth/google, so scope to root.
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`${AUTH_URL}?${params}`);
});

router.get('/callback', async (req, res) => {
  const query = callbackQuery.safeParse(req.query);
  if (query.success && 'error' in query.data) return backToFrontend(res, { error: 'cancelled' });

  const expected = readCookie(req.headers.cookie, STATE_COOKIE);
  if (!query.success || !('code' in query.data) || !expected || query.data.state !== expected) {
    return backToFrontend(res, { error: 'expired' });
  }
  const { code } = query.data;

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    const { access_token } = tokenResponse.parse(await tokenRes.json());

    const profileRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!profileRes.ok) throw new Error(`Userinfo failed: ${profileRes.status}`);
    const profile = googleProfile.parse(await profileRes.json());

    if (!profile.email || !profile.email_verified) {
      return backToFrontend(res, { error: 'unverified' });
    }
    const email = profile.email.toLowerCase();

    let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail?.googleId) {
        return backToFrontend(res, { error: 'linked_elsewhere' });
      }
      user = byEmail
        // Sign-up never verified this address, but Google just did. Whoever set the
        // existing password may not own the inbox, so drop it and revoke their sessions;
        // the real owner can keep using Google (or set a new password later).
        ? await prisma.user.update({
            where: { id: byEmail.id },
            data: {
              googleId: profile.sub,
              password: null,
              tokenVersion: { increment: 1 },
              name: (profile.name ?? byEmail.name).slice(0, 50),
            },
          })
        : await prisma.user.create({
            data: {
              googleId: profile.sub,
              email,
              name: (profile.name ?? email.split('@')[0]).slice(0, 50),
              username: await uniqueUsername(email),
            },
          });
    }

    setAuthCookie(res, user);
    return backToFrontend(res, { signedin: '1' });
  } catch (err) {
    console.error(err);
    return backToFrontend(res, { error: 'failed' });
  }
});

export default router;
