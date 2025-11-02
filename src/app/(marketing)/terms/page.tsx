import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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
            服務條款
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. 服務說明</h2>
              <p className="text-slate-600 dark:text-slate-300">
                Auto Pilot SEO 提供 AI 驅動的內容生成和 SEO 優化服務。使用本服務即表示您同意遵守以下條款。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. 使用者責任</h2>
              <p className="text-slate-600 dark:text-slate-300">
                使用者須：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>提供真實、準確的註冊資訊</li>
                <li>保護帳號安全和密碼機密性</li>
                <li>遵守所有適用法律和規定</li>
                <li>不濫用服務或進行未經授權的存取</li>
                <li>尊重他人的智慧財產權</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. 訂閱和付款</h2>
              <p className="text-slate-600 dark:text-slate-300">
                訂閱條款：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>訂閱按月或年計費</li>
                <li>自動續訂，除非取消</li>
                <li>可隨時取消，但不退還已支付費用</li>
                <li>價格可能調整，將提前通知</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. 智慧財產權</h2>
              <p className="text-slate-600 dark:text-slate-300">
                關於內容權利：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>使用者生成的內容歸使用者所有</li>
                <li>Auto Pilot SEO 保留平台和服務的所有權</li>
                <li>AI 生成的內容可由使用者自由使用</li>
                <li>使用者需確保內容不侵權</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. 服務限制</h2>
              <p className="text-slate-600 dark:text-slate-300">
                服務使用限制：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>每月內容生成配額依訂閱方案而定</li>
                <li>API 請求速率限制</li>
                <li>儲存空間限制</li>
                <li>禁止商業轉售服務</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. 服務中斷</h2>
              <p className="text-slate-600 dark:text-slate-300">
                我們保留權利：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>進行系統維護和更新</li>
                <li>暫停或終止違反條款的帳號</li>
                <li>修改或終止服務功能</li>
                <li>在緊急情況下中斷服務</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. 責任限制</h2>
              <p className="text-slate-600 dark:text-slate-300">
                Auto Pilot SEO：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>不保證服務無中斷或無錯誤</li>
                <li>不對間接損失負責</li>
                <li>不對 AI 生成內容的準確性承擔責任</li>
                <li>使用者需自行審核和編輯生成的內容</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. 條款變更</h2>
              <p className="text-slate-600 dark:text-slate-300">
                我們可能更新本條款，並將通過電子郵件或網站通知。繼續使用服務即表示接受更新後的條款。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. 帳號終止</h2>
              <p className="text-slate-600 dark:text-slate-300">
                使用者可隨時終止帳號。我們保留在以下情況下終止帳號的權利：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300">
                <li>違反服務條款</li>
                <li>濫用服務</li>
                <li>長期未使用</li>
                <li>付款失敗</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. 聯絡我們</h2>
              <p className="text-slate-600 dark:text-slate-300">
                如對服務條款有任何疑問，請聯絡：
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Email: support@auto-pilot-seo.com
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
