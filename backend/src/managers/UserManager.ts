import { Socket } from "socket.io";
import { RoomManager } from "./RoomManager";
import { onEvent } from "./events";

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

    // Payloads are validated in ./events; invalid ones never reach these handlers.
    private initHandlers(socket: Socket) {
        onEvent(socket, "offer", ({ roomId, sdp }) => {
            this.roomManager.relay(socket.id, roomId, "offer", { sdp });
        });

        onEvent(socket, "answer", ({ roomId, sdp }) => {
            this.roomManager.relay(socket.id, roomId, "answer", { sdp });
        });

        onEvent(socket, "add-ice-candidate", ({ roomId, candidate }) => {
            this.roomManager.relay(socket.id, roomId, "add-ice-candidate", { candidate });
        });

        onEvent(socket, "media-state", ({ roomId, audio, video }) => {
            this.roomManager.relay(socket.id, roomId, "media-state", { audio, video });
        });

        onEvent(socket, "chat-message", ({ roomId, text }) => {
            this.roomManager.relay(socket.id, roomId, "chat-message", { text, ts: Date.now() });
        });

        onEvent(socket, "typing", ({ roomId, typing }) => {
            this.roomManager.relay(socket.id, roomId, "typing", { typing });
        });

        // Skip the current partner and look for a new one.
        onEvent(socket, "next", () => {
            const partner = this.roomManager.endRoomFor(socket.id, "skipped");
            this.enqueue(socket.id);
            if (partner) this.enqueue(partner.socket.id);
        });

        // Stop chatting entirely (stay connected, but out of the queue).
        onEvent(socket, "leave", () => {
            this.dequeue(socket.id);
            const partner = this.roomManager.endRoomFor(socket.id, "left");
            if (partner) this.enqueue(partner.socket.id);
        });
    }
}
