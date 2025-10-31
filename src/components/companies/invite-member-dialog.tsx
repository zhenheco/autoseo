'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface InviteMemberDialogProps {
  companyId: string
  currentRole: string
}

export function InviteMemberDialog({ companyId, currentRole }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('writer')
  const router = useRouter()

  const isOwner = currentRole === 'owner'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/companies/${companyId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '邀請成員失敗')
      }

      setOpen(false)
      setEmail('')
      setRole('writer')
      router.refresh()
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : '邀請成員失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          邀請成員
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-2xl">邀請團隊成員</DialogTitle>
            <DialogDescription className="text-base">
              輸入成員的電子郵件地址和角色
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-base">
                電子郵件
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role" className="text-base">
                角色
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="admin">管理員</SelectItem>}
                  <SelectItem value="editor">編輯者</SelectItem>
                  <SelectItem value="writer">寫手</SelectItem>
                  <SelectItem value="viewer">觀察者</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {role === 'admin' && '可管理網站和成員，查看所有資料'}
                {role === 'editor' && '可編輯指定網站和生成文章'}
                {role === 'writer' && '可生成文章並查看自己的內容'}
                {role === 'viewer' && '僅可查看自己的文章'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || !email}>
              {loading ? '邀請中...' : '發送邀請'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
