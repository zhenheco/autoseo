import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("靜態分析和配置檢查", () => {
  const projectRoot = path.resolve(__dirname, "..");

  test("多語系檔案完整性檢查", async () => {
    const messagesDir = path.join(projectRoot, "src/messages");
    const supportedLocales = [
      "zh-TW",
      "en-US",
      "ja-JP",
      "ko-KR",
      "de-DE",
      "es-ES",
      "fr-FR",
    ];

    // 檢查所有語系檔案是否存在
    const missingLocales: string[] = [];
    const existingLocales: string[] = [];

    for (const locale of supportedLocales) {
      const filePath = path.join(messagesDir, `${locale}.json`);
      if (fs.existsSync(filePath)) {
        existingLocales.push(locale);
      } else {
        missingLocales.push(locale);
      }
    }

    console.log("存在的語系檔案:", existingLocales);
    if (missingLocales.length > 0) {
      console.log("缺少的語系檔案:", missingLocales);
    }

    // 至少應該有基本的中文和英文
    expect(existingLocales).toContain("zh-TW");
    expect(existingLocales).toContain("en-US");

    // 檢查語系檔案的 JSON 格式
    for (const locale of existingLocales) {
      const filePath = path.join(messagesDir, `${locale}.json`);
      const content = fs.readFileSync(filePath, "utf8");

      expect(() => JSON.parse(content)).not.toThrow();
      console.log(`✅ ${locale}.json 格式正確`);
    }
  });

  test("語系檔案鍵值一致性檢查", async () => {
    const messagesDir = path.join(projectRoot, "src/messages");
    const baseLocale = "zh-TW";
    const baseFilePath = path.join(messagesDir, `${baseLocale}.json`);

    if (!fs.existsSync(baseFilePath)) {
      console.log("⚠️ 基準語系檔案不存在，跳過一致性檢查");
      return;
    }

    const baseMessages = JSON.parse(fs.readFileSync(baseFilePath, "utf8"));
    const baseKeys = new Set(getAllKeys(baseMessages));

    console.log(`基準語系 (${baseLocale}) 總鍵值數:`, baseKeys.size);

    // 檢查其他語系檔案
    const otherLocales = ["en-US", "ja-JP"];

    for (const locale of otherLocales) {
      const filePath = path.join(messagesDir, `${locale}.json`);
      if (fs.existsSync(filePath)) {
        const messages = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const keys = new Set(getAllKeys(messages));

        const missingKeys = [...baseKeys].filter((key) => !keys.has(key));
        const extraKeys = [...keys].filter((key) => !baseKeys.has(key));

        console.log(`${locale} 鍵值數:`, keys.size);

        if (missingKeys.length > 0) {
          console.log(`${locale} 缺少的鍵值:`, missingKeys.slice(0, 5));
        }

        if (extraKeys.length > 0) {
          console.log(`${locale} 多餘的鍵值:`, extraKeys.slice(0, 5));
        }

        // 完整性不應低於 80%
        const completeness = (keys.size - missingKeys.length) / baseKeys.size;
        expect(completeness).toBeGreaterThan(0.8);

        console.log(`✅ ${locale} 完整性: ${(completeness * 100).toFixed(1)}%`);
      }
    }
  });

  test("i18n 配置檢查", async () => {
    // 檢查 i18n.ts 配置檔案
    const i18nConfigPath = path.join(projectRoot, "src/i18n.ts");
    expect(fs.existsSync(i18nConfigPath)).toBe(true);

    const i18nConfig = fs.readFileSync(i18nConfigPath, "utf8");

    // 檢查是否包含重要的配置
    expect(i18nConfig).toContain("getRequestConfig");
    expect(i18nConfig).toContain("zh-TW");
    expect(i18nConfig).toContain("en-US");
    expect(i18nConfig).toContain("loadMessages");

    console.log("✅ i18n 配置檔案結構正確");

    // 檢查 middleware.ts
    const middlewarePath = path.join(projectRoot, "src/middleware.ts");
    if (fs.existsSync(middlewarePath)) {
      const middleware = fs.readFileSync(middlewarePath, "utf8");
      console.log("✅ middleware.ts 存在");

      // 檢查是否有國際化相關設定
      if (middleware.includes("intl") || middleware.includes("locale")) {
        console.log("✅ middleware 包含國際化設定");
      }
    }
  });

  test("響應式設計 CSS 檢查", async () => {
    // 檢查 Tailwind 配置
    const tailwindConfigPath = path.join(projectRoot, "tailwind.config.ts");
    if (fs.existsSync(tailwindConfigPath)) {
      const tailwindConfig = fs.readFileSync(tailwindConfigPath, "utf8");

      // 檢查是否有響應式斷點配置
      if (
        tailwindConfig.includes("screens") ||
        tailwindConfig.includes("breakpoint")
      ) {
        console.log("✅ Tailwind 包含響應式配置");
      }

      // 檢查是否啟用響應式功能
      expect(tailwindConfig).toContain("responsive");
      console.log("✅ Tailwind 響應式功能已啟用");
    }

    // 檢查全局 CSS 檔案
    const globalCssFiles = [
      "src/styles/globals.css",
      "src/app/globals.css",
      "src/styles/index.css",
    ];

    for (const cssFile of globalCssFiles) {
      const cssPath = path.join(projectRoot, cssFile);
      if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, "utf8");

        // 檢查是否有媒體查詢
        const hasMediaQueries = /@media/.test(cssContent);
        if (hasMediaQueries) {
          console.log(`✅ ${cssFile} 包含媒體查詢`);
        }

        // 檢查是否有響應式 utilities
        const hasResponsiveUtils = /(sm|md|lg|xl):/.test(cssContent);
        if (hasResponsiveUtils) {
          console.log(`✅ ${cssFile} 使用響應式工具類`);
        }
      }
    }
  });

  test("TypeScript 配置檢查", async () => {
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    expect(fs.existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));

    // 檢查路徑別名設定
    expect(tsconfig.compilerOptions?.paths?.["@/*"]).toBeDefined();
    console.log("✅ TypeScript 路徑別名設定正確");

    // 檢查 strict 模式
    expect(tsconfig.compilerOptions?.strict).toBe(true);
    console.log("✅ TypeScript strict 模式已啟用");

    // 檢查 Next.js 類型
    expect(tsconfig.compilerOptions?.types).toContain("next");
    console.log("✅ Next.js TypeScript 配置正確");
  });

  test("Next.js 配置檢查", async () => {
    const nextConfigPath = path.join(projectRoot, "next.config.js");
    if (fs.existsSync(nextConfigPath)) {
      const nextConfig = fs.readFileSync(nextConfigPath, "utf8");

      // 檢查是否有國際化配置
      if (nextConfig.includes("i18n") || nextConfig.includes("locale")) {
        console.log("✅ Next.js 包含國際化配置");
      }

      // 檢查圖片優化設定
      if (nextConfig.includes("images")) {
        console.log("✅ Next.js 圖片優化已配置");
      }

      console.log("✅ Next.js 配置檔案存在");
    }
  });

  test("安全和效能配置檢查", async () => {
    // 檢查環境變數範例檔案
    const envExamplePath = path.join(projectRoot, ".env.example");
    if (fs.existsSync(envExamplePath)) {
      const envExample = fs.readFileSync(envExamplePath, "utf8");

      // 檢查是否有敏感資訊洩漏
      const hasSensitiveData = /password|secret|key.*=.*[^_EXAMPLE]$/im.test(
        envExample,
      );
      expect(hasSensitiveData).toBe(false);

      console.log("✅ 環境變數範例檔案安全");
    }

    // 檢查 .gitignore
    const gitignorePath = path.join(projectRoot, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, "utf8");

      expect(gitignore).toContain(".env");
      expect(gitignore).toContain("node_modules");
      expect(gitignore).toContain(".next");

      console.log("✅ .gitignore 配置正確");
    }

    // 檢查 package.json 安全性
    const packagePath = path.join(projectRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

    // 檢查是否有已知的不安全套件（簡單檢查）
    const dependencies = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    });

    console.log("依賴套件數量:", dependencies.length);

    // 檢查是否有基本的安全相關套件
    const hasSecurityDeps = dependencies.some(
      (dep) =>
        dep.includes("helmet") ||
        dep.includes("cors") ||
        dep.includes("security"),
    );

    if (hasSecurityDeps) {
      console.log("✅ 包含安全相關套件");
    } else {
      console.log("⚠️ 未發現明顯的安全相關套件");
    }
  });
});

// 輔助函數：遞迴取得所有鍵值
function getAllKeys(obj: any, prefix = ""): string[] {
  const keys: string[] = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === "object" && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}
