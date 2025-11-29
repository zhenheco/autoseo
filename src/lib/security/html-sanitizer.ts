/**
 * HTML 清理工具
 * 使用 DOMPurify 防止 XSS 攻擊,同時保留文章所需的 HTML 標籤
 */

import DOMPurify from "dompurify";

/**
 * 文章 HTML 清理配置 - 寬鬆設定,保留所有文章格式
 */
const ARTICLE_CONFIG = {
  ALLOWED_TAGS: [
    // 標題
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // 段落和文字格式
    "p",
    "br",
    "hr",
    "div",
    "span",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "ins",
    "mark",
    "small",
    "sub",
    "sup",
    // 列表
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    // 引用和代碼
    "blockquote",
    "q",
    "cite",
    "code",
    "pre",
    "kbd",
    "samp",
    "var",
    // 連結和圖片
    "a",
    "img",
    "figure",
    "figcaption",
    // 表格
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "col",
    "colgroup",
    // 其他語義標籤
    "abbr",
    "address",
    "article",
    "aside",
    "details",
    "summary",
    "footer",
    "header",
    "main",
    "nav",
    "section",
    "time",
  ],
  ALLOWED_ATTR: [
    // 通用屬性
    "id",
    "class",
    "style",
    "title",
    "lang",
    "dir",
    // 連結
    "href",
    "target",
    "rel",
    // 圖片
    "src",
    "alt",
    "width",
    "height",
    "loading",
    // 表格
    "colspan",
    "rowspan",
    "headers",
    "scope",
    // 其他
    "datetime",
    "cite",
    "start",
    "reversed",
    "type",
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "base",
    "link",
    "meta",
  ],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onblur",
  ],
};

/**
 * 使用者輸入清理配置 - 嚴格設定,只保留基本格式
 */
const USER_INPUT_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "a"],
  ALLOWED_ATTR: ["href", "title"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
};

/**
 * 清理文章 HTML - 保留所有文章格式,只移除危險標籤
 *
 * @param dirty - 未清理的 HTML 字串
 * @returns 清理後的安全 HTML
 */
export function sanitizeArticleHtml(dirty: string): string {
  if (!dirty || typeof dirty !== "string") {
    return "";
  }

  return DOMPurify.sanitize(dirty, ARTICLE_CONFIG);
}

/**
 * 清理使用者輸入 - 嚴格清理,只保留基本格式
 *
 * @param dirty - 未清理的 HTML 字串
 * @returns 清理後的安全 HTML
 */
export function sanitizeUserInput(dirty: string): string {
  if (!dirty || typeof dirty !== "string") {
    return "";
  }

  return DOMPurify.sanitize(dirty, USER_INPUT_CONFIG);
}

/**
 * 基本 HTML 轉義 - 用於完全不允許 HTML 的場景
 *
 * @param unsafe - 未轉義的字串
 * @returns 轉義後的字串
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== "string") {
    return "";
  }

  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * URL 編碼 - 用於在 HTML 屬性中安全使用 URL
 *
 * @param url - 未編碼的 URL
 * @returns 編碼後的 URL
 */
export function escapeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }

  // 移除潛在的 javascript: 協議
  if (url.trim().toLowerCase().startsWith("javascript:")) {
    return "";
  }

  return encodeURI(url);
}

/**
 * 清理 JSON 字串以便安全地嵌入 HTML
 *
 * @param obj - 要序列化的物件
 * @returns 安全的 JSON 字串
 */
export function sanitizeJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  return escapeHtml(json);
}
