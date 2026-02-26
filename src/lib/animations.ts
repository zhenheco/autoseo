/**
 * 共用動畫變數和配置
 * 統一管理所有組件的動畫效果
 */

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i?: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: (i || 0) * 0.1, duration: 0.6 },
  }),
};

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const scaleInVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.3 },
  },
};

export const slideInVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5 },
  },
};

// 常用的 viewport 設定
export const defaultViewport = { once: true };

// 常用的動畫延遲時間
export const animationDelays = {
  fast: 0.1,
  normal: 0.2,
  slow: 0.5,
};
