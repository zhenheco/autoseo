# 文章列表 UI 改進

## MODIFIED Requirements

### Requirement: 文章列表文字層級

文章列表中的標題 MUST 比 meta 資料更醒目。

#### Scenario: 標題文字大小

**Given** 文章列表項目
**When** 渲染文章標題
**Then** 標題應使用：

- `text-base` (16px 字體大小)
- `font-semibold` (600 字重)
- `truncate` (超長截斷)

**Before**:

```typescript
<h3 className="text-sm font-medium truncate">{item.title}</h3>
```

**After**:

```typescript
<h3 className="text-base font-semibold truncate">{item.title}</h3>
```

#### Scenario: Meta 資料文字大小

**Given** 文章列表項目的 meta 資料（日期、字數、品質分數）
**When** 渲染 meta 資料
**Then** 應使用：

- `text-xs` (12px 字體大小)
- `text-muted-foreground` (次要顏色)

**Before**:

```typescript
<div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
```

**After**:

```typescript
<div className="flex gap-3 text-xs text-muted-foreground mt-1">
```

### Requirement: 視覺層級一致性

標題和 meta 資料 MUST 維持清晰的視覺層級。

#### Scenario: 字體大小對比

**Given** 完整的文章列表項目
**Then** 文字大小層級應為：

- 標題：16px (text-base)
- Meta 資料：12px (text-xs)
- 比例：1.33:1

#### Scenario: 字重對比

**Given** 完整的文章列表項目
**Then** 字重層級應為：

- 標題：600 (font-semibold)
- Meta 資料：400 (normal，預設)

## 實作細節

### 修改檔案

- `src/app/(dashboard)/dashboard/articles/page.tsx`
  - 第 265 行：標題從 `text-sm font-medium` 改為 `text-base font-semibold`
  - 第 271 行：meta 容器從 `text-[10px]` 改為 `text-xs`

### CSS 變更

```diff
- <h3 className="text-sm font-medium truncate">{item.title}</h3>
+ <h3 className="text-base font-semibold truncate">{item.title}</h3>

- <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
+ <div className="flex gap-3 text-xs text-muted-foreground mt-1">
```

### 可訪問性

- 標題 16px 符合 WCAG 可讀性建議
- Meta 資料 12px 為次要資訊的最小建議大小
- 保持充足的行高和間距

### 響應式

在所有螢幕尺寸保持相同的文字大小，確保一致性
