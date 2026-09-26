# VibeCall front-end

The Next.js app behind https://vibecall.world. Full documentation (architecture, environment, API, deployment)
lives in the [root README](../README.md).

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3000
pnpm install
pnpm dev                     # http://localhost:3001
```

Requests to `/api/*` are proxied to `NEXT_PUBLIC_API_URL` (see `next.config.ts`). Start the backend first.
