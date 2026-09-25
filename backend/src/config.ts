import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const csv = (s: string) => s.split(',').map((o) => o.trim()).filter(Boolean);
const withoutTrailingSlash = (s: string) => s.replace(/\/$/, '');

// Validated once at startup: a missing or malformed variable stops the server
// with a readable list instead of failing on the first request.
const envSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters (try `openssl rand -hex 32`)'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001,https://vibecall.world,https://www.vibecall.world')
    .transform(csv)
    .pipe(z.array(z.string().url()).min(1)),
  FRONTEND_URL: z.string().url().transform(withoutTrailingSlash).optional(),
  // Google sign-in is optional; /auth/google answers 503 while these are empty.
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment. Copy .env.example to .env and fix:\n${problems}`);
}
const env = parsed.data;

// Where the Google callback sends the browser back to.
const frontendUrl = env.FRONTEND_URL ?? withoutTrailingSlash(env.CORS_ORIGINS[0]);

export const config = {
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: '7d',
  allowedOrigins: env.CORS_ORIGINS,
  frontendUrl,
  // Cookies are Secure whenever the site is served over https.
  cookieSecure: frontendUrl.startsWith('https://'),
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    // Goes through the front-end's /api proxy so the session cookie lands on the front-end's domain.
    redirectUri: env.GOOGLE_REDIRECT_URI ?? `${frontendUrl}/api/auth/google/callback`,
  },
};
