import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth-guard";

type WithdrawalStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "processing"
  | "completed"
  | "rejected";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  if (!isSuperAdmin(user.email)) {
    return NextResponse.json({ error: "無權限" }, { status: 403 });
  }

  const body = await request.json();
  const { status, reject_reason } = body as {
    status: WithdrawalStatus;
    reject_reason?: string;
  };

  const validStatuses: WithdrawalStatus[] = [
    "pending",
    "reviewing",
    "approved",
    "processing",
    "completed",
    "rejected",
  ];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "無效的狀態" }, { status: 400 });
  }

  interface UpdateData {
    status: WithdrawalStatus;
    processed_at?: string;
    completed_at?: string;
    reject_reason?: string;
  }

  const updateData: UpdateData = { status };

  if (status === "reviewing" || status === "approved") {
    updateData.processed_at = new Date().toISOString();
  }

  if (status === "completed") {
    updateData.completed_at = new Date().toISOString();
  }

  if (status === "rejected" && reject_reason) {
    updateData.reject_reason = reject_reason;
  }

  const { data: withdrawal, error } = await supabase
    .from("affiliate_withdrawals")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Admin] 更新提領狀態失敗:", error);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }

  if (status === "completed" && withdrawal) {
    await supabase.rpc("mark_commissions_withdrawn", {
      p_affiliate_id: withdrawal.affiliate_id,
      p_amount: withdrawal.withdrawal_amount,
    });
  }

  console.log(`[Admin] 提領 ${id} 狀態更新為 ${status}，操作者: ${user.id}`);

  return NextResponse.json({ data: withdrawal });
}
