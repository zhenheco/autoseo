import { describe, test, expect } from "vitest";
import {
  getStatusConfig,
  formatScheduledTime,
  getScheduledLabel,
  getPublishedLabel,
  ARTICLE_STATUS_CONFIG,
} from "./status-config";

describe("status-config", () => {
  describe("ARTICLE_STATUS_CONFIG", () => {
    test("所有預設狀態都有配置", () => {
      const expectedStatuses = [
        "pending",
        "processing",
        "completed",
        "generated",
        "reviewed",
        "scheduled",
        "published",
        "failed",
      ];

      expectedStatuses.forEach((status) => {
        expect(ARTICLE_STATUS_CONFIG[status]).toBeDefined();
        expect(ARTICLE_STATUS_CONFIG[status].label).toBeTruthy();
        expect(ARTICLE_STATUS_CONFIG[status].badgeIcon).toBeDefined();
        expect(ARTICLE_STATUS_CONFIG[status].statusIcon).toBeDefined();
        expect(ARTICLE_STATUS_CONFIG[status].variant).toBeDefined();
      });
    });

    test("動畫狀態正確配置", () => {
      expect(ARTICLE_STATUS_CONFIG["pending"].animate).toBe(true);
      expect(ARTICLE_STATUS_CONFIG["processing"].animate).toBe(true);
      expect(ARTICLE_STATUS_CONFIG["completed"].animate).toBeUndefined();
      expect(ARTICLE_STATUS_CONFIG["failed"].animate).toBeUndefined();
    });
  });

  describe("getStatusConfig", () => {
    test("返回已知狀態的配置", () => {
      const config = getStatusConfig("completed");
      expect(config.label).toBe("已完成");
      expect(config.variant).toBe("default");
    });

    test("返回未知狀態的預設配置", () => {
      const config = getStatusConfig("unknown_status");
      expect(config.label).toBe("unknown_status");
      expect(config.variant).toBe("outline");
    });

    test("處理 pending 狀態", () => {
      const config = getStatusConfig("pending");
      expect(config.label).toBe("生成中");
      expect(config.animate).toBe(true);
    });

    test("處理 failed 狀態", () => {
      const config = getStatusConfig("failed");
      expect(config.label).toBe("失敗");
      expect(config.variant).toBe("destructive");
    });
  });

  describe("formatScheduledTime", () => {
    test("格式化有效時間", () => {
      // 使用固定日期避免時區問題
      const date = new Date("2024-12-25T09:30:00Z");
      const result = formatScheduledTime(date.toISOString());
      // 結果會根據本地時區變化，只確認格式正確
      expect(result).toMatch(/\d{2}\/\d{2}/); // MM/DD 格式
    });

    test("處理 null 輸入", () => {
      expect(formatScheduledTime(null)).toBe("");
    });

    test("處理 undefined 輸入", () => {
      expect(formatScheduledTime(undefined)).toBe("");
    });
  });

  describe("getScheduledLabel", () => {
    test("有時間時返回排程標籤", () => {
      const date = new Date("2024-12-25T09:30:00Z");
      const result = getScheduledLabel(date.toISOString());
      expect(result).toContain("排程:");
    });

    test("無時間時返回預設標籤", () => {
      expect(getScheduledLabel(null)).toBe("已排程");
      expect(getScheduledLabel(undefined)).toBe("已排程");
    });
  });

  describe("getPublishedLabel", () => {
    test("無網站名稱時返回預設標籤", () => {
      expect(getPublishedLabel()).toBe("已發佈");
      expect(getPublishedLabel(null)).toBe("已發佈");
    });

    test("有網站名稱且狀態為 publish", () => {
      expect(getPublishedLabel("My Blog", "publish")).toBe("已發佈到 My Blog");
    });

    test("有網站名稱且狀態為 draft", () => {
      expect(getPublishedLabel("My Blog", "draft")).toBe(
        "已發佈到 My Blog (草稿)",
      );
    });

    test("有網站名稱但無 WordPress 狀態", () => {
      expect(getPublishedLabel("My Blog", null)).toBe(
        "已發佈到 My Blog (草稿)",
      );
    });
  });
});
