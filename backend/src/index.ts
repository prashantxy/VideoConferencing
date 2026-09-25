import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import { config } from './config';
import { UserManager } from './managers/UserManager';
import { verifyToken } from './auth/jwt';
import authRouter from './auth/auth';
import googleRouter from './auth/google';
import usersRouter from './routes/users';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));

app.use('/auth', authRouter);
app.use('/auth/google', googleRouter);
app.use('/users', usersRouter);

const userManager = new UserManager();

app.get('/', (req, res) => {
  res.send('Server is running with Express + WebSockets + WebRTC');
});

app.get('/stats', (req, res) => {
  res.json(userManager.getStatus());
});

const broadcastOnline = () => io.emit("online-count", userManager.getStatus().online);

// Only signed-in users may join the matchmaking pool.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const userId = typeof token === 'string' ? verifyToken(token) : null;
  if (!userId) return next(new Error('unauthorized'));
  socket.data.userId = userId;
  next();
});

io.on('connection', (socket: Socket) => {
  socket.on("ready", (payload: unknown) => {
    const raw = typeof payload === 'string' ? payload : (payload as { name?: unknown })?.name;
    const name = typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 40) : "Guest";
    userManager.addUser(name, socket);
    broadcastOnline();
  });

  socket.on("disconnect", () => {
    userManager.removeUser(socket.id);
    broadcastOnline();
  });
});

server.listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port}`);
});
