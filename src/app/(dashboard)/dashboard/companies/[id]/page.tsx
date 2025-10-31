import { getUser, getCompanyMembers } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, Shield, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { MembersList } from '@/components/companies/members-list'
import { InviteMemberDialog } from '@/components/companies/invite-member-dialog'

interface Props {
  params: Promise<{
    id: string
  }>
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (companyError || !company) {
    redirect('/dashboard/companies')
  }

  const { data: currentMember } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', id)
    .eq('user_id', user.id)
    .single()

  if (!currentMember) {
    redirect('/dashboard/companies')
  }

  const members = await getCompanyMembers(id)

  const canManageMembers = ['owner', 'admin'].includes(currentMember.role)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/companies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{company.name}</h1>
          <p className="text-muted-foreground mt-1">
            管理公司成員和權限設定
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl">公司資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-base text-muted-foreground">公司名稱</p>
              <p className="text-lg font-semibold">{company.name}</p>
            </div>
            <div>
              <p className="text-base text-muted-foreground">訂閱方案</p>
              <p className="text-lg font-semibold capitalize">{company.subscription_tier}</p>
            </div>
            <div>
              <p className="text-base text-muted-foreground">您的角色</p>
              <p className="text-lg font-semibold">
                {currentMember.role === 'owner' ? '擁有者' :
                 currentMember.role === 'admin' ? '管理員' :
                 currentMember.role === 'editor' ? '編輯者' :
                 currentMember.role === 'writer' ? '寫手' : '觀察者'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Users className="h-6 w-6" />
                  團隊成員
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  管理公司的團隊成員和角色權限
                </CardDescription>
              </div>
              {canManageMembers && (
                <InviteMemberDialog companyId={id} currentRole={currentMember.role} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <MembersList
              members={members}
              currentUserId={user.id}
              currentUserRole={currentMember.role}
              companyId={id}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Shield className="h-6 w-6" />
            角色權限說明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 rounded-xl bg-accent/50">
              <h3 className="text-lg font-semibold mb-2">擁有者 (Owner)</h3>
              <ul className="text-base text-muted-foreground space-y-1">
                <li>• 完整的公司管理權限</li>
                <li>• 管理訂閱和計費</li>
                <li>• 邀請和移除所有成員</li>
                <li>• 查看所有活動日誌</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-accent/50">
              <h3 className="text-lg font-semibold mb-2">管理員 (Admin)</h3>
              <ul className="text-base text-muted-foreground space-y-1">
                <li>• 管理網站配置</li>
                <li>• 邀請 Editor/Writer/Viewer</li>
                <li>• 查看所有文章和統計</li>
                <li>• 查看活動日誌</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-accent/50">
              <h3 className="text-lg font-semibold mb-2">編輯者 (Editor)</h3>
              <ul className="text-base text-muted-foreground space-y-1">
                <li>• 編輯指定網站</li>
                <li>• 邀請 Writer</li>
                <li>• 生成和管理文章</li>
                <li>• 查看團隊文章</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-accent/50">
              <h3 className="text-lg font-semibold mb-2">寫手 (Writer)</h3>
              <ul className="text-base text-muted-foreground space-y-1">
                <li>• 生成文章</li>
                <li>• 查看自己的文章</li>
                <li>• 查看自己的使用統計</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-accent/50">
              <h3 className="text-lg font-semibold mb-2">觀察者 (Viewer)</h3>
              <ul className="text-base text-muted-foreground space-y-1">
                <li>• 查看自己的文章</li>
                <li>• 僅限閱讀權限</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
