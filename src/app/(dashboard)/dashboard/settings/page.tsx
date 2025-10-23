import { getUser, getUserPrimaryCompany, getCompanyMembers } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateCompany, removeMember } from './actions'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string; info?: string }
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const company = await getUserPrimaryCompany(user.id)

  if (!company) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">您尚未加入任何公司</p>
      </div>
    )
  }

  const members = await getCompanyMembers(company.id)

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">設定</h1>
        <p className="text-muted-foreground mt-2">
          管理您的公司和團隊設定
        </p>
      </div>

      {/* 訊息顯示 */}
      {searchParams.error && (
        <div className="mb-6 rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {searchParams.error}
        </div>
      )}
      {searchParams.success && (
        <div className="mb-6 rounded-md bg-green-500/15 p-4 text-sm text-green-700">
          {searchParams.success}
        </div>
      )}
      {searchParams.info && (
        <div className="mb-6 rounded-md bg-blue-500/15 p-4 text-sm text-blue-700">
          {searchParams.info}
        </div>
      )}

      <div className="grid gap-6">
        {/* 公司設定 */}
        <Card>
          <CardHeader>
            <CardTitle>公司資訊</CardTitle>
            <CardDescription>管理您的公司基本資訊</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCompany} className="space-y-4">
              <input type="hidden" name="companyId" value={company.id} />
              <div className="space-y-2">
                <Label htmlFor="company-name">公司名稱</Label>
                <Input
                  id="company-name"
                  name="companyName"
                  defaultValue={company.name}
                  placeholder="請輸入公司名稱"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-slug">公司識別碼 (Slug)</Label>
                <Input
                  id="company-slug"
                  defaultValue={company.slug}
                  placeholder="company-slug"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  公司識別碼無法修改
                </p>
              </div>
              <div className="space-y-2">
                <Label>訂閱方案</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium uppercase">
                    {company.subscription_tier}
                  </span>
                  <Button variant="outline" size="sm" type="button">
                    升級方案
                  </Button>
                </div>
              </div>
              <Button type="submit">儲存變更</Button>
            </form>
          </CardContent>
        </Card>

        {/* 團隊成員 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>團隊成員</CardTitle>
                <CardDescription>管理團隊成員和權限</CardDescription>
              </div>
              <Button type="button">邀請成員</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {members && members.length > 0 ? (
                <div className="divide-y">
                  {members.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between py-4">
                      <div>
                        <p className="font-medium">{member.users?.email || '未知使用者'}</p>
                        <p className="text-sm text-muted-foreground">
                          加入時間: {new Date(member.joined_at).toLocaleDateString('zh-TW')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                          {member.role}
                        </span>
                        {member.role !== 'owner' && member.user_id !== user.id && (
                          <form action={removeMember} className="inline">
                            <input type="hidden" name="memberId" value={member.id} />
                            <Button
                              variant="outline"
                              size="sm"
                              type="submit"
                              className="text-destructive hover:text-destructive"
                            >
                              移除
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  尚無其他成員
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
