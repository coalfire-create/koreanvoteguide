import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/candidates/rate", (req, res) => {
    const { candidateId, rating } = req.body;
    if (!candidateId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "잘못된 요청입니다" });
    }
    res.json({ success: true, candidateId, rating });
  });

  return httpServer;
}
