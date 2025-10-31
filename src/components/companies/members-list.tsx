'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
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

interface MembersListProps {
  members: Member[] | null
  currentUserId: string
  currentUserRole: string
  companyId: string
}

export function MembersList({ members, currentUserId, currentUserRole, companyId }: MembersListProps) {
  const router = useRouter()
  const [updatingMember, setUpdatingMember] = useState<string | null>(null)

  const canManage = ['owner', 'admin'].includes(currentUserRole)
  const isOwner = currentUserRole === 'owner'

  async function handleRoleChange(memberId: string, newRole: string) {
    setUpdatingMember(memberId)
    try {
      const response = await fetch(`/api/companies/${companyId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        throw new Error('更新角色失敗')
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      alert('更新角色失敗，請稍後再試')
    } finally {
      setUpdatingMember(null)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('確定要移除此成員嗎？')) return

    try {
      const response = await fetch(`/api/companies/${companyId}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('移除成員失敗')
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      alert('移除成員失敗，請稍後再試')
    }
  }

  if (!members || members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        尚無團隊成員
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {members.map((member) => {
        const isSelf = member.user_id === currentUserId
        const canModify = canManage && !isSelf && (isOwner || member.role !== 'owner')

        return (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {member.users?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold">{member.users?.email}</p>
                <p className="text-sm text-muted-foreground">
                  {member.joined_at ? `加入於 ${new Date(member.joined_at).toLocaleDateString('zh-TW')}` : '待接受邀請'}
                </p>
              </div>
              {isSelf && (
                <span className="text-sm text-muted-foreground ml-2">(您)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canModify ? (
                <Select
                  value={member.role}
                  onValueChange={(value) => handleRoleChange(member.id, value)}
                  disabled={updatingMember === member.id}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isOwner && <SelectItem value="owner">擁有者</SelectItem>}
                    <SelectItem value="admin">管理員</SelectItem>
                    <SelectItem value="editor">編輯者</SelectItem>
                    <SelectItem value="writer">寫手</SelectItem>
                    <SelectItem value="viewer">觀察者</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-base font-medium px-3 py-2 bg-primary/10 text-primary rounded-md">
                  {member.role === 'owner' ? '擁有者' :
                   member.role === 'admin' ? '管理員' :
                   member.role === 'editor' ? '編輯者' :
                   member.role === 'writer' ? '寫手' : '觀察者'}
                </span>
              )}

              {canModify && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMember(member.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
