import { type User, type InsertUser, users, verificationCodes } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createVerificationCode(phone: string, code: string, expiresAt: Date): Promise<void>;
  getVerificationCode(phone: string, code: string): Promise<{ id: string; phone: string; code: string; expiresAt: Date; used: boolean } | undefined>;
  markVerificationCodeUsed(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      phoneVerified: true,
    }).returning();
    return user;
  }

  async createVerificationCode(phone: string, code: string, expiresAt: Date): Promise<void> {
    await db.insert(verificationCodes).values({ phone, code, expiresAt });
  }

  async getVerificationCode(phone: string, code: string) {
    const [record] = await db
      .select()
      .from(verificationCodes)
      .where(eq(verificationCodes.phone, phone));

    const match = record && record.code === code && !record.used && new Date(record.expiresAt) > new Date()
      ? record
      : undefined;
    return match;
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    await db.update(verificationCodes).set({ used: true }).where(eq(verificationCodes.id, id));
  }
}

export const storage = new DatabaseStorage();
