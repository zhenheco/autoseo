import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewWebsiteForm } from "./NewWebsiteForm";

export default async function NewWebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const company = await getUserPrimaryCompany(user.id);

  if (!company) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">您尚未加入任何公司</p>
      </div>
    );
  }

  const params = await searchParams;

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">新增 WordPress 網站</h1>
        <p className="text-muted-foreground mt-2">
          連接您的 WordPress 網站以開始自動發布文章
        </p>
      </div>

      {/* 錯誤訊息顯示 */}
      {params.error && (
        <div className="mb-6 rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {params.error}
        </div>
      )}

      <NewWebsiteForm companyId={company.id} />
    </div>
  );
}
