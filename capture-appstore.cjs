// App Store 스크린샷 자동 캡처
// CSS 430pt(iPhone Pro Max) × DPR 3 = 최종 1290 × 2796 (App Store 6.7" 슬롯)

const puppeteer = require("puppeteer-core");
const http = require("http");

const VIEWPORT = { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const BASE = "http://localhost:3000";
const OUT = "/tmp/appstore-screenshots";

// 시드 — 지역 + 온보딩 우회
const SEED = {
  userRegions: JSON.stringify([{ code: "11", name: "서울", level: "metropolitan" }]),
  currentRegionCode: "11",
  welcomeDone: "1",
  theme: "light",
};

async function fetchSeoulCandidates() {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE}/api/election/candidates?regionCode=11&electionType=mayor`, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      })
      .on("error", reject);
  });
}

(async () => {
  const candidates = await fetchSeoulCandidates();
  const byName = (n) => candidates.find((c) => c.name === n);
  const jeong = byName("정원오");
  console.log(`Seoul candidates: ${candidates.length} | 정원오=${!!jeong}`);

  const ROUTES = [
    { path: "/", file: "01-election-home.png", scroll: 0, waitFor: "img" },
    {
      path: `/candidates/${jeong?.id ?? ""}`,
      file: "02-candidate-정원오.png",
      sessionSeed: jeong ? { key: `candidate_${jeong.id}`, value: jeong } : null,
      scroll: 0,
      waitFor: "img",
    },
    { path: "/members", file: "03-members.png", scroll: 200, waitFor: "img" },
    { path: "/bills", file: "04-bills-news.png", scroll: 400, waitFor: "main" },
    { path: "/community", file: "05-community.png", scroll: 0, waitFor: "main" },
    { path: "/welcome", file: "06-welcome-onboarding.png", scroll: 0, waitFor: "main" },
  ];

  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });

  for (const r of ROUTES) {
    const page = await browser.newPage();
    try {
      await page.setUserAgent(UA);
      await page.setViewport(VIEWPORT);

      await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.evaluate(
        (seed, ses) => {
          for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
          if (ses) sessionStorage.setItem(ses.key, JSON.stringify(ses.value));
        },
        SEED,
        r.sessionSeed
      );

      await page.goto(BASE + r.path, { waitUntil: "networkidle2", timeout: 60000 });
      if (r.waitFor) {
        await page.waitForSelector(r.waitFor, { timeout: 15000 }).catch(() => {});
      }
      await new Promise((res) => setTimeout(res, 2500));

      if (r.scroll) {
        await page.evaluate((y) => window.scrollTo(0, y), r.scroll);
        await new Promise((res) => setTimeout(res, 800));
      }

      const out = `${OUT}/${r.file}`;
      await page.screenshot({ path: out, fullPage: false });
      const sz = require("fs").statSync(out).size;
      console.log(`✓ ${r.path.slice(0, 50)} → ${r.file} (${(sz / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.error(`✗ ${r.path}: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
})();
