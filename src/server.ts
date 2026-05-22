import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { apiLimiter, roomCreationLimiter } from "./middleware/rateLimiter";
import { generateRoomCode } from "./utils/roomGenerator";
import { registerSocketHandlers } from "./sockets/socketHandler";

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configure CORS allowing local Next.js client or a custom production URL
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL || ""
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation: request origin not white-listed."));
    }
  },
  credentials: true
}));

// Apply security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());

// General API Rate Limiting
app.use("/api/", apiLimiter);

// Setup Socket.IO with standard CORS
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 2e7, // Support up to 20MB encrypted payloads
  pingTimeout: 30000,
  pingInterval: 10000
});

// Ephemeral room generator endpoint
// Uses Socket.IO's in-memory room mapping to ensure generated codes are unique
app.post("/api/room/create", roomCreationLimiter, (req, res) => {
  try {
    const { roomName } = req.body;
    let roomCode = "";

    if (roomName && typeof roomName === "string" && roomName.trim().length > 0) {
      // Slugify the custom room name: uppercase, letters/numbers/hyphens only, max length 30
      const cleanName = roomName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 30);
      
      if (cleanName.length > 0) {
        // Append a random 4-digit number to guarantee uniqueness
        const digits = Math.floor(1000 + Math.random() * 9000);
        roomCode = `${cleanName}-${digits}`;
      }
    }

    if (!roomCode) {
      roomCode = generateRoomCode();
    }

    let attempts = 0;
    // Regenerate if code is active in-memory to prevent collision
    while (io.sockets.adapter.rooms.has(roomCode) && attempts < 10) {
      if (roomName && typeof roomName === "string" && roomName.trim().length > 0) {
        const cleanName = roomName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 30);
        const digits = Math.floor(1000 + Math.random() * 9000);
        roomCode = `${cleanName}-${digits}`;
      } else {
        roomCode = generateRoomCode();
      }
      attempts++;
    }
    
    res.status(200).json({ roomId: roomCode });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate secure chat room code." });
  }
});

// Basic server health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: Date.now() });
});

// Register Socket.IO listeners
registerSocketHandlers(io);

// Start the server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`CloakChat Security Relay listening on port ${PORT}`);
});
