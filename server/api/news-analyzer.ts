import * as cheerio from "cheerio";
import { callLLMJson, LLMConfigError, LLMTransientError } from "../utils/llm-wrapper";

interface NewsAnalysisResult {
  summary: string;
  background: string;
  relatedTopics: string[];
  otherPerspectives: string;
  title: string;
}

const SYSTEM_PROMPT =
  "당신은 중립적이고 분석적인 한국 정치 뉴스 에디터입니다. " +
  "반드시 아래 JSON 스키마만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.\n" +
  '{"summary":"기사 핵심 내용 2-4문장","background":"배경과 맥락","relatedTopics":["키워드1","키워드2","키워드3"],"otherPerspectives":"엇갈린 시각"}';

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
          break;
        }
      }
    }

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

    const title = $("meta[property='og:title']").attr("content") || $("title").text() || "";

    return { title: title.trim(), content: content.replace(/\s+/g, " ").trim() };
  } catch (error) {
    console.error("[news-analyzer] Scraping error:", error);
    throw error;
  }
}

/**
 * 기사 제목(+본문 선택)을 바탕으로 Groq(LLaMA3)를 통해 다각도 분석을 수행합니다.
 */
export async function analyzeNewsWithAI(title: string, content: string, source?: string): Promise<NewsAnalysisResult> {
  const hasContent = content && content.length >= 200;
  const maxContentLength = 4000;
  const truncatedContent = hasContent
    ? (content.length > maxContentLength ? content.slice(0, maxContentLength) + "..." : content)
    : "";

  const sourceNote = source ? `출처: ${source}` : "";
  const contentSection = hasContent
    ? `\n[기사 본문]\n${truncatedContent}\n`
    : `\n(본문을 가져올 수 없어 제목만으로 분석합니다. 제목에 나타난 사건·인물·정책을 바탕으로 배경지식과 관점을 최대한 풍부하게 서술해주세요.)\n`;

  const userContent = `[기사 제목]\n${title}\n${sourceNote}${contentSection}`;

  try {
    const parsed = await callLLMJson<Omit<NewsAnalysisResult, "title">>({
      system: SYSTEM_PROMPT,
      user: userContent,
      temperature: 0.4,
      maxTokens: 800,
      label: "news/analyze",
    });

    return {
      title,
      summary: parsed.summary,
      background: parsed.background,
      relatedTopics: parsed.relatedTopics || [],
      otherPerspectives: parsed.otherPerspectives,
    };
  } catch (error) {
    if (error instanceof LLMConfigError) {
      throw new Error("GROQ_API_KEY가 설정되지 않았습니다.");
    }
    if (error instanceof LLMTransientError && error.status === 429) {
      throw new Error("API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.");
    }
    throw new Error("AI 분석 중 오류가 발생했습니다.");
  }
}
