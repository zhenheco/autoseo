import Link from 'next/link'
import { signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">建立帳號</CardTitle>
          <CardDescription>
            輸入您的 Email 以建立新帳號
          </CardDescription>
        </CardHeader>
        <form action={signup}>
          <CardContent className="space-y-4">
            {params.error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {params.error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                密碼至少需要 6 個字元
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">
              註冊
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              已經有帳號了？{' '}
              <Link href="/login" className="text-primary hover:underline">
                立即登入
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
