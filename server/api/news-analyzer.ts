import * as cheerio from "cheerio";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

interface NewsAnalysisResult {
  summary: string;
  background: string;
  relatedTopics: string[];
  otherPerspectives: string;
  title: string;
}

/**
 * 주어진 뉴스 URL에서 제목과 본문을 스크래핑합니다.
 */
export async function scrapeNewsArticle(url: string): Promise<{ title: string; content: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 공통 및 주요 언론사별 본문 선택자 (우선순위 순)
    const selectors = [
      ".story-news",        // 연합뉴스
      ".article_cont",      // SBS
      "#dic_area",          // 네이버 뉴스
      "#articeBody",        // 일반적인 언론사 (오타 포함)
      "#articleBody",       // 일반적인 언론사
      ".article_view",      // 다음 뉴스
      ".news_txt",          // MBC
      "#cont_newstext",     // KBS
      ".article-body",      // 조선일보, 동아일보 등
      "article",            // HTML5 표준
      ".news_body",
      ".story-body",
      "[itemprop='articleBody']",
      "main"
    ];

    let content = "";
    for (const selector of selectors) {
      const el = $(selector);
      if (el.length > 0) {
        content = el.text().trim();
        if (content.length > 200) {
          break; // 의미 있는 길이의 본문을 찾으면 중단
        }
      }
    }

    // 폴백: 스크래핑에 실패한 경우 p 태그들 모음
    if (!content || content.length < 200) {
      const paragraphs: string[] = [];
      $("p").each((_, p) => {
        const text = $(p).text().trim();
        if (text.length > 30) {
          paragraphs.push(text);
        }
      });
      content = paragraphs.join("\n");
    }

    // 제목 추출
    const title = $("meta[property='og:title']").attr("content") || $("title").text() || "";

    return { title: title.trim(), content: content.replace(/\s+/g, " ").trim() };
  } catch (error) {
    console.error("[news-analyzer] Scraping error:", error);
    throw error;
  }
}

/**
 * 기사 제목(+본문 선택)을 바탕으로 LLM을 통해 다각도 분석을 수행합니다.
 * content가 비어 있어도 제목만으로 분석합니다.
 */
export async function analyzeNewsWithAI(title: string, content: string, source?: string): Promise<NewsAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const hasContent = content && content.length >= 200;

  // 본문이 너무 길면 자르기 (토큰 제한 방지)
  const maxContentLength = 4000;
  const truncatedContent = hasContent
    ? (content.length > maxContentLength ? content.slice(0, maxContentLength) + "..." : content)
    : "";

  const sourceNote = source ? `출처: ${source}` : "";

  const contentSection = hasContent
    ? `\n[기사 본문]\n${truncatedContent}\n`
    : `\n(본문을 가져올 수 없어 제목만으로 분석합니다. 제목에 나타난 사건·인물·정책을 바탕으로 배경지식과 관점을 최대한 풍부하게 서술해주세요.)\n`;

  const prompt = `
당신은 중립적이고 분석적인 한국 정치 뉴스 에디터입니다.
아래 뉴스 기사를 읽고 구조화된 JSON 형태로 분석 결과를 제공해주세요.
반드시 마크다운 코드블록 없이 순수한 JSON 문자열만 반환해야 합니다.

[기사 제목]
${title}
${sourceNote}
${contentSection}
[요청 사항]
다음 4가지 항목을 포함하는 JSON 객체를 생성하세요.
1. summary (string): 기사(또는 제목)의 핵심 내용 요약 (2~4문장)
2. background (string): 이 기사가 나오게 된 배경, 맥락, 사전 지식
3. relatedTopics (string[]): 독자가 찾아볼 만한 추가 키워드 3~4개
4. otherPerspectives (string): 이 사안에 대해 다른 입장에서 바라보는 엇갈린 시각과 관점

응답 JSON 예시:
{
  "summary": "...",
  "background": "...",
  "relatedTopics": ["...", "..."],
  "otherPerspectives": "..."
}
`;

  try {
    const googleAI = createGoogleGenerativeAI({
      apiKey,
    });

    const { text } = await generateText({
      model: googleAI("gemini-2.0-flash"),
      prompt,
      maxRetries: 2,
    });

    let jsonStr = text.trim();
    if (jsonStr.startsWith("\`\`\`json")) {
      jsonStr = jsonStr.replace(/^\`\`\`json\n/, "").replace(/\n\`\`\`$/, "");
    }
    if (jsonStr.startsWith("\`\`\`")) {
      jsonStr = jsonStr.replace(/^\`\`\`\n?/, "").replace(/\n?\`\`\`$/, "");
    }
    
    // JSON 파싱 시도
    let parsed;
    try {
      parsed = JSON.parse(jsonStr) as Omit<NewsAnalysisResult, "title">;
    } catch {
      // 파싱 실패시 재시도 패턴 매칭...
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Invalid output format");
      }
    }
    
    return {
      title,
      summary: parsed.summary,
      background: parsed.background,
      relatedTopics: parsed.relatedTopics || [],
      otherPerspectives: parsed.otherPerspectives,
    };
  } catch (error: any) {
    console.error("[news-analyzer] LLM error:", error);
    // Rate limit 에러 구분
    const errMsg = error?.message || "";
    if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) {
      throw new Error("API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.");
    }
    throw new Error("AI 분석 중 오류가 발생했습니다.");
  }
}
