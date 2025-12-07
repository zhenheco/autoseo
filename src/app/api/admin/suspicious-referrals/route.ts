import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  ReviewStatus,
  SuspicionType,
  SeverityLevel,
  ActionTaken,
} from "@/types/fraud.types";

/**
 * 取得可疑推薦列表
 * GET /api/admin/suspicious-referrals
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 驗證管理員權限
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    // 檢查是否為管理員（這裡用 email 檢查，你可以改用其他方式）
    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    if (!adminEmails.includes(user.email || "")) {
      return NextResponse.json({ error: "無權限" }, { status: 403 });
    }

    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ReviewStatus | null;
    const suspicionType = searchParams.get("type") as SuspicionType | null;
    const severity = searchParams.get("severity") as SeverityLevel | null;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    // 建立查詢
    let query = supabase
      .from("suspicious_referrals")
      .select(
        `
        *,
        referrer_company:referrer_company_id(id, name),
        referred_company:referred_company_id(id, name),
        referral:referral_id(id, referral_code, status)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 應用篩選條件
    if (status) {
      query = query.eq("status", status);
    }
    if (suspicionType) {
      query = query.eq("suspicion_type", suspicionType);
    }
    if (severity) {
      query = query.eq("severity", severity);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("查詢可疑推薦失敗:", error);
      return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }

    // 取得統計資訊
    const { data: stats } = await supabase
      .from("suspicious_referrals")
      .select("status, severity")
      .then((result) => {
        const statusCounts: Record<string, number> = {};
        const severityCounts: Record<string, number> = {};

        result.data?.forEach((item) => {
          statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
          severityCounts[item.severity] =
            (severityCounts[item.severity] || 0) + 1;
        });

        return {
          data: { statusCounts, severityCounts },
          error: result.error,
        };
      });

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error("處理請求失敗:", error);
    return NextResponse.json({ error: "處理失敗" }, { status: 500 });
  }
}

/**
 * 更新可疑推薦狀態
 * PATCH /api/admin/suspicious-referrals
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 驗證管理員權限
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    if (!adminEmails.includes(user.email || "")) {
      return NextResponse.json({ error: "無權限" }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      status,
      review_notes,
      action_taken,
    }: {
      id: string;
      status: ReviewStatus;
      review_notes?: string;
      action_taken?: ActionTaken;
    } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
    }

    // 更新可疑記錄
    const updateData: Record<string, unknown> = {
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (review_notes !== undefined) {
      updateData.review_notes = review_notes;
    }

    if (action_taken) {
      updateData.action_taken = action_taken;
      updateData.action_taken_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("suspicious_referrals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("更新可疑記錄失敗:", error);
      return NextResponse.json({ error: "更新失敗" }, { status: 500 });
    }

    // 如果確認詐騙並需要取消獎勵
    if (status === "confirmed_fraud" && action_taken === "reward_cancelled") {
      // 取消相關的推薦獎勵
      if (data.referral_id) {
        await supabase
          .from("referrals")
          .update({ status: "cancelled" })
          .eq("id", data.referral_id);

        // 如果有佣金記錄，也標記為取消
        await supabase
          .from("affiliate_commissions")
          .update({ status: "cancelled" })
          .eq("referral_id", data.referral_id);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("處理請求失敗:", error);
    return NextResponse.json({ error: "處理失敗" }, { status: 500 });
  }
}
