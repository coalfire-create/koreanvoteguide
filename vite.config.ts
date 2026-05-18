import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // 무거운 벤더를 별도 청크로 분리 → 병렬 다운로드 + 앱 코드 변경 시에도
    // 브라우저 캐시 재사용(배포 간 hash 유지). 라우트 청크는 가볍게 유지됨.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("/scheduler/") ||
            id.includes("/wouter/")
          )
            return "vendor-react";
          // 차트 스택(recharts + d3 + victory-vendor)은 member-detail 전용 → 별도 청크로
          if (
            id.includes("recharts") ||
            id.includes("victory-vendor") ||
            id.includes("internmap") ||
            /[\\/]d3-[a-z-]+[\\/]/.test(id)
          )
            return "vendor-charts";
          // 나머지는 패키지 단위로 분리 — 단일 거대 vendor 청크(800KB+) 방지.
          // 지연 라우트 전용 패키지는 해당 청크가 그 라우트 진입 시에만 로드됨.
          const after = id.split("node_modules/")[1];
          if (after) {
            const pkg = after.startsWith("@")
              ? after.split("/").slice(0, 2).join("/")
              : after.split("/")[0];
            return "vendor-" + pkg.replace("@", "").replace(/[/.]/g, "-");
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
