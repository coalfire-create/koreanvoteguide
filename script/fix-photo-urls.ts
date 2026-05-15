/**
 * DB에 저장된 의원 이미지 URL을 검증하고 잘못된 주소를 수정합니다.
 * 실행: npm run fix:photos
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { legislators } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import axios from "axios";

const BATCH = 10;
const DELAY_MS = 300;
const UA = "KoreanVoteGuide/1.0 (admin@antigravity.kr)";

const standardUrl = (monaCd: string) =>
  `https://www.assembly.go.kr/static/portal/img/open_assm/${monaCd}.jpg`;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function isValid(url: string): Promise<boolean> {
  try {
    const res = await axios.head(url, {
      timeout: 6000,
      headers: { "User-Agent": UA },
      validateStatus: (s) => s === 200,
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  const rows = await db
    .select({ monaCd: legislators.monaCd, name: legislators.name, photoUrl: legislators.photoUrl })
    .from(legislators);

  console.log(`\n[fix-photo-urls] 총 ${rows.length}명 검사 시작\n`);

  let fixed = 0;
  let invalid = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (row) => {
        // 1. http → https 정규화
        let url = (row.photoUrl || "").replace(/^http:\/\//, "https://");

        // 2. 비어있으면 MONA_CD 기반 표준 주소로 채우기
        if (!url && /^\d+$/.test(row.monaCd)) {
          url = standardUrl(row.monaCd);
        }

        // 3. 현재 URL 유효성 검사
        const valid = url ? await isValid(url) : false;

        if (!valid) {
          // 4. 표준 MONA_CD 주소로 대체 시도
          const fallback = /^\d+$/.test(row.monaCd) ? standardUrl(row.monaCd) : null;
          if (fallback && fallback !== url) {
            if (await isValid(fallback)) {
              url = fallback;
            } else {
              console.log(`  ✗ ${row.name} (${row.monaCd}): 유효한 이미지 URL 없음`);
              invalid++;
              return;
            }
          } else {
            console.log(`  ✗ ${row.name} (${row.monaCd}): 유효한 이미지 URL 없음`);
            invalid++;
            return;
          }
        }

        // 5. 변경이 필요한 경우에만 업데이트
        if (url !== row.photoUrl) {
          await db
            .update(legislators)
            .set({ photoUrl: url })
            .where(eq(legislators.monaCd, row.monaCd));
          console.log(`  ✓ ${row.name}: ${row.photoUrl || "(빈 값)"} → ${url}`);
          fixed++;
        }
      })
    );

    const done = Math.min(i + BATCH, rows.length);
    console.log(`  진행: ${done}/${rows.length}`);

    if (i + BATCH < rows.length) await sleep(DELAY_MS);
  }

  console.log(`\n[fix-photo-urls] 완료`);
  console.log(`  수정: ${fixed}명`);
  console.log(`  유효한 이미지 없음: ${invalid}명`);
  console.log(`  정상: ${rows.length - fixed - invalid}명\n`);
}

main().catch(console.error).finally(() => process.exit(0));
