# 1wayseo Design System Tokens

Status: P0-1 token contract. Component inventory lands in P0-2.

## Source Files

- CSS tokens: `packages/web/src/styles/tokens.css`
- Global rules: `packages/web/src/app/globals.css`
- Tailwind bridge: `packages/web/tailwind.config.ts`
- CIS draft: `.cis/brand.json` and `.cis/web-style.md`

## Color Scales

All color variables store HSL channel values and are consumed as `hsl(var(--token))`.

| Role        | 50             | 100            | 200            | 300           | 400           | 500           | 600           | 700           | 800           | 900           | 950           |
| ----------- | -------------- | -------------- | -------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- |
| primary     | `214 100% 97%` | `214 95% 93%`  | `213 97% 87%`  | `212 96% 78%` | `213 94% 68%` | `217 91% 55%` | `221 83% 53%` | `224 76% 48%` | `226 71% 40%` | `224 64% 33%` | `226 57% 21%` |
| secondary   | `149 80% 96%`  | `149 80% 90%`  | `152 76% 80%`  | `156 72% 67%` | `158 68% 56%` | `150 70% 50%` | `158 64% 40%` | `160 70% 32%` | `162 71% 26%` | `163 69% 20%` | `164 86% 10%` |
| accent      | `270 100% 98%` | `269 100% 95%` | `269 100% 92%` | `269 97% 85%` | `270 95% 75%` | `270 91% 65%` | `271 81% 56%` | `272 72% 47%` | `273 67% 39%` | `274 66% 32%` | `276 67% 20%` |
| success     | `145 81% 96%`  | `140 84% 90%`  | `141 79% 85%`  | `142 77% 73%` | `142 69% 58%` | `142 71% 45%` | `142 76% 36%` | `142 72% 29%` | `143 64% 24%` | `144 61% 20%` | `145 80% 10%` |
| warning     | `48 100% 96%`  | `48 96% 89%`   | `48 97% 77%`   | `46 97% 65%`  | `43 96% 56%`  | `38 92% 50%`  | `32 95% 44%`  | `26 90% 37%`  | `23 83% 31%`  | `22 78% 26%`  | `21 92% 14%`  |
| destructive | `0 86% 97%`    | `0 93% 94%`    | `0 96% 89%`    | `0 94% 82%`   | `0 91% 71%`   | `0 84% 60%`   | `0 72% 51%`   | `0 74% 42%`   | `0 70% 35%`   | `0 63% 31%`   | `0 75% 15%`   |
| info        | `204 100% 97%` | `204 94% 94%`  | `201 94% 86%`  | `199 95% 74%` | `198 93% 60%` | `199 89% 48%` | `200 98% 39%` | `201 96% 32%` | `201 90% 27%` | `202 80% 24%` | `204 80% 16%` |

## Semantic Colors

| Token             | Light         | Dark          |
| ----------------- | ------------- | ------------- |
| `--bg-canvas`     | `48 29% 98%`  | `222 84% 5%`  |
| `--bg-surface`    | `0 0% 100%`   | `222 47% 8%`  |
| `--bg-elevated`   | `220 33% 99%` | `222 40% 12%` |
| `--text-primary`  | `221 39% 11%` | `210 40% 98%` |
| `--text-muted`    | `220 9% 35%`  | `215 20% 70%` |
| `--border-subtle` | `220 13% 91%` | `217 33% 18%` |
| `--border-strong` | `215 16% 47%` | `215 20% 55%` |

Compatibility aliases are kept for existing shadcn primitives: `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--border`, `--input`, and `--ring`.

## Typography

| Token            | Value                    |
| ---------------- | ------------------------ |
| `--font-display` | `clamp(32px, 5vw, 56px)` |
| `--font-h1`      | `clamp(28px, 4vw, 40px)` |
| `--font-h2`      | `clamp(24px, 3vw, 32px)` |
| `--font-h3`      | `clamp(20px, 2vw, 26px)` |
| `--font-body`    | `16px`                   |
| `--font-small`   | `14px`                   |
| `--font-tiny`    | `12px`                   |

CJK selectors `:lang(zh-Hant)`, `:lang(ja)`, and `:lang(ko)` bump body text to `18px`.

## Spacing

