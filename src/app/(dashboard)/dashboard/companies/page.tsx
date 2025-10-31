import { getUser, getUserCompanies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Building2, Users, Settings } from 'lucide-react'
import Link from 'next/link'
import { CreateCompanyDialog } from '@/components/companies/create-company-dialog'
import { DeleteCompanyButton } from '@/components/companies/delete-company-button'

export default async function CompaniesPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const companies = await getUserCompanies(user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">公司管理</h1>
          <p className="text-muted-foreground mt-1">
            管理您的公司和團隊成員
          </p>
        </div>
        <CreateCompanyDialog />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {companies?.map((item) => {
          const company = (item as any).companies
          const role = (item as any).role

          return (
            <Card
              key={company.id}
              className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl card-hover-lift hover:shadow-xl hover:border-primary/50 transition-all"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{company.name}</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {role === 'owner' ? '擁有者' : role === 'admin' ? '管理員' : role === 'editor' ? '編輯者' : role === 'writer' ? '寫手' : '觀察者'}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-base text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>團隊成員</span>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/dashboard/companies/${company.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        管理設定
                      </Button>
                    </Link>
                    {role === 'owner' && (
                      <DeleteCompanyButton companyId={company.id} companyName={company.name} />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {companies?.length === 0 && (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">尚無公司</h3>
              <p className="text-base text-muted-foreground mb-6">開始建立您的第一個公司</p>
              <CreateCompanyDialog />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
