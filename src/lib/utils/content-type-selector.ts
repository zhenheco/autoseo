export interface ContentTypeConfig {
  type: string;
  style: string;
  structure: string;
}

export const CONTENT_TYPES: ContentTypeConfig[] = [
  {
    type: "教學攻略",
    style: "step-by-step詳細教學",
    structure: "問題分析 → 解決步驟 → 實用技巧 → 常見問題",
  },
  {
    type: "推薦清單",
    style: "精選推薦列表，包含評比",
    structure: "推薦標準 → 詳細清單 → 比較分析 → 選擇建議",
  },
  {
    type: "比較分析",
    style: "深度比較不同選項",
    structure: "比較維度 → 詳細對比 → 優缺點分析 → 選擇建議",
  },
  {
    type: "新聞趨勢",
    style: "最新趨勢分析",
    structure: "趨勢背景 → 現況分析 → 影響評估 → 未來預測",
  },
  {
    type: "How-to指南",
    style: "實用操作指南",
    structure: "問題定義 → 準備工作 → 操作步驟 → 結果驗證",
  },
];

export function selectContentType(userType?: string): ContentTypeConfig {
  if (userType) {
    const matched = CONTENT_TYPES.find(
      (ct) =>
        ct.type === userType ||
        ct.type.toLowerCase().includes(userType.toLowerCase()),
    );
    if (matched) {
      return matched;
    }
  }

  const randomIndex = Math.floor(Math.random() * CONTENT_TYPES.length);
  return CONTENT_TYPES[randomIndex];
}

export function getContentTypeByKeyword(keyword: string): ContentTypeConfig {
  const lowerKeyword = keyword.toLowerCase();

  if (
    lowerKeyword.includes("如何") ||
    lowerKeyword.includes("怎麼") ||
    lowerKeyword.includes("教學") ||
    lowerKeyword.includes("步驟")
  ) {
    return CONTENT_TYPES.find((ct) => ct.type === "How-to指南")!;
  }

  if (
    lowerKeyword.includes("推薦") ||
    lowerKeyword.includes("最佳") ||
    lowerKeyword.includes("top") ||
    lowerKeyword.includes("排名")
  ) {
    return CONTENT_TYPES.find((ct) => ct.type === "推薦清單")!;
  }

  if (
    lowerKeyword.includes("比較") ||
    lowerKeyword.includes("vs") ||
    lowerKeyword.includes("差異") ||
    lowerKeyword.includes("哪個好")
  ) {
    return CONTENT_TYPES.find((ct) => ct.type === "比較分析")!;
  }

  if (
    lowerKeyword.includes("趨勢") ||
    lowerKeyword.includes("2024") ||
    lowerKeyword.includes("2025") ||
    lowerKeyword.includes("最新")
  ) {
    return CONTENT_TYPES.find((ct) => ct.type === "新聞趨勢")!;
  }

  return selectContentType();
}
