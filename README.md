# VibeCall

[![CI](https://github.com/prashantxy/VibeCall/actions/workflows/ci.yml/badge.svg)](https://github.com/prashantxy/VibeCall/actions/workflows/ci.yml)

**Random one-on-one video chat with someone new.** Sign in, preview your camera, and get paired with whoever
is waiting. Video and audio flow **peer to peer over WebRTC**. The server only handles accounts,
matchmaking and signaling, so it never sees or stores your call.

**Live:** https://vibecall.world · **API:** https://api.vibecall.world

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Authentication and sessions](#authentication-and-sessions)
- [REST API](#rest-api)
- [Socket.IO protocol](#socketio-protocol)
- [Data model](#data-model)
- [Security](#security)
- [Deployment](#deployment)
- [Continuous integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)
- [Support the project](#support-the-project)

---

## Features

- **Instant matching**: a FIFO queue pairs you with the next person waiting. Two tabs of the same account are never matched with each other.
- **Peer-to-peer video and audio** over WebRTC, with public STUN servers and optional TURN.
- **Text chat and typing indicator** alongside the call. Messages are relayed, never stored.
- **Mute and camera state sync**, so your partner sees when you turn your mic or camera off.
- **Skip or leave at any time.** If your partner skips, you go straight back into the queue.
- **Accounts** with username or email and password, or **Continue with Google**.
- **Dashboard** with a camera preview, a live online count, and your call stats (total calls, total and longest call time, recent partners).
- **Keyboard shortcuts** in a call: `Esc` skips (or closes chat or leaves the text box), `M` mutes, `V` turns the camera on or off.
- **Polished UI**: Next.js App Router, Tailwind v4, GSAP animations, and support for `prefers-reduced-motion`.

---

## How it works

```mermaid
flowchart LR
    subgraph Browser
      UI[Next.js pages]
    end
    subgraph Vercel["Vercel · vibecall.world"]
      NX[Next.js<br/>/api/* rewrite]
    end
    subgraph Render["Render · api.vibecall.world"]
      EX[Express REST]
      IO[Socket.IO<br/>matchmaking + signaling]
    end
    DB[(Neon Postgres)]
    G[Google OAuth]

    UI -- "fetch /api/* (session cookie)" --> NX
    NX -- proxied --> EX
    UI -- "websocket + 60s ticket" --> IO
    EX --> DB
    IO -- call history --> DB
    EX <--> G
    UI <-. "WebRTC media (peer to peer)" .-> UI2[Partner's browser]
```

- **REST calls go through the front-end's own domain.** The browser calls `https://vibecall.world/api/...`, and
  `next.config.ts` rewrites that to the backend. Because of this, the backend's `httpOnly` session cookie is
  first-party, which matters because Safari blocks cross-site cookies.
- **Sockets connect to the backend directly.** Vercel can't proxy websockets, so the Room page first fetches a
  60-second **socket ticket** over `/api`, then connects to `api.vibecall.world` with it.
- **Media never touches the server.** The server only relays the WebRTC offer, answer and ICE candidates between
  the two matched sockets.

### Call flow

```mermaid
sequenceDiagram
    participant A as Browser A
    participant S as Socket.IO server
    participant B as Browser B
    A->>S: ready {name}
    S-->>A: lobby
    B->>S: ready {name}
    S-->>A: matched {roomId, partner, initiator: true}
    S-->>B: matched {roomId, partner, initiator: false}
    S-->>A: send-offer {roomId}
    A->>S: offer {roomId, sdp}
    S-->>B: offer
    B->>S: answer {roomId, sdp}
    S-->>A: answer
    A->>S: add-ice-candidate (both ways)
    S-->>B: add-ice-candidate
    Note over A,B: Media flows peer to peer
    A->>S: next
    S-->>B: partner-left {reason: "skipped"}
    Note over S: Both are re-queued, and the call is saved if it lasted 5s or more
```

---

## Tech stack

| Layer      | Tech                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| Front-end  | Next.js 15 (App Router), React 19, Tailwind CSS v4, GSAP, lucide-react, socket.io-client      |
| Backend    | Node 22, Express 5, Socket.IO 4, Prisma 6, Zod 4, jsonwebtoken, bcrypt, express-rate-limit    |
| Database   | PostgreSQL (Neon in production)                                                               |
| Realtime   | WebRTC (STUN: Google public servers; TURN optional)                                           |
| Hosting    | Vercel (front-end), Render (backend), Neon (database)                                         |
| CI         | GitHub Actions                                                                                |

---

## Project structure

```
.
├── .github/workflows/ci.yml      # CI: build and check both apps
├── render.yaml                   # Render Blueprint for the backend
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # user + call models
│   │   └── migrations/           # SQL migrations (applied with `prisma migrate deploy`)
│   └── src/
│       ├── index.ts              # Express app, security headers, CORS, Socket.IO auth + wiring
│       ├── config.ts             # env loading and Zod validation
│       ├── prisma.ts             # Prisma client
│       ├── auth/
│       │   ├── auth.ts           # signup, signin, me, logout, socket-ticket
│       │   ├── google.ts         # Google OAuth (authorization-code flow)
│       │   ├── jwt.ts            # session cookie, token versioning, socket tickets
│       │   └── rateLimits.ts     # per-IP and per-account limits
│       ├── routes/users.ts       # /users/me/stats
│       └── managers/
│           ├── UserManager.ts    # queue + matchmaking + socket event handlers
│           ├── RoomManager.ts    # rooms, relaying, call history
│           └── events.ts         # Zod schemas for every client socket event
└── front-end/
    ├── next.config.ts            # /api rewrite to the backend + security headers
    ├── app/
    │   ├── page.tsx              # landing page
    │   ├── Authpage/page.tsx     # sign in / sign up / Google
    │   ├── Dashboard/page.tsx    # camera preview, stats, start a call
    │   ├── Room/page.tsx         # the call: WebRTC, chat, controls
    │   ├── layout.tsx            # fonts, metadata, intro-loader bootstrap
    │   └── globals.css           # design tokens, motion, focus styles
    ├── components/               # UI kit, loader, self-view, animated wall
    └── lib/
        ├── api.ts                # fetch wrapper, session cache, hooks
        ├── media.ts              # camera/mic hook
        └── gsap.ts               # GSAP setup and motion helpers
```

---

## Running locally

### Prerequisites

- **Node.js 22+**
- **pnpm 10** for the front-end (`npm i -g pnpm`). The backend uses **npm**.
- A **PostgreSQL** database. A free [Neon](https://neon.tech) project works, or a local Postgres.

### 1. Backend (port 3000)

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET (see below)
npm install                   # also runs `prisma generate`
npm run db:migrate            # applies migrations
npm run dev                   # builds and starts on http://localhost:3000
```

Generate a JWT secret with `openssl rand -hex 32`.

### 2. Front-end (port 3001)

```bash
cd front-end
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:3000
pnpm install
pnpm dev                      # http://localhost:3001
```

Open **http://localhost:3001**. To test a call on your own machine, sign in with **two different accounts** in two
browsers (or one normal and one private window). The matcher never pairs an account with itself.

### Scripts

| Where     | Command              | What it does                                         |
| --------- | -------------------- | ---------------------------------------------------- |
| backend   | `npm run dev`        | Compile TypeScript and start the server              |
| backend   | `npm run build`      | Compile to `dist/`                                   |
| backend   | `npm start`          | Run the compiled server                              |
| backend   | `npm run db:migrate` | Apply pending Prisma migrations                      |
| backend   | `npm run db:generate`| Regenerate the Prisma client                         |
| front-end | `pnpm dev`           | Dev server on port 3001                              |
| front-end | `pnpm build`         | Production build                                     |
| front-end | `pnpm lint`          | ESLint                                               |

---

## Environment variables

### Backend (`backend/.env`)

These are validated with Zod at startup. If a value is missing or malformed, the server refuses to start and
prints a list of what's wrong.

| Variable               | Required | Example / default                                            | Notes |
| ---------------------- | -------- | ------------------------------------------------------------ | ----- |
| `DATABASE_URL`         | yes      | `postgresql://user:pass@host/db?sslmode=require`             | Must start with `postgres://` or `postgresql://` |
| `JWT_SECRET`           | yes      | `openssl rand -hex 32`                                       | At least 32 characters. Changing it signs everyone out |
| `PORT`                 | no       | `3000`                                                       | Render sets this itself |
| `CORS_ORIGINS`         | no       | `http://localhost:3001,https://vibecall.world,https://www.vibecall.world` | Comma-separated front-end origins |
| `FRONTEND_URL`         | no       | first `CORS_ORIGINS` entry                                   | Where Google sign-in lands. Use `https` in production, which also makes cookies `Secure` |
| `GOOGLE_CLIENT_ID`     | no       |                                                              | Google sign-in is disabled (503) while empty |
| `GOOGLE_CLIENT_SECRET` | no       |                                                              | |
| `GOOGLE_REDIRECT_URI`  | no       | `${FRONTEND_URL}/api/auth/google/callback`                   | Must exactly match an authorized redirect URI in Google Cloud |

### Front-end (`front-end/.env.local`, and Vercel env)

`NEXT_PUBLIC_*` values are **built into the bundle**, so redeploy after changing them.

| Variable                      | Required | Example                              | Notes |
| ----------------------------- | -------- | ------------------------------------ | ----- |
| `NEXT_PUBLIC_API_URL`         | yes      | `https://api.vibecall.world`         | Target of the `/api` rewrite and the Socket.IO URL |
| `NEXT_PUBLIC_SUPPORT_URL`     | no       | `https://buymeacoffee.com/moralizer_19` | Support button link (this is the default) |
| `NEXT_PUBLIC_TURN_URL`        | no       | `turn:turn.example.com:3478`         | Optional TURN relay for strict NATs |
| `NEXT_PUBLIC_TURN_USERNAME`   | no       |                                      | |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | no       |                                      | |

---

## Authentication and sessions

### Session cookie

- Sign-up, sign-in and Google sign-in all set a cookie named **`token`**. It's a JWT (HS256, valid for 7 days) with
  the flags `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production.
- Page JavaScript **can't read it**. The front-end only caches the public profile (name, email, username) in
  `localStorage` so pages can render immediately. `/auth/me` is always the source of truth.
- Every session JWT carries the user's **`tokenVersion`**. `requireAuth` checks it against the database, so
  **bumping the version revokes every session at once**. That happens on:
  - **Logout**, which signs the account out on all devices, including anywhere a copied cookie is being used.
  - **Google taking over an email** (see below).

### Socket tickets

The Room page calls `GET /auth/socket-ticket` (authenticated by the cookie) and passes the returned ticket in
the Socket.IO handshake: `io(SOCKET_URL, { auth: { ticket } })`.

- A ticket is a JWT with `purpose: "socket"` that's valid for **60 seconds**. A fresh one is fetched on every connect
  and reconnect.
- Tickets and session tokens aren't interchangeable. A ticket is rejected as a cookie, and a session token is
  rejected by the socket.

### Google sign-in (authorization-code flow)

1. **Start:** the button goes to `/api/auth/google`. The backend sets a random `g_oauth_state` cookie and redirects
   to Google.
2. **Return:** Google redirects to `/api/auth/google/callback?code=…&state=…`. The backend then:
   - checks that `state` matches the cookie
   - exchanges the code for a token using the client secret
   - reads the user's profile and requires a **verified** email
3. **Account:** the user is found by Google ID, then by email, or created with a unique username based on the
   email.
4. **Existing password account:** if a password account already uses that email, Google is linked to it, the
   **password is removed** and **all its sessions are revoked**. Sign-up doesn't verify email ownership, so this
   stops anyone who registered someone else's address from keeping access after the real owner arrives.
5. **Back to the site:** the session cookie is set and the browser goes to `/Authpage#signedin=1`. Errors come
   back as fixed codes (`#error=expired`, etc.), and the page maps them to messages.

Because the callback also goes through the `/api` proxy, every cookie belongs to `vibecall.world`.

---

## REST API

Base URL: `https://vibecall.world/api` (proxied) or `https://api.vibecall.world` (direct). Errors look like
`{ "error": string | string[] }`.

| Method | Path                    | Auth   | Body / response                                                                          | Rate limit |
| ------ | ----------------------- | ------ | ---------------------------------------------------------------------------------------- | ---------- |
| POST   | `/auth/signup`          | –      | `{name, email, username, password}` → `201 {user}` + cookie. `409` if email or username is taken | 10/hour per IP |
| POST   | `/auth/signin`          | –      | `{username` (or email)`, password}` → `{user}` + cookie. `401` on bad credentials        | 30/15 min per IP, **10 failed/15 min per account** |
| GET    | `/auth/me`              | cookie | `{user}`                                                                                  | – |
| POST   | `/auth/logout`          | –      | Clears the cookie and revokes all sessions → `{message}`                                  | – |
| GET    | `/auth/socket-ticket`   | cookie | `{ticket}` (60 s)                                                                         | – |
| GET    | `/auth/google`          | –      | `302` to Google (`503` if Google isn't configured)                                        | 30/15 min per IP |
| GET    | `/auth/google/callback` | –      | `302` to `/Authpage#signedin=1` or `#error=<code>`                                        | – |
| GET    | `/users/me/stats`       | cookie | `{totalCalls, totalSeconds, longestSeconds, recent: [{id, partnerName, startedAt, durationSec}]}` (last 8) | – |
| GET    | `/stats`                | –      | `{online, searching, activeRooms}`                                                        | – |
| GET    | `/`                     | –      | Health text                                                                               | – |

**Validation rules** (Zod):
- **Name:** 2–50 characters.
- **Username:** 3–24 characters: letters, digits, `_` and `.`.
- **Email:** valid format, stored in lowercase.
- **Password:** 8–128 characters for sign-up. Sign-in accepts any non-empty password, so older accounts with 6
  or 7 characters still work.

Rate-limited responses return `429` with `RateLimit` and `Retry-After` headers.

---

## Socket.IO protocol

Connect to `NEXT_PUBLIC_API_URL` over the websocket transport with `auth: { ticket }`. A connection without a
valid ticket fails with `connect_error: "unauthorized"`.

Every client event is **validated with Zod** (`backend/src/managers/events.ts`). Invalid or `null` payloads are
silently dropped.

### Client → server

| Event               | Payload                                                        | Notes |
| ------------------- | -------------------------------------------------------------- | ----- |
| `ready`             | `{name}` or `"name"`                                           | Join or rejoin the queue. Name is trimmed to 40 characters, default `"Guest"` |
| `next`              | –                                                              | Skip the current partner; both of you are re-queued |
| `leave`             | –                                                              | Leave the room and the queue, but stay connected |
| `offer` / `answer`  | `{roomId, sdp: {type, sdp}}`                                   | `roomId` must be a UUID; SDP up to 100 kB |
| `add-ice-candidate` | `{roomId, candidate: {candidate, sdpMid?, sdpMLineIndex?, usernameFragment?}}` | |
| `media-state`       | `{roomId, audio: boolean, video: boolean}`                     | |
| `chat-message`      | `{roomId, text}`                                               | Trimmed and cut to 500 characters; empty messages are dropped |
| `typing`            | `{roomId, typing: boolean}`                                    | |

### Server → client

| Event                                     | Payload                                   |
| ----------------------------------------- | ----------------------------------------- |
| `lobby`                                   | – (you're waiting)                        |
| `matched`                                 | `{roomId, partner: {name}, initiator}`    |
| `send-offer`                              | `{roomId}` (initiator only)               |
| `offer`, `answer`, `add-ice-candidate`    | Relayed from the partner, plus `roomId`   |
| `media-state`, `typing`                   | Relayed from the partner                  |
| `chat-message`                            | `{roomId, text, ts}`                      |
| `partner-left`                            | `{roomId, reason: "skipped" \| "left" \| "disconnected"}` |
| `online-count`                            | `number` (broadcast on connect and disconnect) |

Calls lasting **5 seconds or more** are saved to both users' history when they end.

---

## Data model

```prisma
model user {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  username     String   @unique
  password     String?  // bcrypt hash; null for Google-only accounts
  googleId     String?  @unique
  tokenVersion Int      @default(0) // bump to revoke all sessions
  createdAt    DateTime @default(now())
  calls        call[]
}

model call {
  id          String   @id @default(uuid())
  userId      String   // -> user.id, cascade delete
  partnerName String
  startedAt   DateTime
  endedAt     DateTime
  durationSec Int
  @@index([userId, startedAt])
}
```

Schema changes go through Prisma migrations in `backend/prisma/migrations`. Create new ones with
`npx prisma migrate dev --name <change>` locally, and apply them with `npm run db:migrate`.

---

## Security

**What's in place:**

- **Session cookie:**
  - `HttpOnly` and `SameSite=Lax` (and `Secure` in production), so page scripts can't read it and other sites
    can't make logged-in requests with it.
  - Revocable through `tokenVersion`.
  - JWTs are pinned to HS256.
- **Passwords:** bcrypt with cost 10. Sign-in returns the same "Invalid credentials" error whether the username or
  the password was wrong.
- **Rate limiting:** per-IP limits on sign-up, sign-in and Google, and a per-account limit on failed sign-ins that
  doesn't depend on IP.
  - `trust proxy` is on, so the IP is read from `X-Forwarded-For` behind Vercel. That header can be forged on
    direct API calls, so the IP limits are best-effort; the per-account limit is not.
- **Input validation:** Zod on every HTTP body, socket payload, OAuth callback and Google response, and on the env
  at boot.
- **Google OAuth:** a `state` cookie guards against forged callbacks, and only verified emails are accepted. An
  email takeover removes the old password and revokes sessions.
- **Headers:**
  - Front-end: CSP with `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` and `object-src 'none'`,
    plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, and a `Permissions-Policy` that limits camera and
    microphone to this site.
  - API: `nosniff`, `X-Frame-Options`, and no `X-Powered-By`.
  - Vercel adds HSTS.
- **CORS:** limited to the origins in `CORS_ORIGINS`.
- **Dependencies:** production dependencies are kept free of known advisories (`npm audit` and `pnpm audit`).

**Known gaps and roadmap:**

- **Email verification:** sign-up doesn't verify email addresses, and it reveals whether an email or username is
  already taken.
- **Chat spam:** there's no limit on how fast someone can send chat messages or open socket connections.
- **Moderation:** there's no report/block button or 18+ age gate yet.
- **TURN:** no TURN server is set up by default, so calls can fail for some users behind strict NATs.

Found a security issue? Please report it privately to the maintainer instead of opening a public issue.

---

## Deployment

| Piece     | Host   | Domain                     |
| --------- | ------ | -------------------------- |
| Front-end | Vercel | `vibecall.world` (`www` redirects to it) |
| Backend   | Render | `api.vibecall.world`       |
| Database  | Neon   | Postgres                   |

### Backend on Render

1. **Create the service:** **New → Blueprint**, then pick this repo. `render.yaml` sets up the `vibecall-api` web
   service. You can also create it by hand with these settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm ci --include=dev && npm run build`
   - **Start Command:** `npm run db:migrate && npm start`. Keep the migrate step: without it, new migrations never
     reach production and the app returns 500 errors.
   - **Health check path:** `/stats`
2. **Environment:** set the variables from the [backend table](#backend-backendenv) with production values:
   - `FRONTEND_URL=https://vibecall.world`
   - `CORS_ORIGINS=https://vibecall.world,https://www.vibecall.world`
   - `GOOGLE_REDIRECT_URI=https://vibecall.world/api/auth/google/callback`
   - `NODE_VERSION=22`
3. **Custom domain:** in **Settings → Custom Domains**, add `api.vibecall.world`, then add the `CNAME` it shows at
   your DNS provider.
4. **Optional:** set **Auto-Deploy** to "After CI checks pass".

The free plan sleeps after 15 minutes idle. The first request after that takes about a minute and drops live
calls. The Starter plan stays awake.

### Front-end on Vercel

1. Import the repo and set **Root Directory** to `front-end`. Vercel detects pnpm from `pnpm-lock.yaml`.
2. Set `NEXT_PUBLIC_API_URL=https://api.vibecall.world`, then redeploy. The value is built into the bundle.
3. **Domains:** add `vibecall.world` (Production) and `www.vibecall.world` (redirect to `vibecall.world`).

### DNS

| Type  | Name  | Value                                               |
| ----- | ----- | --------------------------------------------------- |
| A     | `@`   | Vercel's IP (shown in Vercel → Domains)             |
| CNAME | `www` | Vercel's `…vercel-dns-….com` target                 |
| CNAME | `api` | `<service>.onrender.com`                            |

### Google Cloud

In **Google Auth Platform → Clients → your Web client**:

- **Authorized JavaScript origins:** `https://vibecall.world`, `http://localhost:3001`
- **Authorized redirect URIs:**
  `https://vibecall.world/api/auth/google/callback` and `http://localhost:3001/api/auth/google/callback`
- On the **Audience** page, **publish** the app so accounts other than test users can sign in.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

- **Backend:** `npm ci` (which also generates the Prisma client), then `prisma validate` and `npm run build`
  (TypeScript).
- **Front-end:** `pnpm install --frozen-lockfile`, then `pnpm lint`, `tsc --noEmit` and `pnpm build`.

---

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| "Create account" does nothing locally, and requests return 404 | The front-end is running on port 3000 and is receiving the API calls itself. Run the backend on 3000 and the front-end with `pnpm dev`, which uses port 3001 |
| Backend exits with `Invalid environment` | Fix the variables listed in the error, e.g. `JWT_SECRET` shorter than 32 characters or a `DATABASE_URL` that isn't Postgres |
| Sign-in returns 500 right after a deploy | Migrations weren't applied. Run `npm run db:migrate`, and make sure Render's start command includes it |
| Google shows `redirect_uri_mismatch` | Add the exact callback URL (including `/api` and the port) to the Google client, then wait a few minutes |
| Google sign-in returns 503 | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` isn't set on the backend |
| `ERR_CONNECTION_CLOSED` on a new domain | The browser cached DNS from before the domain was ready. Open `brave://net-internals/#dns` (or `chrome://…`), clear the host cache, and flush sockets |
| You're never matched when testing alone | Both tabs are signed into the same account. Use two different accounts |
| Video connects for some people but not others | They're behind a strict NAT. Configure a TURN server (`NEXT_PUBLIC_TURN_*`) |
| First request is very slow | Render's free plan was asleep. It wakes in about a minute |

---

## Support the project

If VibeCall made your day, you can [buy me a coffee ☕](https://buymeacoffee.com/moralizer_19).

Made by [Prashant Dubey](https://github.com/prashantxy) · [@pdubey1924 on X](https://x.com/pdubey1924)
