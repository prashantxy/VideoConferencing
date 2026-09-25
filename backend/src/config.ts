import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
}

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3001,https://video-conferencing-orpin-beta.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret,
  jwtExpiresIn: '7d',
  allowedOrigins,
  // Where the Google callback sends the browser back to.
  frontendUrl: (process.env.FRONTEND_URL ?? allowedOrigins[0] ?? 'http://localhost:3001').replace(/\/$/, ''),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${Number(process.env.PORT) || 3000}/auth/google/callback`,
  },
};
