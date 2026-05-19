import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/api/request-user";
import { createAdminClient } from "@/lib/supabase/server";
import { asSupabaseRepositoryClient } from "@/lib/article-jobs/supabase-repositories";
import {
  createSupabaseArticleJobStatusAccessRepository,
  findCompanyScopedArticleJobStatus,
} from "@/lib/article-jobs/status-access";

interface Params {
  params: Promise<{
    jobId: string;
  }>;
}

/**
 * GET /api/articles/status/[jobId]
 * 查詢文章生成任務的狀態
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params;

    const userResult = await resolveRequestUser(request);
    if (!userResult.success) {
      return userResult.response;
    }
    const { user } = userResult;

    const repository = createSupabaseArticleJobStatusAccessRepository(
      asSupabaseRepositoryClient(createAdminClient()),
    );
    const statusResult = await findCompanyScopedArticleJobStatus({
      repository,
      userId: user.id,
      jobId,
    });

    if (
      !statusResult.success &&
      statusResult.reason === "no_active_membership"
    ) {
      return NextResponse.json(
        { error: "No active company membership" },
        { status: 403 },
      );
    }

    if (!statusResult.success) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(statusResult.job);
  } catch (error) {
    console.error("Get job status error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
