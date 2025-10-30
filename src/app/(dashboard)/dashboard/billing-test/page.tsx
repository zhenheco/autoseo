import { requireOwnerRole } from '@/lib/auth-guard'
import BillingTestClient from './client'

export default async function BillingTestPage() {
  await requireOwnerRole()

  return <BillingTestClient />
}
