import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { ExternalWebsiteList } from "./ExternalWebsiteList";

export default async function ExternalWebsitesPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // 驗證管理員權限
  if (!isAdminEmail(user.email)) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("您沒有權限訪問此頁面"));
  }

  return <ExternalWebsiteList />;
}
