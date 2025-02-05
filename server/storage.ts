import { User, InsertUser, Message, InsertMessage } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const MemoryStore = createMemoryStore(session);
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserStatus(id: number, status: string): Promise<User>;
  updateUserPublicKey(id: number, publicKey: string): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  banUser(id: number): Promise<void>;
  getMessages(userId1: number, userId2: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: number): Promise<void>;
  getContacts(userId: number): Promise<User[]>;
  addContact(userId: number, contactId: number): Promise<void>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;
  private contacts: Map<number, Set<number>>;
  private currentId: number;
  private currentMessageId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.contacts = new Map();
    this.currentId = 1;
    this.currentMessageId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Create default admin users with secure passwords
    this.createUser({
      username: "admin",
      password: "S1582834",
    }).then((user) => {
      this.users.set(user.id, { ...user, isAdmin: true });
    });

    this.createUser({
      username: "Said158",
      password: "S@@d261008",
    }).then((user) => {
      this.users.set(user.id, { ...user, isAdmin: true });
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const hashedPassword = await hashPassword(insertUser.password);
    const user: User = {
      ...insertUser,
      password: hashedPassword,
      id,
      isAdmin: false,
      status: "offline",
      publicKey: null,
      lastSeen: new Date(),
    };
    this.users.set(id, user);
    this.contacts.set(id, new Set());
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUserStatus(id: number, status: string): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, status, lastSeen: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserPublicKey(id: number, publicKey: string): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, publicKey };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async banUser(id: number): Promise<void> {
    this.users.delete(id);
    this.contacts.delete(id);
    // Remove this user from other users' contacts
    for (const contacts of this.contacts.values()) {
      contacts.delete(id);
    }
  }

  async getMessages(userId1: number, userId2: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (msg) =>
        (msg.senderId === userId1 && msg.receiverId === userId2) ||
        (msg.senderId === userId2 && msg.receiverId === userId1),
    );
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const newMessage: Message = {
      ...message,
      id,
      timestamp: new Date(),
    };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async deleteMessage(id: number): Promise<void> {
    this.messages.delete(id);
  }

  async getContacts(userId: number): Promise<User[]> {
    const contactIds = this.contacts.get(userId) || new Set();
    return Array.from(contactIds)
      .map(id => this.users.get(id))
      .filter((user): user is User => user !== undefined);
  }

  async addContact(userId: number, contactId: number): Promise<void> {
    if (!this.contacts.has(userId)) {
      this.contacts.set(userId, new Set());
    }
    this.contacts.get(userId)!.add(contactId);
  }
}

export const storage = new MemStorage();