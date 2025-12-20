import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* 頂部導航 */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo / 返回首頁 */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">返回首頁</span>
              </Button>
            </Link>
            <Link
              href="/blog"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Image
                src="/1waySEO_icon.svg"
                alt="1waySEO"
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Blog
              </span>
            </Link>
          </div>

          {/* 右側選單 */}
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">主站</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 主要內容 */}
      <main>{children}</main>

      {/* 頁尾 */}
      <footer className="border-t bg-background/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            由{" "}
            <Link href="/" className="font-medium text-primary hover:underline">
              1waySEO
            </Link>{" "}
            AI 驅動的 SEO 寫文平台提供
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/terms" className="hover:underline">
              服務條款
            </Link>
            <Link href="/privacy" className="hover:underline">
              隱私政策
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