| Token        | Value   |
| ------------ | ------- |
| `--space-1`  | `4px`   |
| `--space-2`  | `8px`   |
| `--space-3`  | `12px`  |
| `--space-4`  | `16px`  |
| `--space-6`  | `24px`  |
| `--space-8`  | `32px`  |
| `--space-12` | `48px`  |
| `--space-16` | `64px`  |
| `--space-24` | `96px`  |
| `--space-32` | `128px` |

## Radius

| Token           | Value    |
| --------------- | -------- |
| `--radius-sm`   | `4px`    |
| `--radius-md`   | `8px`    |
| `--radius-lg`   | `12px`   |
| `--radius-xl`   | `16px`   |
| `--radius-full` | `9999px` |

## Shadow

| Token          | Use                       |
| -------------- | ------------------------- |
| `--shadow-sm`  | Low elevation controls    |
| `--shadow-md`  | Default card elevation    |
| `--shadow-lg`  | Active cards and menus    |
| `--shadow-xl`  | Overlays and large panels |
| `--shadow-2xl` | Modal surfaces            |

Dark mode swaps the shadow variables to lower-opacity glow and depth values.

## Z-Index

| Token          | Value |
| -------------- | ----- |
| `--z-dropdown` | `10`  |
| `--z-sticky`   | `20`  |
| `--z-header`   | `30`  |
| `--z-overlay`  | `40`  |
| `--z-modal`    | `50`  |
| `--z-popover`  | `60`  |
| `--z-toast`    | `70`  |

## Motion

| Token            | Value                           |
| ---------------- | ------------------------------- |
| `--ease-out`     | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-in-out`  | `cubic-bezier(0.4, 0, 0.2, 1)`  |
| `--duration-150` | `150ms`                         |
| `--duration-200` | `200ms`                         |
| `--duration-300` | `300ms`                         |
| `--duration-500` | `500ms`                         |

`prefers-reduced-motion: reduce` forces animation and transition durations to `0ms`.

## Usage Snippets

Use Tailwind token classes for product UI:

```tsx
<section className="bg-bg-canvas text-text-primary">
  <div className="rounded-lg border border-border-subtle bg-bg-surface shadow-md">
    <h2 className="text-h2">Content flywheel</h2>
    <p className="text-body text-text-muted">
      Review trend, article, and card output.
    </p>
  </div>
</section>
```

Use raw CSS variables only in shared CSS:

```css
.workflow-panel {
  background: hsl(var(--bg-surface));
  border: 1px solid hsl(var(--border-subtle));
  box-shadow: var(--shadow-md);
}
```

Use scales for state and emphasis:

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary-600">
  Publish
</button>
```

## Component Inventory

The web app exports shadcn baseline primitives and project-specific components
from `packages/web/src/components/ui`.

Baseline primitives:

- `Button`
- `Input`
- `Select`
- `Dialog`
- `Toast`
- `Card`
- `Badge`
- `Tabs`
- `DropdownMenu`
- `Tooltip`
- `Skeleton`

## StatBadge

Pricing savings badge for messages such as "Save $94/year".

| Prop       | Type                   | Required | Notes                   |
| ---------- | ---------------------- | -------- | ----------------------- |
| `amount`   | `string`               | Yes      | Rendered after "Save".  |
| `emphasis` | `"normal" \| "strong"` | No       | Defaults to `"normal"`. |

```tsx
import { StatBadge } from "@/components/ui";

export function PricingSaveLabel() {
  return <StatBadge amount="$94/year" emphasis="strong" />;
}
```

Token usage: normal uses `secondary-50`, `secondary-200`, and
`secondary-800`; strong uses `primary` and `primary-foreground`.

## EmptyState

Generic empty-list state for dashboards and management tables.

| Prop          | Type                                 | Required | Notes              |
| ------------- | ------------------------------------ | -------- | ------------------ |
| `icon`        | `ReactNode`                          | No       | Decorative icon.   |
| `title`       | `string`                             | Yes      | Main heading.      |
| `description` | `string`                             | No       | Short helper copy. |
| `action`      | `{ label: string; onClick(): void }` | No       | Primary action.    |

```tsx
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui";

export function EmptyArticles() {
  return (
    <EmptyState
      icon={<FileText className="h-5 w-5" />}
      title="No articles yet"
      description="Generate your first SEO article."
      action={{ label: "Create article", onClick: () => undefined }}
    />
  );
}
```

Token usage: uses `bg-surface`, `bg-elevated`, `border-subtle`,
`text-primary`, and `text-muted`.

