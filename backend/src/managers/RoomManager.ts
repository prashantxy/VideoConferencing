import { randomUUID } from "crypto";
import { User } from "./UserManager";
import { prisma } from "../prisma";

// Matches shorter than this (e.g. instant skips) are not written to call history.
const MIN_RECORDED_CALL_SEC = 5;

interface Room {
    roomId: string;
    users: [User, User];
    startedAt: Date;
}

export type EndReason = "skipped" | "left" | "disconnected";

export class RoomManager {
    private rooms = new Map<string, Room>();
    private roomBySocket = new Map<string, string>();

    createRoom(user1: User, user2: User): string {
        const roomId = randomUUID();
        this.rooms.set(roomId, { roomId, users: [user1, user2], startedAt: new Date() });
        this.roomBySocket.set(user1.socket.id, roomId);
        this.roomBySocket.set(user2.socket.id, roomId);

        user1.socket.join(roomId);
        user2.socket.join(roomId);

        console.log(`Room ${roomId}: ${user1.name} <-> ${user2.name}`);

        // user1 is the initiator: it creates the offer, user2 answers.
        user1.socket.emit("matched", { roomId, partner: { name: user2.name }, initiator: true });
        user2.socket.emit("matched", { roomId, partner: { name: user1.name }, initiator: false });
        user1.socket.emit("send-offer", { roomId });

        return roomId;
    }

    isInRoom(socketId: string): boolean {
        return this.roomBySocket.has(socketId);
    }

    /** Forwards a signaling/chat event to the other member of the sender's room. */
    relay(senderSocketId: string, roomId: unknown, event: string, payload: object) {
        const room = typeof roomId === "string" ? this.rooms.get(roomId) : undefined;
        if (!room) return;
        const partner = this.partnerIn(room, senderSocketId);
        if (!partner) return;
        partner.socket.emit(event, { ...payload, roomId: room.roomId });
    }

    /**
     * Tears down the room the socket is in. The partner is told why and is
     * returned so the caller can put them back in the queue.
     */
    endRoomFor(socketId: string, reason: EndReason): User | null {
        const roomId = this.roomBySocket.get(socketId);
        const room = roomId ? this.rooms.get(roomId) : undefined;
        if (!room) return null;

        this.rooms.delete(room.roomId);
        for (const u of room.users) {
            this.roomBySocket.delete(u.socket.id);
            u.socket.leave(room.roomId);
        }

        const partner = this.partnerIn(room, socketId);
        partner?.socket.emit("partner-left", { roomId: room.roomId, reason });
        console.log(`Room ${room.roomId} ended (${reason})`);

        this.recordCall(room).catch((err) => console.error("Failed to record call", err));
        return partner;
    }

    getRoomCount(): number {
        return this.rooms.size;
    }

    private partnerIn(room: Room, socketId: string): User | null {
        const [a, b] = room.users;
        if (a.socket.id === socketId) return b;
        if (b.socket.id === socketId) return a;
        return null;
    }

    private async recordCall(room: Room) {
        const endedAt = new Date();
        const durationSec = Math.round((endedAt.getTime() - room.startedAt.getTime()) / 1000);
        if (durationSec < MIN_RECORDED_CALL_SEC) return;

        const [a, b] = room.users;
        const rows = [
            { user: a, partner: b },
            { user: b, partner: a },
        ]
            .filter(({ user }) => user.userId)
            .map(({ user, partner }) => ({
                userId: user.userId!,
                partnerName: partner.name,
                startedAt: room.startedAt,
                endedAt,
                durationSec,
            }));

        if (rows.length) await prisma.call.createMany({ data: rows });
    }
}
