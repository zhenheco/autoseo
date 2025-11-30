import { NextRequest, NextResponse } from "next/server";

/**
 * 觸發 GitHub Actions 處理文章生成
 * 避免 Vercel Function 超時限制
 */
export async function POST(request: NextRequest) {
  try {
    const { jobId, title } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // GitHub API 設定（從環境變數讀取）
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

    if (!owner || !repo) {
      console.error("GITHUB_REPO_OWNER or GITHUB_REPO_NAME not configured");
      return NextResponse.json(
        { error: "GitHub repository configuration missing" },
        { status: 500 },
      );
    }

    if (!token) {
      console.error("GITHUB_PERSONAL_ACCESS_TOKEN not configured");
      return NextResponse.json(
        { error: "GitHub integration not configured" },
        { status: 500 },
      );
    }

    // 觸發 GitHub Actions workflow
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          event_type: "generate-article",
          client_payload: {
            jobId,
            title: title || "Article Generation",
            timestamp: new Date().toISOString(),
          },
        }),
      },
    );

    // GitHub API 返回 204 表示成功
    if (response.status === 204) {
      console.log(`✅ GitHub Actions triggered for job: ${jobId}`);
      return NextResponse.json({
        success: true,
        message: "Article generation triggered via GitHub Actions",
        jobId,
        processor: "github-actions",
      });
    }

    // 處理錯誤
    const errorText = await response.text();
    console.error("GitHub API error:", response.status, errorText);

    return NextResponse.json(
      {
        error: "Failed to trigger GitHub Actions",
        status: response.status,
        details: errorText,
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("Trigger GitHub Actions error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
