import { Server, Socket } from "socket.io";

const PUBLIC_LOBBIES = ["GAMING-ZONE", "FREE-ZONE", "TECH-ZONE", "DEV-ZONE"];

/**
 * Socket.IO events and room orchestration for CloakChat.
 * Ensures E2EE messaging is ephemeral and zero-knowledge.
 */
export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    // console.log(`Client connected: ${socket.id}`);

    // Join a room safely
    socket.on("join-room", ({ roomId, nickname }: { roomId: string; nickname?: string }) => {
      // Validate room ID format to prevent code injection or malformed strings
      if (typeof roomId !== "string" || roomId.trim().length === 0 || roomId.length > 50) {
        socket.emit("error-message", { message: "Invalid room identifier." });
        return;
      }

      const uppercaseRoomId = roomId.toUpperCase();
      const isPublicLobby = PUBLIC_LOBBIES.includes(uppercaseRoomId);

      const activeRoom = io.sockets.adapter.rooms.get(roomId);
      const occupantCount = activeRoom ? activeRoom.size : 0;

      // Capped room size: Maximum 2 occupants for strict privacy and E2EE security,
      // EXCEPT for public lobbies which are open communities.
      if (!isPublicLobby && occupantCount >= 2) {
        socket.emit("room-full", { roomId });
        return;
      }

      // Join the room
      socket.join(roomId);
      
      // Save the nickname in socket data
      socket.data.nickname = nickname || "Anonymous";
      
      // Notify other peers in the room that a peer joined
      socket.to(roomId).emit("peer-joined", { peerId: socket.id, nickname: socket.data.nickname });

      // Synchronize nicknames lists
      if (isPublicLobby) {
        // Collect nicknames of all current occupants in the community
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const nicknames: Record<string, string> = {};
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const s = io.sockets.sockets.get(socketId);
            if (s) {
              nicknames[socketId] = s.data.nickname || "Anonymous";
            }
          }
        }
        // Emit ready to the entire room to keep all participants' user lists fully synced
        io.to(roomId).emit("room-ready", { roomId, nicknames });
      } else if (occupantCount === 1) {
        // Collect nicknames of both occupants for private room
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const nicknames: Record<string, string> = {};
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const s = io.sockets.sockets.get(socketId);
            if (s) {
              nicknames[socketId] = s.data.nickname || "Anonymous";
            }
          }
        }
        io.to(roomId).emit("room-ready", { roomId, nicknames });
      } else {
        socket.emit("waiting-for-peer");
      }
    });

    // Relay encrypted message (server never decodes, just passes the payload)
    socket.on("send-encrypted-message", (payload: {
      roomId: string;
      ciphertext: string;
      iv: string;
      timestamp: number;
      selfDestructDuration?: number; // Optional duration in seconds
    }) => {
      const { roomId, ciphertext, iv, timestamp, selfDestructDuration } = payload;
      
      if (!roomId || !ciphertext || !iv) {
        return; // Reject incomplete payloads
      }

      // Verify the sender is actually in the room they claim to send to
      if (socket.rooms.has(roomId)) {
        // Broadcast the encrypted ciphertext to other clients in the room
        socket.to(roomId).emit("encrypted-message", {
          senderId: socket.id,
          ciphertext,
          iv,
          timestamp,
          selfDestructDuration
        });
      }
    });

    // Broadcast typing indicators with rich sender contexts for group scaling
    socket.on("typing-state", ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
      if (socket.rooms.has(roomId)) {
        socket.to(roomId).emit("peer-typing", {
          senderId: socket.id,
          nickname: socket.data.nickname,
          isTyping
        });
      }
    });

    // Generic WebRTC Signaling Relay
    socket.on("webrtc-signal", ({ roomId, signal }: { roomId: string; signal: any }) => {
      if (socket.rooms.has(roomId)) {
        socket.to(roomId).emit("webrtc-signal", {
          senderId: socket.id,
          signal,
        });
      }
    });

    // Broadcast read receipts
    socket.on("read-receipt", ({ roomId, messageId }: { roomId: string; messageId: string }) => {
      if (socket.rooms.has(roomId)) {
        socket.to(roomId).emit("message-read", { messageId });
      }
    });

    // Relay encrypted emoji reactions (server never decodes payload)
    socket.on("send-reaction", ({ roomId, messageId, encryptedEmoji, iv }: {
      roomId: string;
      messageId: string;
      encryptedEmoji: string;
      iv: string;
    }) => {
      if (!roomId || !messageId || !encryptedEmoji || !iv) return;
      if (socket.rooms.has(roomId)) {
        socket.to(roomId).emit("message-reaction", {
          senderId: socket.id,
          messageId,
          encryptedEmoji,
          iv,
        });
      }
    });

    // Handle explicit room exit
    socket.on("leave-room", ({ roomId }: { roomId: string }) => {
      if (socket.rooms.has(roomId)) {
        socket.to(roomId).emit("peer-left", { peerId: socket.id });
        socket.leave(roomId);
      }
    });

    // Handle peer disconnection
    socket.on("disconnecting", () => {
      // Notify all rooms this client was active in before leaving
      socket.rooms.forEach((roomId) => {
        if (roomId !== socket.id) {
          socket.to(roomId).emit("peer-left", { peerId: socket.id });
        }
      });
    });

    socket.on("disconnect", () => {
      // console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
