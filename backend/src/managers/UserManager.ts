import { Socket } from "socket.io";
import { RoomManager } from "./RoomManager";

const MAX_CHAT_LENGTH = 500;

export interface User {
    socket: Socket;
    name: string;
    userId?: string;
}

export class UserManager {
    private users = new Map<string, User>();
    private queue: string[] = [];
    private roomManager = new RoomManager();

    /** Registers the socket (first "ready") or re-queues it (later "ready"). */
    addUser(name: string, socket: Socket) {
        const existing = this.users.get(socket.id);
        if (existing) {
            existing.name = name;
        } else {
            this.users.set(socket.id, { name, socket, userId: socket.data.userId });
            this.initHandlers(socket);
        }
        this.enqueue(socket.id);
    }

    removeUser(socketId: string) {
        this.dequeue(socketId);
        const partner = this.roomManager.endRoomFor(socketId, "disconnected");
        this.users.delete(socketId);
        if (partner) this.enqueue(partner.socket.id);
    }

    getStatus() {
        return {
            online: this.users.size,
            searching: this.queue.length,
            activeRooms: this.roomManager.getRoomCount(),
        };
    }

    private enqueue(socketId: string) {
        const user = this.users.get(socketId);
        if (!user || this.roomManager.isInRoom(socketId) || this.queue.includes(socketId)) return;
        this.queue.push(socketId);
        user.socket.emit("lobby");
        this.matchQueue();
    }

    private dequeue(socketId: string) {
        this.queue = this.queue.filter((id) => id !== socketId);
    }

    /** Pairs waiting users FIFO, never pairing two tabs of the same account. */
    private matchQueue() {
        let i = 0;
        while (i < this.queue.length) {
            const first = this.users.get(this.queue[i]);
            const j = this.queue.findIndex((id, idx) => {
                if (idx <= i) return false;
                const other = this.users.get(id);
                return !!other && !(first?.userId && first.userId === other.userId);
            });
            if (!first || j === -1) {
                i++;
                continue;
            }
            const second = this.users.get(this.queue[j])!;
            this.queue.splice(j, 1);
            this.queue.splice(i, 1);
            this.roomManager.createRoom(first, second);
        }
    }

    private initHandlers(socket: Socket) {
        socket.on("offer", ({ sdp, roomId } = {}) => {
            if (sdp && typeof sdp === "object") this.roomManager.relay(socket.id, roomId, "offer", { sdp });
        });

        socket.on("answer", ({ sdp, roomId } = {}) => {
            if (sdp && typeof sdp === "object") this.roomManager.relay(socket.id, roomId, "answer", { sdp });
        });

        socket.on("add-ice-candidate", ({ candidate, roomId } = {}) => {
            if (candidate && typeof candidate === "object") {
                this.roomManager.relay(socket.id, roomId, "add-ice-candidate", { candidate });
            }
        });

        socket.on("media-state", ({ roomId, audio, video } = {}) => {
            this.roomManager.relay(socket.id, roomId, "media-state", { audio: !!audio, video: !!video });
        });

        socket.on("chat-message", ({ roomId, text } = {}) => {
            if (typeof text !== "string") return;
            const trimmed = text.trim().slice(0, MAX_CHAT_LENGTH);
            if (!trimmed) return;
            this.roomManager.relay(socket.id, roomId, "chat-message", { text: trimmed, ts: Date.now() });
        });

        socket.on("typing", ({ roomId, typing } = {}) => {
            this.roomManager.relay(socket.id, roomId, "typing", { typing: !!typing });
        });

        // Skip the current partner and look for a new one.
        socket.on("next", () => {
            const partner = this.roomManager.endRoomFor(socket.id, "skipped");
            this.enqueue(socket.id);
            if (partner) this.enqueue(partner.socket.id);
        });

        // Stop chatting entirely (stay connected, but out of the queue).
        socket.on("leave", () => {
            this.dequeue(socket.id);
            const partner = this.roomManager.endRoomFor(socket.id, "left");
            if (partner) this.enqueue(partner.socket.id);
        });
    }
}
