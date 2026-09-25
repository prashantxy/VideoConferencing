import { rateLimit } from 'express-rate-limit';

// In-memory counters: fine for a single backend instance.
//
// Client IPs: API calls arrive through Vercel's /api proxy, so the socket peer is
// Vercel, not the user. index.ts sets `trust proxy` so req.ip is the left-most
// X-Forwarded-For entry (the real client when proxied). Someone calling the API
// host directly can forge that header, so the IP limits are best-effort; the
// per-account signin limit below doesn't depend on IPs at all.

const common = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Permissive trust proxy is deliberate, see above.
  validate: { trustProxy: false },
} as const;

const tooMany = (what: string) => ({ error: `Too many ${what}. Please wait a few minutes and try again.` });

export const signinIpLimit = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: tooMany('sign-in attempts'),
});

/** Stops password guessing against one account, whatever IPs it comes from. */
export const signinAccountLimit = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `acct:${String(req.body?.username ?? '').trim().toLowerCase()}`,
  message: tooMany('failed sign-ins for this account'),
});

export const signupLimit = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: tooMany('new accounts from this network'),
});

export const googleLimit = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: tooMany('Google sign-in attempts'),
});
