import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { UserManager } from "./managers/UserManager";
import router from "./auth/auth";  

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.json());

app.use("/auth", router);

app.get("/", (req, res) => {
  res.send("Server is running with Express + WebSockets + WebRTC");
});

const userManager = new UserManager();

io.on("connection", (socket: Socket) => {
  console.log(" A user connected:", socket.id);

  userManager.addUser(`user-${socket.id}`, socket);

  socket.on("chat message", (msg) => {
    console.log(` ${socket.id}: ${msg}`);
    io.emit("chat message", { from: socket.id, text: msg }); 
  });

  socket.on("disconnect", () => {
    console.log(" User disconnected:", socket.id);
    userManager.removeUser(socket.id);
  });
});

server.listen(3000, () => {
  console.log(" Listening on http://localhost:3000");
});
