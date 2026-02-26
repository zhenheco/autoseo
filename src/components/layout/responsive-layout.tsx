"use client";

import { ReactNode, useMemo, ElementType } from "react";
import { useLocale } from "next-intl";
import { getFontClassForLocale } from "@/lib/fonts";
import { getLocaleDirection } from "@/lib/i18n/locale-detection";

// 型別定義
type SizeType = "sm" | "default" | "lg" | "xl" | "full";

// 只保留實際使用的樣式映射常數
const SIZE_CLASSES: Record<SizeType, string> = {
  sm: "max-w-3xl",
  default: "max-w-7xl",
  lg: "max-w-[1400px]",
  xl: "max-w-[1600px]",
  full: "max-w-none",
} as const;

interface ResponsiveLayoutProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

/**
 * 響應式佈局組件
 * 根據語系自動選擇合適的字體和方向
 */
export function ResponsiveLayout({
  children,
  className = "",
  as: Component = "div",
}: ResponsiveLayoutProps) {
  const locale = useLocale();

  const { direction, fontClass } = useMemo(
    () => ({
      direction: getLocaleDirection(locale),
      fontClass: getFontClassForLocale(locale),
    }),
    [locale],
  );

  const combinedClassName = useMemo(
    () => [fontClass, className].filter(Boolean).join(" "),
    [fontClass, className],
  );

  return (
    <Component className={combinedClassName} dir={direction}>
      {children}
    </Component>
  );
}

interface ContainerProps {
  children: ReactNode;
  className?: string;
  size?: SizeType;
}

/**
 * Container 組件 - 提供一致的間距和最大寬度
 */
export function Container({
  children,
  className = "",
  size = "default",
}: ContainerProps) {
  const combinedClassName = useMemo(
    () =>
      [
        "container",
        "mx-auto",
        "px-4",
        "md:px-6",
        "lg:px-8",
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" "),
    [size, className],
  );

  return (
    <ResponsiveLayout className={combinedClassName}>
      {children}
    </ResponsiveLayout>
  );
}

/**
 * Section 組件 - 提供一致的區塊間距
 */
export function Section({
  children,
  className = "",
  padding = "default",
  background = "transparent",
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "default" | "lg" | "xl";
  background?: "transparent" | "muted" | "card" | "gradient";
}) {
  const paddingClasses = {
    none: "",
    sm: "py-8 md:py-12",
    default: "py-12 md:py-16 lg:py-20",
    lg: "py-16 md:py-20 lg:py-24",
    xl: "py-20 md:py-24 lg:py-32",
  };

  const backgroundClasses = {
    transparent: "",
    muted: "bg-muted/30",
    card: "bg-card",
    gradient: "bg-gradient-to-br from-background via-background to-muted/20",
  };

  return (
    <section
      className={`${paddingClasses[padding]} ${backgroundClasses[background]} ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Grid 組件 - 響應式網格佈局
 */
export function Grid({
  children,
  className = "",
  cols = "auto",
  gap = "default",
}: {
  children: ReactNode;
  className?: string;
  cols?: "auto" | "1" | "2" | "3" | "4" | "6" | "12";
  gap?: "none" | "sm" | "default" | "lg" | "xl";
}) {
  const colsClasses = {
    auto: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    "1": "grid-cols-1",
    "2": "grid-cols-1 md:grid-cols-2",
    "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    "6": "grid-cols-1 md:grid-cols-3 lg:grid-cols-6",
    "12": "grid-cols-12",
  };

  const gapClasses = {
    none: "gap-0",
    sm: "gap-4",
    default: "gap-6",
    lg: "gap-8",
    xl: "gap-12",
  };

  return (
    <ResponsiveLayout
      className={`grid ${colsClasses[cols]} ${gapClasses[gap]} ${className}`}
    >
      {children}
    </ResponsiveLayout>
  );
}

/**
 * Stack 組件 - 垂直堆疊佈局
 */
export function Stack({
  children,
  className = "",
  spacing = "default",
  align = "stretch",
}: {
  children: ReactNode;
  className?: string;
  spacing?: "none" | "sm" | "default" | "lg" | "xl";
  align?: "start" | "center" | "end" | "stretch";
}) {
  const spacingClasses = {
    none: "space-y-0",
    sm: "space-y-2",
    default: "space-y-4",
    lg: "space-y-6",
    xl: "space-y-8",
  };

  const alignClasses = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
  };

  return (
    <ResponsiveLayout
      className={`flex flex-col ${spacingClasses[spacing]} ${alignClasses[align]} ${className}`}
    >
      {children}
    </ResponsiveLayout>
  );
}

/**
 * Flex 組件 - 彈性佈局
 */
export function Flex({
  children,
  className = "",
  direction = "row",
  align = "stretch",
  justify = "start",
  wrap = false,
  gap = "default",
}: {
  children: ReactNode;
  className?: string;
  direction?: "row" | "col" | "row-reverse" | "col-reverse";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  wrap?: boolean;
  gap?: "none" | "sm" | "default" | "lg" | "xl";
}) {
  const directionClasses = {
    row: "flex-row",
    col: "flex-col",
    "row-reverse": "flex-row-reverse",
    "col-reverse": "flex-col-reverse",
  };

  const alignClasses = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
    baseline: "items-baseline",
  };

  const justifyClasses = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
    evenly: "justify-evenly",
  };

  const gapClasses = {
    none: "gap-0",
    sm: "gap-2",
    default: "gap-4",
    lg: "gap-6",
    xl: "gap-8",
  };

  return (
    <ResponsiveLayout
      className={`
      flex 
      ${directionClasses[direction]} 
      ${alignClasses[align]} 
      ${justifyClasses[justify]} 
      ${wrap ? "flex-wrap" : ""}
      ${gapClasses[gap]} 
      ${className}
    `}
    >
      {children}
    </ResponsiveLayout>
  );
}
