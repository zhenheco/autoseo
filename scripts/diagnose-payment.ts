/**
 * 付款診斷工具
 *
 * 用於診斷和手動處理卡住的付款訂單。
 *
 * 使用方法:
 *   npx tsx scripts/diagnose-payment.ts <order_no>
 *   npx tsx scripts/diagnose-payment.ts ORD17663527587352862
 *
 * 功能:
 *   1. 查詢訂單狀態
 *   2. 查詢金流微服務付款狀態（如果有配置）
 *   3. 顯示診斷報告
 *   4. 提供手動處理選項
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as readline from "readline";

// 載入環境變數
dotenv.config({ path: ".env.local" });

// 驗證環境變數
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYMENT_GATEWAY_API_KEY = process.env.PAYMENT_GATEWAY_API_KEY;
const PAYMENT_GATEWAY_SITE_CODE = process.env.PAYMENT_GATEWAY_SITE_CODE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 缺少 Supabase 環境變數");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// 類型定義
// ============================================================================

interface PaymentOrder {
  id: string;
  order_no: string;
  company_id: string;
  order_type: string;
  payment_type: string;
  amount: number;
  item_description: string;
  related_id: string | null;
  status: string;
  newebpay_status: string | null;
  newebpay_trade_no: string | null;
  paid_at: string | null;
  created_at: string;
}

interface ArticlePackage {
  id: string;
  name: string;
  articles: number;
  price: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  articles_per_month: number;
}

// ============================================================================
// 診斷函數
// ============================================================================

async function diagnosePayment(orderNo: string): Promise<void> {
  console.log("\n========================================");
  console.log("🔍 付款診斷工具");
  console.log("========================================\n");

  // 1. 查詢訂單
  console.log(`📋 訂單編號: ${orderNo}`);
  console.log("----------------------------------------");

  const { data: order, error: orderError } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("order_no", orderNo)
    .single();

  if (orderError || !order) {
    console.error(`❌ 找不到訂單: ${orderNo}`);
    return;
  }

  const paymentOrder = order as PaymentOrder;

  // 顯示訂單資訊
  console.log(`   ID: ${paymentOrder.id}`);
  console.log(`   公司 ID: ${paymentOrder.company_id}`);
  console.log(`   類型: ${paymentOrder.order_type}`);
  console.log(`   付款類型: ${paymentOrder.payment_type}`);
  console.log(`   金額: NT$ ${paymentOrder.amount}`);
  console.log(`   描述: ${paymentOrder.item_description}`);
  console.log(`   關聯 ID: ${paymentOrder.related_id || "(無)"}`);
  console.log(`   狀態: ${paymentOrder.status}`);
  console.log(`   藍新狀態: ${paymentOrder.newebpay_status || "(無)"}`);
  console.log(`   藍新交易號: ${paymentOrder.newebpay_trade_no || "(無)"}`);
  console.log(`   付款時間: ${paymentOrder.paid_at || "(未付款)"}`);
  console.log(`   建立時間: ${paymentOrder.created_at}`);

  // 2. 診斷狀態
  console.log("\n📊 診斷結果:");
  console.log("----------------------------------------");

  if (paymentOrder.status === "pending") {
    console.log("⚠️  訂單狀態為 pending - Webhook 可能沒有收到");
    console.log("   可能原因:");
    console.log("   1. 金流微服務的 webhook_url 設定錯誤");
    console.log("   2. 藍新金流沒有發送通知到金流微服務");
    console.log("   3. Webhook 發送失敗（網路問題）");
  } else if (paymentOrder.status === "success") {
    console.log("✅ 訂單已標記為成功");

    // 檢查業務邏輯是否執行
    if (
      paymentOrder.payment_type === "article_package" ||
      paymentOrder.payment_type === "subscription"
    ) {
      console.log(
        `⚠️  付款類型 ${paymentOrder.payment_type} 的業務邏輯可能未實作`,
      );
    }
  } else {
    console.log(`ℹ️  訂單狀態: ${paymentOrder.status}`);
  }

  // 3. 查詢相關商品資訊
  if (paymentOrder.related_id) {
    console.log("\n📦 商品資訊:");
    console.log("----------------------------------------");

    if (paymentOrder.payment_type === "article_package") {
      const { data: pkg } = await supabase
        .from("article_packages")
        .select("*")
        .eq("id", paymentOrder.related_id)
        .single();

      if (pkg) {
        const articlePkg = pkg as ArticlePackage;
        console.log(`   名稱: ${articlePkg.name}`);
        console.log(`   篇數: ${articlePkg.articles} 篇`);
        console.log(`   價格: NT$ ${articlePkg.price}`);
      }
    } else if (paymentOrder.payment_type === "subscription") {
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", paymentOrder.related_id)
        .single();

      if (plan) {
        const subPlan = plan as SubscriptionPlan;
        console.log(`   名稱: ${subPlan.name}`);
        console.log(`   月費: NT$ ${subPlan.price}`);
        console.log(`   每月篇數: ${subPlan.articles_per_month} 篇`);
      }
    }
  }

  // 4. 查詢公司訂閱狀態
  console.log("\n🏢 公司訂閱狀態:");
  console.log("----------------------------------------");

  const { data: subscription } = await supabase
    .from("company_subscriptions")
    .select("*, subscription_plans(name)")
    .eq("company_id", paymentOrder.company_id)
    .single();

  if (subscription) {
    console.log(
      `   方案: ${(subscription as { subscription_plans?: { name?: string } }).subscription_plans?.name || "N/A"}`,
    );
    console.log(`   狀態: ${subscription.status}`);
    console.log(
      `   訂閱剩餘篇數: ${subscription.subscription_articles_remaining || 0}`,
    );
    console.log(
      `   加購剩餘篇數: ${subscription.purchased_articles_remaining || 0}`,
    );
  }

  // 5. 提供選項
  console.log("\n🔧 可用操作:");
  console.log("----------------------------------------");
  console.log("   1. 手動標記訂單為成功並執行業務邏輯");
  console.log("   2. 退出");

  const answer = await askQuestion("\n請選擇操作 (1/2): ");

  if (answer === "1") {
    await manuallyProcessPayment(paymentOrder);
  }
}

// ============================================================================
// 手動處理付款
// ============================================================================

async function manuallyProcessPayment(order: PaymentOrder): Promise<void> {
  console.log("\n🔄 手動處理付款...");

  // 1. 更新訂單狀態
  const { error: updateError } = await supabase
    .from("payment_orders")
    .update({
      status: "success",
      newebpay_status: "SUCCESS",
      paid_at: new Date().toISOString(),
      newebpay_response: {
        source: "manual_fix",
        processed_at: new Date().toISOString(),
      },
    })
    .eq("id", order.id);

  if (updateError) {
    console.error("❌ 更新訂單狀態失敗:", updateError);
    return;
  }

  console.log("✅ 訂單狀態已更新為 success");

  // 2. 執行業務邏輯
  switch (order.payment_type) {
    case "article_package":
      await processArticlePackage(order);
      break;
    case "subscription":
      await processSubscription(order);
      break;
    case "token_package":
      await processTokenPackage(order);
      break;
    default:
      console.log(`⚠️  未知的付款類型: ${order.payment_type}`);
  }
}

async function processArticlePackage(order: PaymentOrder): Promise<void> {
  console.log("\n📝 處理加購篇數...");

  if (!order.related_id) {
    console.error("❌ 缺少 related_id");
    return;
  }

  // 查詢文章包
  const { data: pkg, error: pkgError } = await supabase
    .from("article_packages")
    .select("*")
    .eq("id", order.related_id)
    .single();

  if (pkgError || !pkg) {
    console.error("❌ 找不到文章包:", order.related_id);
    return;
  }

  const articlePkg = pkg as ArticlePackage;
  const articlesToAdd = articlePkg.articles;

  // 更新公司訂閱的加購篇數
  const { data: subscription } = await supabase
    .from("company_subscriptions")
    .select("*")
    .eq("company_id", order.company_id)
    .single();

  if (!subscription) {
    console.error("❌ 找不到公司訂閱");
    return;
  }

  const currentPurchased = subscription.purchased_articles_remaining || 0;
  const newPurchased = currentPurchased + articlesToAdd;

  const { error: updateError } = await supabase
    .from("company_subscriptions")
    .update({
      purchased_articles_remaining: newPurchased,
      purchased_count: (subscription.purchased_count || 0) + 1,
    })
    .eq("id", subscription.id);

  if (updateError) {
    console.error("❌ 更新加購篇數失敗:", updateError);
    return;
  }

  console.log(`✅ 已增加 ${articlesToAdd} 篇加購額度`);
  console.log(`   之前: ${currentPurchased} 篇`);
  console.log(`   之後: ${newPurchased} 篇`);
}

async function processSubscription(order: PaymentOrder): Promise<void> {
  console.log("\n📅 處理訂閱...");

  if (!order.related_id) {
    console.error("❌ 缺少 related_id");
    return;
  }

  // 查詢訂閱方案
  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", order.related_id)
    .single();

  if (planError || !plan) {
    console.error("❌ 找不到訂閱方案:", order.related_id);
    return;
  }

  const subPlan = plan as SubscriptionPlan;

  // 檢查是否已有訂閱
  const { data: existingSub } = await supabase
    .from("company_subscriptions")
    .select("*")
    .eq("company_id", order.company_id)
    .single();

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  if (existingSub) {
    // 更新現有訂閱
    const { error: updateError } = await supabase
      .from("company_subscriptions")
      .update({
        plan_id: order.related_id,
        status: "active",
        subscription_articles_remaining:
          (existingSub.subscription_articles_remaining || 0) +
          subPlan.articles_per_month,
        articles_per_month: subPlan.articles_per_month,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", existingSub.id);

    if (updateError) {
      console.error("❌ 更新訂閱失敗:", updateError);
      return;
    }

    console.log(`✅ 訂閱已更新為 ${subPlan.name}`);
    console.log(`   新增 ${subPlan.articles_per_month} 篇訂閱額度`);
  } else {
    // 建立新訂閱
    const { error: insertError } = await supabase
      .from("company_subscriptions")
      .insert({
        company_id: order.company_id,
        plan_id: order.related_id,
        status: "active",
        subscription_articles_remaining: subPlan.articles_per_month,
        articles_per_month: subPlan.articles_per_month,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      });

    if (insertError) {
      console.error("❌ 建立訂閱失敗:", insertError);
      return;
    }

    console.log(`✅ 已建立新訂閱: ${subPlan.name}`);
    console.log(`   訂閱額度: ${subPlan.articles_per_month} 篇`);
  }
}

async function processTokenPackage(order: PaymentOrder): Promise<void> {
  console.log("\n🪙 處理代幣包...");

  if (!order.related_id) {
    console.error("❌ 缺少 related_id");
    return;
  }

  // 查詢代幣包
  const { data: pkg, error: pkgError } = await supabase
    .from("token_packages")
    .select("*")
    .eq("id", order.related_id)
    .single();

  if (pkgError || !pkg) {
    console.error("❌ 找不到代幣包:", order.related_id);
    return;
  }

  const tokenAmount = (pkg as { token_amount: number }).token_amount;

  // 使用 RPC 增加代幣
  const { error: rpcError } = await supabase.rpc("increment_company_tokens", {
    p_company_id: order.company_id,
    p_token_amount: tokenAmount,
  });

  if (rpcError) {
    console.error("❌ 增加代幣失敗:", rpcError);
    return;
  }

  console.log(`✅ 已增加 ${tokenAmount} 代幣`);
}

// ============================================================================
// 輔助函數
// ============================================================================

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ============================================================================
// 主程式
// ============================================================================

async function main(): Promise<void> {
  const orderNo = process.argv[2];

  if (!orderNo) {
    console.log("用法: npx tsx scripts/diagnose-payment.ts <order_no>");
    console.log(
      "範例: npx tsx scripts/diagnose-payment.ts ORD17663527587352862",
    );
    process.exit(1);
  }

  await diagnosePayment(orderNo);
}

main().catch(console.error);
