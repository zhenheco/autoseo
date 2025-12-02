# 文章生成流程問題清單

## 問題 1: 產業資訊遺失

**現象**:

```
[Orchestrator] 🌐 Website Settings: { language: 'zh-TW', region: '台灣', industry: null }
[ResearchAgent] ResearchAgent started { input: { title: '...', region: undefined }
```

**問題**: 使用者選擇的產業 (industry) 和地區 (region) 在傳遞過程中遺失。

---

## 問題 2: finish_reason 強制停止

**現象**:

```
"finish_reason": "stop"
```

**問題**: 需要查明為何 AI 回應被強制停止。

---

## 問題 3: StrategyAgent 分析來源錯誤

**現象**:

```
[StrategyAgent] Raw title response: {
  preview: '首先，用户要求我作为精通国际市场的SEO专家，根据搜索结果...'
}
[StrategyAgent] Failed to parse full content as JSON: SyntaxError: Unexpected token '首'
```

**問題**:

1. StrategyAgent 不應該「根據搜尋結果」分析，應該針對 ResearchAgent 的總結或外部網站的 title 做分析
2. AI 回應格式錯誤，沒有返回 JSON

---

## 問題 4: 標題不應等於關鍵字

**現象**:

```
title: '哪一個ai寫程式比較好用'
```

**問題**: 系統直接拿使用者輸入的關鍵字當標題，應該讓 AI 生成更吸引人的標題。

---

## 問題 5: 標題與目標關鍵字重複

**現象**:

```
文章标题：哪一個ai寫程式比較好用
目标关键字：哪一個ai寫程式比較好用
```

**問題**: 標題和目標關鍵字不應該完全一樣。

---

## 問題 6: ContentPlanAgent JSON 解析失敗

**現象**:

```
[ContentPlanAgent] ⚠️ Regex extraction found JSON but parse failed: SyntaxError: Unexpected non-whitespace character after JSON at position 82
[ContentPlanAgent] ❌ All parsing attempts failed
```

**問題**: AI 返回的 JSON 格式有問題，導致解析失敗。

---

## 問題 7: Section 內容過於制式化

**現象**:

```
'Key points to visualize:\n' +
'基本定義與原理\n' +
'必要工具與資源\n' +
'初始設定步驟\n'
```

**問題**: H2 sections 內容過於制式化，應該讓 AI 自行決定分析要寫什麼。

---

## 問題 8: SectionAgent fetch 錯誤

**現象**:

```
[SectionAgent] AI completion failed { error: Error: AI completion failed: fetch failed }
[Orchestrator] SectionAgent failed after 1 attempts { error: 'AI completion failed: fetch failed' }
[Orchestrator] ❌ Multi-agent flow failed, falling back to legacy
```

**問題**:

1. SectionAgent 的 API 請求失敗
2. 失敗後 fallback 到 legacy 模式，應該修復讓 multi-agent flow 能完成

---

## 問題 9: HTMLAgent styled boxes 錯誤

**現象**:

```
[HTMLAgent] ⚠️ Failed to add styled boxes, continuing... TypeError: Cannot destructure property 'firstElementChild' of 'documentElement' as it is null.
[HTMLAgent] ⚠️ Cannot access document.body (documentElement may be null), using full HTML
```

**問題**: HTML 解析時 documentElement 為 null。

---

## 問題 10: tokenUsage 屬性缺失

**現象**:

```
[Orchestrator] image: ⚠️ executionInfo 中沒有 tokenUsage 屬性
```

**問題**: executionInfo 物件中缺少 tokenUsage 屬性。

---

## 優先級排序

| 優先級 | 問題                                   | 影響                           |
| ------ | -------------------------------------- | ------------------------------ |
| P0     | 問題 8: SectionAgent fetch 錯誤        | 導致整個 multi-agent flow 失敗 |
| P0     | 問題 1: 產業資訊遺失                   | 影響文章相關性                 |
| P1     | 問題 3: StrategyAgent 分析來源錯誤     | 影響標題品質                   |
| P1     | 問題 4/5: 標題等於關鍵字               | SEO 效果差                     |
| P1     | 問題 6: ContentPlanAgent JSON 解析失敗 | 影響內容規劃                   |
| P2     | 問題 7: Section 內容制式化             | 影響內容品質                   |
| P2     | 問題 9: HTMLAgent 錯誤                 | 影響 HTML 美化                 |
| P3     | 問題 2: finish_reason 調查             | 需要診斷                       |
| P3     | 問題 10: tokenUsage 缺失               | 只影響統計                     |
