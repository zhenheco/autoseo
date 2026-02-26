你是一位資深 UI/UX 設計師兼前端工程師。你的任務是重新設計 1waySEO 的 Landing Page，修正目前嚴重的對比度和可讀性問題。

## 任務

重新設計 LP 首頁的所有 9 個組件，重點修復：

1. 對比度嚴重不足（深色背景 + 灰色文字 = 看不清）
2. 設計缺乏層次感和視覺吸引力
3. Terminal 模擬看起來很廉價
4. Feature Grid 圖示幾乎看不見

## 設計規範（強制遵守）

### 配色方案（SaaS Trust Blue 主題）

- Primary: #2563EB（Trust Blue）
- Secondary: #3B82F6（Light Blue）
- CTA Button: #F97316（Orange，高對比行動按鈕）
- Background: #F8FAFC（極淺灰白，主背景）
- Text: #1E293B（深灰近黑，正文文字）
- Muted Text: #475569（slate-600，最低可接受對比度）
- Border: #E2E8F0（淺灰邊框）
- Dark Section: 如果要用深色區塊，背景用 #0F172A（slate-900），文字用 #F8FAFC（白色）

### 對比度要求（WCAG AA 標準，強制！）

- 正文文字：最低 4.5:1 對比度
- 大標題：最低 3:1 對比度
- 禁止：灰色文字在深色背景上（如 #94A3B8 on #1a1a2e）
- 禁止：深色圖示在深色卡片上
- 深色區塊的文字必須是 white (#FFFFFF) 或 #F8FAFC
- 淺色區塊的文字必須是 #1E293B 或更深

### 字型

- Heading: font-bold, text-3xl ~ text-5xl
- Body: text-base ~ text-lg, leading-relaxed

### 風格方向

- 主要風格: Glassmorphism + Flat Design（SaaS 標準）
- Landing 結構: Hero → Features → Social Proof → Pricing → FAQ → CTA
- 整體調性: 專業、可信賴、現代，類似 Vercel/Linear/Stripe 的質感
- 深淺交替: sections 之間使用深淺背景交替，製造視覺節奏

### 絕對禁止

- 不使用 emoji 作為 icon（一律使用 Lucide React SVG icon）
- 不使用低對比度配色（灰色文字配深色底）
- 不使用 as any 型別斷言
- 不硬編碼任何中文文字（必須使用 useTranslations() 的 t() 函數）
- 不使用 scale transform 做 hover（會導致 layout shift）
- 不使用 bg-white/10 等低透明度背景在淺色模式

### Hover 與互動

- 所有可點擊元素加 cursor-pointer
- Hover 使用 color/shadow/border 變化，transition-colors duration-200
- 卡片 hover: shadow-lg + 邊框顏色加深

## 需要修改的檔案（9 個組件 + 1 個主頁面）

1. src/components/home/HeroStory.tsx — Hero 區：大標題 + 副標題 + CTA 按鈕 + 產品預覽
2. src/components/home/FeatureGrid.tsx — 9 大功能 Bento Grid
3. src/components/home/TurningPoint.tsx — 轉折故事
4. src/components/home/Results.tsx — 數據成果展示
5. src/components/home/SocialProof.tsx — 客戶見證
6. src/components/home/ThreeSteps.tsx — 三步驟使用說明
7. src/components/home/PricingStory.tsx — 定價方案（接收 plans + articlePackages props）
8. src/components/home/FAQSection.tsx — FAQ 手風琴
9. src/components/home/ClosingCTA.tsx — 結尾行動呼籲
10. src/app/home-client.tsx — 主頁面（組合以上組件 + Footer）

## 多語系規範（強制！）

- 本專案使用 next-intl，所有文字必須通過 useTranslations('home') 取得
- 翻譯 key 已存在於 src/messages/zh-TW.json 的 home 命名空間
- 不要新增新的 i18n key，使用現有的 key
- 不要修改任何 src/messages/\*.json 檔案
- 如果確實需要新 key，同時更新全部 7 個語言檔案：zh-TW, en-US, ja-JP, ko-KR, de-DE, es-ES, fr-FR

## 現有 i18n Key（可直接使用）

Hero: heroTagline, heroTitle1, heroTitle2, heroDescription, freeStart, freeCredits, noCreditCard
Features: features.keywordResearch, features.keywordResearchDesc, features.webResearch, features.webResearchDesc, features.competitorAnalysis, features.competitorAnalysisDesc, features.structureGeneration, features.structureGenerationDesc, features.aiWriting, features.aiWritingDesc, features.imageGeneration, features.imageGenerationDesc, features.linkOptimization, features.linkOptimizationDesc, features.aiSearchOptimization, features.aiSearchOptimizationDesc, features.autoPublish, features.autoPublishDesc
Stats: stats.users, stats.costSaving, stats.articleTime
Pricing: pricingPlan, lifetime, monthly, allAIModels, wordpressIntegration, autoImageGen, scheduledPublish, startUsing, mostPopular, creditsPackage, needMoreCredits, packageDesc, greatValue, buy
CTA: readyTo, upgradeStrategy, registerNow, freeStartUsing
Other: customerTestimonials, users, saySomething, seeHow, completeWorkflow, nineFeatures, fullAutomation, questionMark, terms, privacy, blog

## 技術要求

- React + TypeScript
- Tailwind CSS（使用現有的 Tailwind 設定）
- Lucide React 圖示庫（已安裝）
- next-intl useTranslations
- framer-motion 可選使用（已安裝）
- PricingStory 接收 { plans, articlePackages } props（類型從 @/types/pricing import PricingProps）
- 所有 import 路徑使用 @/ 別名

## Pre-Delivery Checklist（完成前必須自檢）

- 所有文字對比度大於等於 4.5:1（深色底用白字，淺色底用深色字）
- 沒有使用 emoji 作為 icon
- 所有可點擊元素有 cursor-pointer
- 所有文字使用 t() 函數，沒有硬編碼
- Hover 效果使用 transition，不用 scale
- 響應式：mobile (320px), tablet (768px), desktop (1440px)
- 沒有使用 as any
- Icon 使用 Lucide React（import { IconName } from 'lucide-react'）
- 每個 section 之間有清晰的視覺分隔（深淺交替或間距）
