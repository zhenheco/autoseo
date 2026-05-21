根據以下設計規格和修改清單，重新設計 LP 前端 UI/UX：

**視覺風格定義：現代專業 (Modern Professional)**
核心理念：從目前的 'Cyberpunk-lite' 轉向 'Clean & Authoritative'。運用 Bento Box (便當盒佈局)、微細漸層 (Subtle Gradients) 與毛玻璃效果 (Glassmorphism)。

**配色方案 (Color Palette)**

- 主背景 (Background): `#020617` (極深藍黑)
- 次背景 (Surface): `#0F172A` (深石板藍)
- 主強色 (Primary): `#3B82F6` (科技亮藍)
- 次強色 (Accent): `#8B5CF6` (創意紫羅蘭)
- 成功色 (Success): `#10B981` (成長綠)
- 文字主色: `#F8FAFC` (接近純白)
- 文字次色: `#94A3B8` (灰色)

**字體規格 (Typography)**

- 標題 (Headings): Geist Sans 或 Inter (Bold, Tracking -0.02em)
- 內文 (Body): Plus Jakarta Sans 或 Inter (Regular/Medium, Line-height 1.6)

**關鍵區塊設計規格 (UX Specifications)**

- **A. Hero 區塊：** 大標題「10 分鐘生成排名前 1% 的 SEO 文章」，下方接小字描述與主按鈕。右側放置高品質產品操作錄影或 Interactive UI Mockup。主按鈕加入 `pulse-glow` 效果。
- **B. 功能區塊：Bento Grid (便當盒佈局)**。格 1 (大)：智慧關鍵字研究（動態關鍵字雲圖）。格 2 (中)：一鍵發佈到 WordPress（WordPress Logo 與同步動畫）。格 3 (小)：支援 50+ 語系。每個格子使用細微邊框漸層 (`border-gradient`)，滑鼠懸浮時卡片輕微上浮 (`hover-lift`)。
- **C. 數據證明 (Results) 區塊：** 使用簡單、動態生成的趨勢圖表顯示流量增加（綠色上升曲線，標記「使用 1WaySEO 後」）。捲動到此區塊時曲線緩慢畫出。
- **D. 定價方案：** Pro 方案放大 1.1 倍，加上「Most Popular」浮動標籤。按鈕使用漸層色，其他方案使用邊框色。增加「年繳/月繳」切換開關，動態顯示省下金額。

**視覺效果建議 (Special Effects)**

1.  **Noise Overlay:** 背景加入 `opacity: 0.03` 的雜訊紋理。
2.  **Ambient Glow:** 區塊背景後方放置模糊度極高 (blur-3xl) 的紫色或藍色圓球。
3.  **Skeleton Loading:** 所有數據或預覽圖加載前，使用細緻的骨架屏動畫。

**具體修改清單 (Action Items)**

1.  **更新 `tailwind.config.ts`：** 加入上述的新色碼與 `Geist` 字體。
2.  **重構 `HeroStory.tsx`：** 縮減敘事篇幅，將核心 CTA 與產品預覽圖放在首屏視覺中心。
3.  **組件化 Bento Grid：** 建立一個新的 `FeatureGrid.tsx` 取代目前的 `PainPoints.tsx`。
4.  **優化 Navbar：** 改為透明毛玻璃效果 (`backdrop-blur-md`)，滾動後變色。
