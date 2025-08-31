import { Socket } from "socket.io";
import { RoomManager } from "./RoomManager";

export interface User {
    socket: Socket;
    name: string;
}

export class UserManager {
    private users: User[];
    private queue: string[];
    private roomManager: RoomManager;
    
    constructor() {
        this.users = [];
        this.queue = [];
        this.roomManager = new RoomManager();
    }

    addUser(name: string, socket: Socket) {
        console.log(`Adding user ${name} with socket ${socket.id}`);
        
        this.users.push({
            name, socket
        });
        
        this.queue.push(socket.id);
        
        console.log(`User added. Queue length: ${this.queue.length}`);
        console.log(`Queue contents: [${this.queue.join(', ')}]`);
        
        // Initialize handlers FIRST
        this.initHandlers(socket);
        
        // Only emit lobby if they can't be paired immediately
        if (this.queue.length < 2) {
            socket.emit("lobby");
            console.log(`Sent lobby event to ${name} - waiting for partner`);
        }
        
        // Try to pair users
        this.clearQueue();
    }

    removeUser(socketId: string) {
        console.log(`Removing user with socket ${socketId}`);
        
        const user = this.users.find(x => x.socket.id === socketId);
        if (user) {
            console.log(`Removing user: ${user.name}`);
        }
        
        // Remove from users array
        this.users = this.users.filter(x => x.socket.id !== socketId);
        
        // Remove from queue
        this.queue = this.queue.filter(x => x !== socketId);
        
        // Handle room cleanup - notify room manager
        this.roomManager.removeUserFromRoom(socketId);
        
        console.log(`User removed. Remaining users: ${this.users.length}, Queue: ${this.queue.length}`);
    }

    clearQueue() {
        console.log("Inside clearQueue");
        console.log(`Queue length: ${this.queue.length}`);
        console.log(`Queue contents: [${this.queue.join(', ')}]`);
        
        // Need at least 2 users to create a room
        if (this.queue.length < 2) {
            console.log("Not enough users in queue to create room");
            return;
        }

        // Get the first two users from queue (FIFO)
        const id1 = this.queue.shift();
        const id2 = this.queue.shift();
        
        console.log(`Attempting to pair users: ${id1} and ${id2}`);
        
        const user1 = this.users.find(x => x.socket.id === id1);
        const user2 = this.users.find(x => x.socket.id === id2);

        if (!user1 || !user2) {
            console.log("Could not find both users");
            // Add back to queue if users not found
            if (user1) this.queue.unshift(id1!);
            if (user2) this.queue.unshift(id2!);
            return;
        }
        
        console.log(`Creating room for ${user1.name} and ${user2.name}`);
        const roomId = this.roomManager.createRoom(user1, user2);
        console.log(`Room created with ID: ${roomId}`);
        
        // Recursively clear queue if more users are waiting
        if (this.queue.length >= 2) {
            this.clearQueue();
        }
    }

    initHandlers(socket: Socket) {
        console.log(`Initializing handlers for socket ${socket.id}`);
        
        socket.on("offer", ({sdp, roomId}: {sdp: string, roomId: string}) => {
            console.log(`Received offer from ${socket.id} for room ${roomId}`);
            this.roomManager.onOffer(roomId, sdp, socket.id);
        });

        socket.on("answer", ({sdp, roomId}: {sdp: string, roomId: string}) => {
            console.log(`Received answer from ${socket.id} for room ${roomId}`);
            this.roomManager.onAnswer(roomId, sdp, socket.id);
        });

        socket.on("add-ice-candidate", ({candidate, roomId, type}) => {
            console.log(`Received ICE candidate from ${socket.id} for room ${roomId}, type: ${type}`);
            this.roomManager.onIceCandidates(roomId, socket.id, candidate, type);
        });
    }

    // Debug method to check current state
    getStatus() {
        return {
            totalUsers: this.users.length,
            queueLength: this.queue.length,
            activeRooms: this.roomManager.getRoomCount(),
            queueUserIds: this.queue
        };
    }
}