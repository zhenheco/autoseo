"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ArticleEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  useEffect(() => {
    // Redirect to main articles page
    router.replace("/dashboard/articles");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">重新導向到文章管理頁面...</p>
    </div>
  );
}
