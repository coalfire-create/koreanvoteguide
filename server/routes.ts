import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { registerSchema, loginSchema, phoneVerificationSchema } from "@shared/schema";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import pgSession from "connect-pg-simple";
import { pool } from "./db";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const buf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hashed, "hex"), buf);
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgStore = pgSession(session);

  app.use(
    session({
      store: new PgStore({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "vote-with-reason-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/send-code", async (req, res) => {
    try {
      const result = phoneVerificationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "올바른 휴대폰 번호를 입력하세요" });
      }

      const { phone } = result.data;
      const normalizedPhone = phone.replace(/-/g, "");

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

      await storage.createVerificationCode(normalizedPhone, code, expiresAt);

      res.json({
        success: true,
        message: "인증번호가 발송되었습니다",
        demoCode: code,
      });
    } catch (error) {
      console.error("Send code error:", error);
      res.status(500).json({ error: "인증번호 발송 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        const firstError = result.error.errors[0]?.message || "입력 정보를 확인해주세요";
        return res.status(400).json({ error: firstError });
      }

      const { username, password, name, phone, verificationCode } = result.data;
      const normalizedPhone = phone.replace(/-/g, "");

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "이미 사용 중인 아이디입니다" });
      }

      const existingPhone = await storage.getUserByPhone(normalizedPhone);
      if (existingPhone) {
        return res.status(400).json({ error: "이미 등록된 전화번호입니다" });
      }

      const codeRecord = await storage.getVerificationCode(normalizedPhone, verificationCode);
      if (!codeRecord) {
        return res.status(400).json({ error: "인증번호가 올바르지 않거나 만료되었습니다" });
      }

      await storage.markVerificationCodeUsed(codeRecord.id);

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        phone: normalizedPhone,
      });

      req.session.userId = user.id;

      res.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "회원가입 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요" });
      }

      const { username, password } = result.data;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      const valid = await comparePasswords(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      req.session.userId = user.id;

      res.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "로그인 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "사용자를 찾을 수 없습니다" });
    }

    res.json({
      user: { id: user.id, username: user.username, name: user.name },
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "로그아웃 중 오류가 발생했습니다" });
      }
      res.json({ success: true });
    });
  });

  app.post("/api/candidates/rate", requireAuth, (req, res) => {
    const { candidateId, rating } = req.body;
    if (!candidateId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "잘못된 요청입니다" });
    }
    res.json({ success: true, candidateId, rating });
  });

  return httpServer;
}
