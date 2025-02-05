import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { setupAuth, requireAuth, requireAdmin } from "./auth";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import rateLimit from "express-rate-limit";
import passport from "passport";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
});

export function registerRoutes(app: Express): Server {
  app.use(limiter);
  setupAuth(app);

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(parsed.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(parsed);
      req.login(user, (err) => {
        if (err) throw err;
        res.status(201).json(user);
      });
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.sendStatus(200);
    });
  });

  app.get("/api/user", requireAuth, (req, res) => {
    res.json(req.user);
  });

  // Contacts routes
  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      const contacts = await storage.getContacts(req.user!.id);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }

      const contact = await storage.getUserByUsername(username);
      if (!contact) {
        return res.status(404).json({ message: "User not found" });
      }

      if (contact.id === req.user!.id) {
        return res.status(400).json({ message: "Cannot add yourself as a contact" });
      }

      await storage.addContact(req.user!.id, contact.id);
      res.json(contact);
    } catch (error) {
      console.error("Error adding contact:", error);
      res.status(500).json({ message: "Failed to add contact" });
    }
  });

  // Messages routes
  app.get("/api/messages/:userId", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const messages = await storage.getMessages(req.user!.id, userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't allow modifying your own admin status
      if (userId === req.user!.id && req.body.isAdmin !== undefined) {
        return res.status(403).json({ message: "Cannot modify your own admin status" });
      }

      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Don't allow deleting yourself
      if (userId === req.user!.id) {
        return res.status(403).json({ message: "Cannot delete your own account" });
      }

      await storage.banUser(userId);
      res.sendStatus(200);
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Socket.IO handling with auth check
  io.use((socket, next) => {
    if (socket.handshake.auth.token === "session") {
      const userId = socket.handshake.query.userId;
      if (userId) {
        socket.data.userId = Number(userId);
        return next();
      }
    }
    next(new Error("Authentication error"));
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", async (userId: number) => {
      if (userId !== socket.data.userId) {
        socket.emit("error", { message: "Invalid user ID" });
        return;
      }

      socket.join(`user_${userId}`);
      await storage.updateUserStatus(userId, "online");
      io.emit("user_status_changed", { userId, status: "online" });
    });

    socket.on("chat_message", async (data: {
      type: string;
      senderId: number;
      receiverId: number;
      content: string;
    }) => {
      try {
        // Verify sender
        if (data.senderId !== socket.data.userId) {
          socket.emit("error", { message: "Unauthorized message sender" });
          return;
        }

        const savedMessage = await storage.createMessage({
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
        });

        // Send to both sender and receiver
        io.to(`user_${data.senderId}`).to(`user_${data.receiverId}`).emit("new_message", savedMessage);
      } catch (error) {
        console.error("Message error:", error);
        socket.emit("error", { message: "Failed to save message" });
      }
    });

    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id);
      const userId = socket.data.userId;
      if (userId) {
        await storage.updateUserStatus(userId, "offline");
        io.emit("user_status_changed", { userId, status: "offline" });
      }
    });
  });

  return httpServer;
}