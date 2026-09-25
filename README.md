# VibeCall

Live at **https://vibecall.world**

Random one-on-one video chat. Sign in, preview your camera, and get paired with
whoever is waiting. Video and audio flow peer to peer over WebRTC; the server
only does auth, matchmaking and signaling.

## Stack

- **front-end/**: Next.js 15, React 19, Tailwind v4, socket.io-client
- **backend/**: Express 5, Socket.IO, Prisma + PostgreSQL, JWT auth

## Running locally

```bash
# backend (port 3000)
cd backend
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
pnpm install
pnpm db:migrate
pnpm dev

# front-end (port 3001)
cd front-end
cp .env.example .env.local
pnpm install
pnpm dev            # runs on 3001
```

## Production

| Piece     | Host   | URL                          |
| --------- | ------ | ---------------------------- |
| Front-end | Vercel | https://vibecall.world       |
| Backend   | Render | https://api.vibecall.world   |
| Database  | Neon   | Postgres (`DATABASE_URL`)    |

- **Backend**: `render.yaml` is a Render Blueprint (Render → New → Blueprint). Migrations run on each deploy.
- **Front-end**: Vercel project with root directory `front-end` and `NEXT_PUBLIC_API_URL=https://api.vibecall.world`.
  Browsers call `/api/*` on vibecall.world, which Next.js proxies to the backend, so the httpOnly
  session cookie is first-party. Socket.IO connects to api.vibecall.world directly with a 60s ticket.
- **Google OAuth** redirect URI: `https://vibecall.world/api/auth/google/callback`.

## API

| Method | Path              | Auth   | Description                                       |
| ------ | ----------------- | ------ | ------------------------------------------------- |
| POST   | `/auth/signup`    | –      | `{name, email, username, password}` → `{user}` + session cookie |
| POST   | `/auth/signin`    | –      | `{username (or email), password}` → `{user}` + session cookie |
| GET    | `/auth/me`        | Cookie | Current user                                      |
| GET    | `/users/me/stats` | Cookie | Call count, total/longest duration, recent calls  |
| GET    | `/stats`          | –      | `{online, searching, activeRooms}`                |

## Socket events

Connect with `io(SOCKET_URL, { auth: { ticket } })`, where the ticket comes from `GET /auth/socket-ticket`
(cookie auth, valid 60s). Sockets without a valid ticket are rejected.

| Client → server                         | Server → client                                   |
| --------------------------------------- | ------------------------------------------------- |
| `ready {name}`: join the queue          | `lobby`: you are waiting for a partner            |
| `next`: skip the current partner        | `matched {roomId, partner, initiator}`            |
| `leave`: stop and leave the queue       | `send-offer {roomId}`: to the initiator only      |
| `offer` / `answer {roomId, sdp}`        | `offer` / `answer {roomId, sdp}`                  |
| `add-ice-candidate {roomId, candidate}` | `add-ice-candidate {roomId, candidate}`           |
| `chat-message {roomId, text}`           | `chat-message {roomId, text, ts}`                 |
| `typing {roomId, typing}`               | `typing {roomId, typing}`                         |
| `media-state {roomId, audio, video}`    | `media-state {roomId, audio, video}`              |
|                                         | `partner-left {roomId, reason}`, `online-count n` |

Calls that last 5 seconds or longer are saved to each signed-in user's history.

## WebRTC & STUN

Only public Google STUN servers are configured by default. Users behind
symmetric NATs or strict firewalls need a TURN relay. Set `NEXT_PUBLIC_TURN_URL`,
`NEXT_PUBLIC_TURN_USERNAME` and `NEXT_PUBLIC_TURN_CREDENTIAL` in the front-end env.
