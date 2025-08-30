
import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { UserManager } from './managers/UserManager';
import router from './auth/auth';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3001", "http://127.0.0.1:3001"], 
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: 'http://localhost:3001', 
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
  userManager.addUser("randomName", socket);
  socket.on("disconnect", () => {
    console.log("user disconnected");
    userManager.removeUser(socket.id);
  })
});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});