import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret,
  jwtExpiresIn: '7d',
  allowedOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001,https://video-conferencing-orpin-beta.vercel.app')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
