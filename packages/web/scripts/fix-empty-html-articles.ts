/**
 * 修復空白 HTML 文章腳本
 * 從 markdown_content 重新生成 html_content
 */

import { createClient } from "@supabase/supabase-js";
import { marked } from "marked";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixEmptyHtmlArticles() {
  console.log("🔍 查詢空白 HTML 的文章...");

  const { data: articles, error } = await supabase
    .from("generated_articles")
    .select("id, title, markdown_content, html_content")
    .or("html_content.is.null,html_content.eq.");

  if (error) {
    console.error("❌ 查詢失敗:", error);
    return;
  }

  if (!articles || articles.length === 0) {
    console.log("✅ 沒有需要修復的文章");
    return;
  }

  console.log(`📋 找到 ${articles.length} 篇需要修復的文章`);

  let fixed = 0;
  let failed = 0;

  for (const article of articles) {
    console.log(`\n處理: ${article.title} (${article.id})`);

    if (!article.markdown_content || article.markdown_content.trim() === "") {
      console.log("  ⚠️ 跳過：Markdown 內容也是空的");
      failed++;
      continue;
    }

    try {
      const htmlContent = await marked.parse(article.markdown_content);

      if (!htmlContent || htmlContent.trim() === "") {
        console.log("  ⚠️ 轉換後的 HTML 仍然是空的");
        failed++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("generated_articles")
        .update({ html_content: htmlContent })
        .eq("id", article.id);

      if (updateError) {
        console.log("  ❌ 更新失敗:", updateError.message);
        failed++;
      } else {
        console.log(
          `  ✅ 修復成功 (MD: ${article.markdown_content.length} -> HTML: ${htmlContent.length})`,
        );
        fixed++;
      }
    } catch (err) {
      console.log("  ❌ 轉換錯誤:", err);
      failed++;
    }
  }

  console.log(`\n📊 修復結果:`);
  console.log(`  ✅ 成功: ${fixed}`);
  console.log(`  ❌ 失敗: ${failed}`);
}

fixEmptyHtmlArticles().catch(console.error);
