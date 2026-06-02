import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { registerLegalPages } from "./legal-pages";
import { registerSupportPage } from "./support-page";
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
          useDefaults: false,
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
            // Google Analytics(GA4) gtag 로더 허용. 인라인 스크립트는 사용하지 않음(main.tsx 참고).
            scriptSrc: ["'self'", "https://www.googletagmanager.com"],
            // 이미지: 자체·data·blob 외에 모든 HTTPS 허용.
            // 뉴스 썸네일이 8개 매체(연합·뉴시스·조선·경향·한겨레·SBS·오마이·미디어오늘)의 다양한
            // CDN 도메인(image.newsis.com, img.yna.co.kr, www.chosun.com, ...)에서 오기 때문에
            // 도메인 화이트리스트로는 누락이 계속 발생. img-src 는 HTTPS 강제만으로도 충분히 안전
            // (스크립트 실행이 아닌 단순 이미지 로드, mixed-content 차단됨).
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            // GA4 + OAuth 콜백 엔드포인트 허용.
            connectSrc: [
              "'self'",
              "https://www.googletagmanager.com",
              "https://*.google-analytics.com",
              "https://*.analytics.google.com",
              // Kakao OAuth
              "https://kauth.kakao.com",
              "https://kapi.kakao.com",
              // Google OAuth
              "https://accounts.google.com",
              "https://oauth2.googleapis.com",
              "https://www.googleapis.com",
              // Apple OAuth
              "https://appleid.apple.com",
            ],
            // OAuth 리다이렉션 허용 (form_post 포함)
            formAction: [
              "'self'",
              "https://kauth.kakao.com",
              "https://accounts.google.com",
              "https://appleid.apple.com",
            ],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
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

// 쿠키 파서 — req.cookies 에서 OAuth state 쿠키 등을 읽기 위해 필요
app.use(cookieParser());

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
  registerSupportPage(app);
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
