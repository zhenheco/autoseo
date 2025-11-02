import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回首頁
          </Button>
        </Link>

        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            隱私權政策
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. 資料收集</h2>
              <p className="text-slate-600 dark:text-slate-300">
                我們收集您在使用 Auto Pilot SEO 服務時提供的資訊，包括但不限於：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>帳號資訊（電子郵件、姓名）</li>
                <li>使用數據和偏好設定</li>
                <li>付款資訊（由第三方支付服務商處理）</li>
                <li>技術資訊（IP 位址、瀏覽器類型）</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. 資料使用</h2>
              <p className="text-slate-600 dark:text-slate-300">
                我們使用收集的資料用於：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>提供和改善服務</li>
                <li>個人化使用者體驗</li>
                <li>處理交易和訂閱</li>
                <li>發送服務通知和更新</li>
                <li>分析服務使用情況</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. 資料保護</h2>
              <p className="text-slate-600 dark:text-slate-300">
                我們採取適當的安全措施保護您的個人資料，包括：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>資料加密傳輸（SSL/TLS）</li>
                <li>安全的資料庫存儲</li>
                <li>定期安全審查</li>
                <li>員工資料保護培訓</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. 第三方服務</h2>
              <p className="text-slate-600 dark:text-slate-300">
                我們使用以下第三方服務：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>Supabase - 資料庫和認證服務</li>
                <li>Vercel - 網站托管服務</li>
                <li>NewebPay - 支付處理服務</li>
                <li>OpenAI/Anthropic - AI 內容生成服務</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Cookies</h2>
              <p className="text-slate-600 dark:text-slate-300">
                我們使用 Cookies 來：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>維持登入狀態</li>
                <li>記住使用者偏好</li>
                <li>分析網站流量</li>
                <li>改善使用者體驗</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. 您的權利</h2>
              <p className="text-slate-600 dark:text-slate-300">
                您有權：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>查看和更新個人資料</li>
                <li>要求刪除帳號和資料</li>
                <li>匯出您的資料</li>
                <li>選擇退出行銷通訊</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. 聯絡我們</h2>
              <p className="text-slate-600 dark:text-slate-300">
                如對本隱私權政策有任何疑問，請聯絡：
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Email: privacy@auto-pilot-seo.com
              </p>
            </section>

            <section>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                最後更新日期：2025-11-02
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
