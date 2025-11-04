import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="container mx-auto p-8 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">沒有權限</CardTitle>
          <CardDescription className="text-base mt-2">
            您沒有權限查看這個頁面
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            如果您認為這是錯誤，請聯絡您的管理員以獲取相應的權限。
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard/articles">
              <Button variant="outline">返回文章管理</Button>
            </Link>
            <Link href="/dashboard">
              <Button>返回首頁</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
