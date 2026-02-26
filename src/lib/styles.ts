/**
 * 共用的 CSS 類別組合
 * 統一管理重複出現的樣式組合
 */

import { cn } from "@/lib/utils";

// 卡片樣式變體
export const cardStyles = {
  base: "bg-gradient-to-br from-mp-surface/80 to-mp-surface/60 backdrop-blur-xl rounded-3xl border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
  primary:
    "border-mp-primary/20 hover:border-mp-primary/40 hover:shadow-mp-primary/10",
  accent:
    "border-mp-accent/20 hover:border-mp-accent/40 hover:shadow-mp-accent/10",
  success:
    "border-mp-success/20 hover:border-mp-success/40 hover:shadow-mp-success/10",
};

// 圖示容器樣式
export const iconContainerStyles = {
  base: "flex items-center justify-center rounded-xl",
  small: "w-12 h-12 rounded-xl",
  medium: "w-14 h-14 rounded-2xl",
  large: "w-16 h-16 rounded-2xl",
  primary: "bg-mp-primary/20 text-mp-primary",
  accent: "bg-mp-accent/20 text-mp-accent",
  success: "bg-mp-success/20 text-mp-success",
};

// 標題樣式
export const headingStyles = {
  hero: "text-3xl md:text-5xl font-bold font-geist text-mp-text",
  section: "text-xl font-bold text-mp-text",
  card: "text-2xl font-bold text-mp-text",
};

// 文字樣式
export const textStyles = {
  primary: "text-mp-text",
  secondary: "text-mp-text-secondary",
  body: "font-jakarta leading-relaxed",
  small: "text-sm",
  xs: "text-xs",
};

// 按鈕樣式
export const buttonStyles = {
  primary:
    "group relative px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-mp-primary to-mp-accent hover:from-mp-primary/90 hover:to-mp-accent/90 rounded-xl shadow-lg shadow-mp-primary/25 hover:shadow-xl hover:shadow-mp-primary/30 transition-all duration-200 hover:-translate-y-0.5",
  secondary:
    "px-4 py-2 text-sm font-medium text-mp-text-secondary hover:text-mp-text border border-mp-surface hover:border-mp-primary/50 rounded-xl backdrop-blur-sm transition-all duration-200 hover:bg-mp-surface/30",
  outline:
    "border border-mp-primary/50 text-mp-text hover:bg-mp-primary/10 hover:border-mp-primary rounded-2xl font-semibold text-sm transition-all duration-200",
};

// 漸變文字
export const gradientTextStyles = {
  primary:
    "text-transparent bg-clip-text bg-gradient-to-r from-mp-primary to-mp-accent",
  success:
    "text-transparent bg-clip-text bg-gradient-to-r from-mp-success to-mp-primary",
};

// 徽章樣式
export const badgeStyles = {
  success:
    "inline-flex items-center gap-2 px-4 py-2 bg-mp-success/10 border border-mp-success/30 rounded-full text-sm text-mp-success font-semibold",
  primary:
    "inline-flex items-center gap-2 px-4 py-2 bg-mp-primary/10 border border-mp-primary/30 rounded-full text-sm text-mp-primary font-semibold",
};

// 背景效果
export const backgroundStyles = {
  section: "relative bg-mp-bg bg-noise",
  ambientGlow: "absolute rounded-full blur-3xl",
};

// 工具函數：創建卡片樣式
export function createCardStyle(
  variant: keyof typeof cardStyles = "primary",
  className?: string,
) {
  return cn(cardStyles.base, cardStyles[variant], className);
}

// 工具函數：創建圖示容器樣式
export function createIconStyle(
  size: keyof Pick<
    typeof iconContainerStyles,
    "small" | "medium" | "large"
  > = "small",
  color: keyof Pick<
    typeof iconContainerStyles,
    "primary" | "accent" | "success"
  > = "primary",
  className?: string,
) {
  return cn(
    iconContainerStyles.base,
    iconContainerStyles[size],
    iconContainerStyles[color],
    className,
  );
}

// 工具函數：創建標題樣式
export function createHeadingStyle(
  variant: keyof typeof headingStyles = "section",
  className?: string,
) {
  return cn(headingStyles[variant], className);
}

// 工具函數：創建文字樣式
export function createTextStyle(
  color: keyof Pick<typeof textStyles, "primary" | "secondary"> = "secondary",
  size: keyof Pick<typeof textStyles, "small" | "xs"> | "" = "",
  className?: string,
) {
  return cn(
    textStyles.body,
    textStyles[color],
    size ? textStyles[size] : "",
    className,
  );
}