## PageHeader

Responsive dashboard page header with title, description, and action column.

| Prop          | Type        | Required | Notes                  |
| ------------- | ----------- | -------- | ---------------------- |
| `title`       | `string`    | Yes      | Page title.            |
| `description` | `string`    | No       | Secondary header copy. |
| `actions`     | `ReactNode` | No       | Buttons or filters.    |

```tsx
import { Button, PageHeader } from "@/components/ui";

export function ArticlesHeader() {
  return (
    <PageHeader
      title="Articles"
      description="Review generated drafts and scheduled publishing."
      actions={<Button type="button">New article</Button>}
    />
  );
}
```

Token usage: uses `border-subtle`, `text-primary`, and `text-muted`.

## MetricCard

Dashboard KPI tile for values, trends, and optional icons.

| Prop    | Type                                                 | Required | Notes            |
| ------- | ---------------------------------------------------- | -------- | ---------------- |
| `label` | `string`                                             | Yes      | KPI label.       |
| `value` | `ReactNode`                                          | Yes      | KPI value.       |
| `delta` | `{ value: string; trend: "up" \| "down" \| "flat" }` | No       | Trend chip.      |
| `icon`  | `ReactNode`                                          | No       | Supporting icon. |

```tsx
import { FileText } from "lucide-react";
import { MetricCard } from "@/components/ui";

export function ArticleMetric() {
  return (
    <MetricCard
      label="Articles"
      value="128"
      delta={{ value: "+12%", trend: "up" }}
      icon={<FileText className="h-5 w-5" />}
    />
  );
}
```

Token usage: card surface uses `bg-surface` and `border-subtle`;
trend chips use `success-50`, `destructive-50`, or `muted`.

## GoldenSlotPicker

Picker for the three fixed Taiwan publishing slots: 09:00, 14:00, and 20:00.

| Prop       | Type                         | Required | Notes                  |
| ---------- | ---------------------------- | -------- | ---------------------- |
| `value`    | `GoldenSlot`                 | No       | Selected slot.         |
| `onChange` | `(slot: GoldenSlot) => void` | Yes      | Called with slot data. |
| `locale`   | `string`                     | No       | Defaults to `zh-TW`.   |

```tsx
import { GoldenSlotPicker } from "@/components/ui";

export function ScheduleSlots() {
  return (
    <GoldenSlotPicker
      locale="en-US"
      onChange={(slot) => {
        console.log(slot.utcHour);
      }}
    />
  );
}
```

Token usage: unselected slots use `bg-surface`, `border-subtle`, and
`text-primary`; selected slots use `primary-50`, `primary-800`, and `primary`.

## TrialCountdown

Trial banner that appears only during the final seven days before expiry.

| Prop          | Type         | Required | Notes                    |
| ------------- | ------------ | -------- | ------------------------ |
| `trialEndsAt` | `Date`       | Yes      | End timestamp.           |
| `onUpgrade`   | `() => void` | Yes      | Upgrade button callback. |

```tsx
import { TrialCountdown } from "@/components/ui";

export function TrialBanner() {
  return (
    <TrialCountdown
      trialEndsAt={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)}
      onUpgrade={() => undefined}
    />
  );
}
```

Token usage: days 1-7 use warning tokens; day 0 uses
`destructive-50`, `destructive-300`, and `destructive-900`.

## BrandSwitcher

Pinned dashboard-header dropdown for switching the active brand.

| Prop            | Type                             | Required | Notes             |
| --------------- | -------------------------------- | -------- | ----------------- |
| `brands`        | `{ id: string; name: string }[]` | Yes      | Dropdown options. |
| `activeBrandId` | `string`                         | Yes      | Current brand id. |
| `onSwitch`      | `(id: string) => void`           | Yes      | Called on change. |

```tsx
import { BrandSwitcher } from "@/components/ui";

export function DashboardBrandSwitcher() {
  return (
    <BrandSwitcher
      brands={[
        { id: "brand-1", name: "Northwind" },
        { id: "brand-2", name: "Contoso" },
      ]}
      activeBrandId="brand-1"
      onSwitch={() => undefined}
    />
  );
}
```

Token usage: wrapper uses `bg-surface`, `border-subtle`, and `z-header`;
the dropdown uses `background`, `input`, `text-primary`, and `ring`.
