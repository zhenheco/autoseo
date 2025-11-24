"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createArticle(formData: FormData) {
  const industry = formData.get("industry") as string;
  const region = formData.get("region") as string;
  const language = formData.get("language") as string;
  const competitorsJson = formData.get("competitors") as string;

  if (!industry || industry.trim().length === 0) {
    redirect(
      "/dashboard/articles/new?error=" + encodeURIComponent("請選擇產業"),
    );
  }

  if (!region || region.trim().length === 0) {
    redirect(
      "/dashboard/articles/new?error=" + encodeURIComponent("請選擇地區"),
    );
  }

  if (!language || language.trim().length === 0) {
    redirect(
      "/dashboard/articles/new?error=" + encodeURIComponent("請選擇語言"),
    );
  }

  let competitors: string[] = [];
  try {
    competitors = competitorsJson ? JSON.parse(competitorsJson) : [];
  } catch {
    competitors = [];
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/articles/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          industry: industry.trim(),
          region: region.trim(),
          language: language.trim(),
          competitors: competitors.filter((c) => c.trim() !== ""),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "文章生成失敗");
    }

    const data = await response.json();

    revalidatePath("/dashboard/articles");
    redirect(
      `/dashboard/articles?success=${encodeURIComponent("文章生成任務已啟動")}`,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "未知錯誤";
    redirect(
      "/dashboard/articles/new?error=" + encodeURIComponent(errorMessage),
    );
  }
}
