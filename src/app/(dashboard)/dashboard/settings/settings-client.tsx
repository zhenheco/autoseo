'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InviteMemberDialog } from '@/components/companies/invite-member-dialog'
import { MembersList } from '@/components/companies/members-list'
import { updateCompany } from './actions'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  user_id: string
  role: string
  joined_at: string | null
  status: string
  users: {
    email: string
  } | null
}

interface Company {
  id: string
  name: string
  slug: string
  subscription_tier: string
}

interface SettingsClientProps {
  company: Company
  members: Member[] | null
  currentUserId: string
  currentUserRole: string
  searchParams: { error?: string; success?: string; info?: string }
}

export function SettingsClient({
  company,
  members,
  currentUserId,
  currentUserRole,
  searchParams
}: SettingsClientProps) {
  const router = useRouter()

  const canManageMembers = ['owner', 'admin'].includes(currentUserRole)

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">設定</h1>
        <p className="text-muted-foreground mt-2">
          管理您的公司和團隊設定
        </p>
      </div>

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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>團隊成員</CardTitle>
                <CardDescription>管理團隊成員和權限</CardDescription>
              </div>
              {canManageMembers && (
                <InviteMemberDialog companyId={company.id} currentRole={currentUserRole} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <MembersList
              members={members}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              companyId={company.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
