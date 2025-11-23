/**
 * 修復受損的文章 HTML 內容
 * 掃描所有 html_content 包含 Markdown 語法的文章並重新轉換
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';

config({ path: resolve(process.cwd(), '.env.local') });

marked.use({
  async: true,
  gfm: true,
  breaks: false,
  pedantic: false,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少環境變數: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DamagedArticle {
  id: string;
  title: string;
  html_content: string;
  markdown_content: string;
  created_at: string;
}

interface FixResult {
  id: string;
  status: 'success' | 'failed';
  error?: string;
}

function isValidHTML(html: string, markdown: string): boolean {
  if (!html || !html.includes('<') || !html.includes('>')) {
    return false;
  }

  const markdownPatterns = ['##', '**', '```'];
  if (markdownPatterns.some(p => html.includes(p))) {
    return false;
  }

  const ratio = html.length / markdown.length;
  if (ratio < 1.05) {
    return false;
  }

  return true;
}

async function findDamagedArticles(): Promise<DamagedArticle[]> {
  console.log('🔍 掃描受損的文章...\n');

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title, html_content, markdown_content, created_at')
    .or('html_content.like.%##%,html_content.like.%**%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 查詢失敗:', error);
    throw error;
  }

  const damagedArticles = (data || []).filter(article => {
    return !isValidHTML(article.html_content, article.markdown_content);
  });

  console.log(`📊 找到 ${damagedArticles.length} 篇受損的文章\n`);

  return damagedArticles;
}

async function fixArticle(article: DamagedArticle): Promise<FixResult> {
  try {
    console.log(`📝 修復文章: ${article.title} (${article.id})`);

    const html = await marked.parse(article.markdown_content);

    if (!isValidHTML(html, article.markdown_content)) {
      throw new Error('轉換後的 HTML 仍然無效');
    }

    const { error } = await supabase
      .from('generated_articles')
      .update({ html_content: html })
      .eq('id', article.id);

    if (error) {
      throw error;
    }

    console.log(`✅ 修復成功: ${article.title}\n`);

    return { id: article.id, status: 'success' };
  } catch (error) {
    console.error(`❌ 修復失敗: ${article.title}`);
    console.error(`   錯誤: ${error instanceof Error ? error.message : String(error)}\n`);

    return {
      id: article.id,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fixAllArticles(articles: DamagedArticle[]): Promise<FixResult[]> {
  console.log('🔧 開始批量修復...\n');

  const results: FixResult[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    console.log(`處理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(articles.length / BATCH_SIZE)}`);

    const batchResults = await Promise.all(batch.map(article => fixArticle(article)));
    results.push(...batchResults);

    if (i + BATCH_SIZE < articles.length) {
      console.log('⏳ 等待 1 秒後繼續...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

function generateReport(results: FixResult[]): void {
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');

  console.log('\n' + '━'.repeat(80));
  console.log('📊 修復報告\n');
  console.log(`總數: ${results.length}`);
  console.log(`✅ 成功: ${successful.length}`);
  console.log(`❌ 失敗: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n失敗的文章:');
    failed.forEach(f => {
      console.log(`  - ${f.id}: ${f.error}`);
    });
  }

  console.log('\n時間: ' + new Date().toISOString());
  console.log('━'.repeat(80));
}

async function main() {
  try {
    const damagedArticles = await findDamagedArticles();

    if (damagedArticles.length === 0) {
      console.log('✅ 沒有需要修復的文章');
      return;
    }

    const results = await fixAllArticles(damagedArticles);
    generateReport(results);

  } catch (error) {
    console.error('\n❌ 修復過程發生錯誤:', error);
    process.exit(1);
  }
}

main();
