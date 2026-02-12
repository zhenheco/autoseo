/**
 * 共用 Prompt 工具函數
 * 統一語言指示、Topic Alignment 等跨 Agent 共用的 prompt 構建邏輯
 */
import { LOCALE_FULL_NAMES } from "@/lib/i18n/locales";
import type { ContentContext } from "@/types/agents";

/**
 * 各語系特有的文化寫作指導
 */
const LOCALE_WRITING_GUIDES: Record<string, string> = {
  "zh-TW":
    "使用繁體中文書寫，語氣專業但親切。避免使用簡體中文用語，以台灣讀者習慣的表達方式為主。",
  "zh-CN": "使用简体中文书写，语气专业且符合中国大陆读者习惯。",
  "en-US":
    "Write in American English. Use clear, direct sentences. Prefer active voice.",
  "ja-JP":
    "日本語で丁寧語（です・ます調）を基本とし、読者に敬意を持った文体で書いてください。専門用語にはカタカナまたは括弧付きの英語を併記してください。",
  "ko-KR":
    "한국어로 작성하세요. 격식체(합니다체)를 기본으로 사용하고, 독자에게 존경을 표하는 문체로 작성하세요.",
  "de-DE":
    "Schreiben Sie auf Deutsch. Verwenden Sie die Sie-Form und einen professionellen, aber zugänglichen Ton.",
  "es-ES":
    "Escriba en español. Use un tono profesional pero accesible. Prefiera el español neutro cuando sea posible.",
  "fr-FR":
    "Écrivez en français. Utilisez le vouvoiement et un ton professionnel mais accessible.",
  "vi-VN":
    "Viết bằng tiếng Việt. Sử dụng ngôn ngữ chuyên nghiệp nhưng gần gũi với người đọc.",
  "ms-MY":
    "Tulis dalam Bahasa Melayu. Gunakan nada profesional tetapi mesra pembaca.",
  "th-TH": "เขียนเป็นภาษาไทย ใช้ภาษาที่เป็นทางการแต่เข้าถึงง่ายสำหรับผู้อ่าน",
  "id-ID":
    "Tulis dalam Bahasa Indonesia. Gunakan nada profesional namun mudah dipahami.",
  "tl-PH":
    "Sumulat sa Filipino. Gumamit ng propesyonal ngunit madaling maintindihan na tono.",
  "pt-PT": "Escreva em português. Use um tom profissional mas acessível.",
  "it-IT":
    "Scriva in italiano. Usi un tono professionale ma accessibile. Preferisca il Lei come forma di cortesia.",
  "ru-RU":
    "Пишите на русском языке. Используйте профессиональный, но доступный тон. Обращайтесь к читателю на «вы».",
  "ar-SA": "اكتب باللغة العربية الفصحى. استخدم أسلوبًا مهنيًا ولكن سهل الفهم.",
  "hi-IN": "हिंदी में लिखें। पेशेवर लेकिन सुलभ भाषा का प्रयोग करें।",
};

/**
 * 建構統一的語言指示區塊
 * 取代各 Agent 中重複的 CRITICAL 語言指示
 *
 * @param locale 語系代碼（如 "zh-TW"、"en-US"）
 * @returns 語言指示 prompt 字串
 */
export function buildLanguageInstructions(locale: string): string {
  const languageName = LOCALE_FULL_NAMES[locale] || locale;
  const writingGuide =
    LOCALE_WRITING_GUIDES[locale] || `Write all content in ${languageName}.`;

  return `**Language: ${languageName}**
${writingGuide}`;
}

/**
 * 建構精簡版 Topic Alignment 區塊
 * 取代各 Agent 中 ~20 行的 buildTopicAlignmentSection()
 *
 * @param contentContext 文章上下文
 * @returns Topic alignment prompt 字串（1-2 行）
 */
export function buildTopicAlignment(contentContext?: ContentContext): string {
  if (!contentContext) {
    return "";
  }

  return `Topic: ${contentContext.primaryKeyword} | Intent: ${contentContext.searchIntent || "informational"} | Audience: ${contentContext.targetAudience || "general"}`;
}

/**
 * 計算文字數（支援中英混合內容）
 * 中文以字符數計算，英文以空格分詞計算
 *
 * @param text Markdown 或純文字內容
 * @returns 字數
 */
export function countWords(text: string): number {
  const plainText = text
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/[#*`]/g, "")
    .trim();

  const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;

  const nonChineseText = plainText.replace(/[\u4e00-\u9fa5]/g, "");
  const englishWords = nonChineseText.trim()
    ? nonChineseText.trim().split(/\s+/).length
    : 0;

  if (chineseChars > englishWords) {
    return chineseChars;
  }
  return Math.max(chineseChars + englishWords, 1);
}
