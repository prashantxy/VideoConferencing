import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { UserManager } from './managers/UserManager';
import router from './auth/auth';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:3001",
  "https://video-conferencing-orpin-beta.vercel.app"
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());

app.use('/auth', router);

app.get('/', (req, res) => {
  res.send('Server is running with Express + WebSockets + WebRTC');
});

const userManager = new UserManager();

io.on('connection', (socket: Socket) => {
  console.log('a user connected');

  socket.on("ready", (name: string) => {
    userManager.addUser(name || "Guest", socket);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    userManager.removeUser(socket.id);
  });
});


server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
