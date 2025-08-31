import { User } from "./UserManager";

let GLOBAL_ROOM_ID = 1;

interface Room {
    user1: User;
    user2: User;
    roomId: string;
}

export class RoomManager {
    private rooms: Map<string, Room>;
    
    constructor() {
        this.rooms = new Map<string, Room>();
    }

    createRoom(user1: User, user2: User): string {
        const roomId = this.generate().toString();
        
        console.log(`Creating room ${roomId} for users ${user1.name} (${user1.socket.id}) and ${user2.name} (${user2.socket.id})`);
        
        this.rooms.set(roomId, {
            user1, 
            user2,
            roomId
        });

        user1.socket.join(roomId);
        user2.socket.join(roomId);
        
        console.log(`Both users joined Socket.IO room ${roomId}`);

        user1.socket.emit("send-offer", {
            roomId
        });

        console.log(`Sent send-offer to ${user1.name} for room ${roomId}`);
        
        return roomId;
    }

    onOffer(roomId: string, sdp: string, senderSocketId: string) {
        console.log(`Processing offer for room ${roomId} from sender ${senderSocketId}`);
        
        const room = this.rooms.get(roomId);
        if (!room) {
            console.log(`Room ${roomId} not found`);
            return;
        }

        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        
        console.log(`Forwarding offer to ${receivingUser.name} (${receivingUser.socket.id})`);
        
        receivingUser.socket.emit("offer", {
            sdp,
            roomId
        });
    }
    
    onAnswer(roomId: string, sdp: string, senderSocketId: string) {
        console.log(`Processing answer for room ${roomId} from sender ${senderSocketId}`);
        
        const room = this.rooms.get(roomId);
        if (!room) {
            console.log(`Room ${roomId} not found`);
            return;
        }

        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        
        console.log(`Forwarding answer to ${receivingUser.name} (${receivingUser.socket.id})`);

        receivingUser.socket.emit("answer", {
            sdp,
            roomId
        });
    }

    onIceCandidates(roomId: string, senderSocketId: string, candidate: any, type: "sender" | "receiver") {
        console.log(`Processing ICE candidate for room ${roomId} from sender ${senderSocketId}, type: ${type}`);
        
        const room = this.rooms.get(roomId);
        if (!room) {
            console.log(`Room ${roomId} not found`);
            return;
        }

        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        
        console.log(`Forwarding ICE candidate to ${receivingUser.name} (${receivingUser.socket.id})`);
        
        receivingUser.socket.emit("add-ice-candidate", {
            candidate,
            type
        });
    }

    removeUserFromRoom(socketId: string) {
        console.log(`Removing user ${socketId} from all rooms`);
        
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.user1.socket.id === socketId || room.user2.socket.id === socketId) {
                console.log(`Found user in room ${roomId}`);
                
                const otherUser = room.user1.socket.id === socketId ? room.user2 : room.user1;
                
                console.log(`Notifying ${otherUser.name} that partner left`);
                otherUser.socket.emit("lobby");
                otherUser.socket.leave(roomId);
                
                this.rooms.delete(roomId);
                console.log(`Room ${roomId} deleted`);
                
                break; 
            }
        }
    }

    getRoomCount(): number {
        return this.rooms.size;
    }

    getRoomInfo(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    getAllRooms(): { [key: string]: { user1Name: string, user2Name: string } } {
        const result: { [key: string]: { user1Name: string, user2Name: string } } = {};
        
        for (const [roomId, room] of this.rooms.entries()) {
            result[roomId] = {
                user1Name: room.user1.name,
                user2Name: room.user2.name
            };
        }
        
        return result;
    }

    private generate(): number {
        return GLOBAL_ROOM_ID++;
    }
}