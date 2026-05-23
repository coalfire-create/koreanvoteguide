import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerLegalPages } from "./legal-pages";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startScheduler } from "./scheduler";
import helmet from "helmet";
import { initMonitoring, captureError } from "./utils/monitoring";

initMonitoring();

const app = express();
const httpServer = createServer(app);

const isProduction = process.env.NODE_ENV === "production";

// Railway/Vercel/Cloudflare 등 프록시 뒤에서 X-Forwarded-* 헤더 신뢰 (rate limit IP, secure cookie 판정)
app.set("trust proxy", 1);

// 운영 환경에서 SESSION_SECRET이 비어있으면 즉시 종료 (서명 위조 방지)
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("프로덕션에서는 SESSION_SECRET(32자 이상) 환경변수가 필수입니다.");
}

// 컨테이너/오케스트레이터 헬스체크 — 인증/세션/외부 호출 없는 경량 응답
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptimeSec: Math.floor(process.uptime()) });
});

// 보안 헤더
app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
            // Google Analytics(GA4) gtag 로더 허용. 인라인 스크립트는 사용하지 않음(main.tsx 참고).
            scriptSrc: ["'self'", "https://www.googletagmanager.com"],
            // 외부 이미지는 사진 프록시 + 위키 + GA 비콘 정도만. HTTP 혼합 콘텐츠 제거.
            imgSrc: [
              "'self'",
              "data:",
              "https://open.assembly.go.kr",
              "https://upload.wikimedia.org",
              "https://wikimedia.org",
              "https://search.pstatic.net",
              "https://sstatic.naver.net",
              "https://www.googletagmanager.com",
              "https://*.google-analytics.com",
            ],
            // GA4 수집 엔드포인트(google-analytics.com, analytics.google.com) 허용.
            connectSrc: [
              "'self'",
              "https://www.googletagmanager.com",
              "https://*.google-analytics.com",
              "https://*.analytics.google.com",
            ],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// CORS (프로덕션에서는 ALLOWED_ORIGIN 환경변수에 명시된 오리진만 허용)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!isProduction) {
    // 개발: 모두 허용
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  } else {
    // 프로덕션: ALLOWED_ORIGIN에 명시된 오리진만 허용 (미설정 시 차단)
    const allowedOrigins = (process.env.ALLOWED_ORIGIN || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    }
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// 요청 크기 제한 (XSS/DoS 방지)
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// 업로드된 이미지 파일 정적 변환
import path from "path";
app.use("/uploads", express.static(path.resolve(process.cwd(), "server/static/uploads")));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // 프로덕션에서는 응답 본문을 로그에 남기지 않음 (개인정보/세션/비번 유출 방지)
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (!isProduction && capturedJsonResponse) {
        const preview = JSON.stringify(capturedJsonResponse).slice(0, 200);
        logLine += ` :: ${preview}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  registerLegalPages(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);
    captureError(err, { path: req.path, method: req.method, status });

    if (res.headersSent) {
      return next(err);
    }
    // 운영에서는 내부 에러 메시지를 외부에 노출하지 않는다
    const exposed = isProduction && status === 500 ? "Internal Server Error" : message;
    return res.status(status).json({ message: exposed });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      startScheduler();
    },
  );
})();
