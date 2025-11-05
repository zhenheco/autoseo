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
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                本公司（Auto Pilot SEO 服務提供者，以下稱「我們」）感謝您的信賴，我們非常重視您的個人資料保護，且遵循隱私權保護及《個人資料保護法》之相關法令規定。以下是我們的隱私權與個人資料保護政策（以下稱「本政策」），包括我們會蒐集哪些個人資料與如何使用，以及說明與您隱私相關的其他事項。當您開始使用 Auto Pilot SEO 服務時，表示您認同本政策，亦同意受本政策保護。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">一、我們收集的個人資料和其他資料</h2>

              <p className="text-slate-600 dark:text-slate-300 mb-3">
                當您註冊成為 Auto Pilot SEO 會員時，需登入名稱以及電子郵件信箱。若您使用 Google 或其他網站（以下稱「第三方網站」）註冊成為 Auto Pilot SEO 會員時，即同意我們蒐集您於第三方網站帳號的身分資料以及其他資料，包括您的姓名、個人資料圖片、國籍、電子郵件信箱、出生年月日、性別等。我們可能需要驗證您提供的資料與該第三方網站所載資料一致，並根據本政策儲存與使用上述資料（以下稱「個人資料」）。
              </p>

              <p className="text-slate-600 dark:text-slate-300 mb-3">
                當您報名 Auto Pilot SEO 的活動時，根據主辦單位的需要及活動性質，我們可能要求您提供姓名、身分證字號、出生年月日、地址、電話號碼、電子郵件信箱、性別等。休閒活動或興趣、職業，或其他相關資料（以下稱「活動個資」）。
              </p>

              <p className="text-slate-600 dark:text-slate-300 mb-3">
                當您使用 Auto Pilot SEO 網站時，我們可能會蒐集：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>您在 Auto Pilot SEO 的資料，包含您的使用紀錄、搜尋紀錄等。</li>
                <li>技術資料，包含URL、IP地址、瀏覽器類型、作業系統資料、語言、造訪時間與地點等，我們可能透過 cookie 取得這些資料，以提供網頁上的各種功能。（以下稱「使用與技術資料」）</li>
                <li>第三方網站提供的資料。您可以在使用 Auto Pilot SEO 時授權同意我們取得您的 Google Search Console 或 Google Analytics 資料。</li>
              </ul>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                為提供您正確、迅速的服務，當您使用 Auto Pilot SEO 服務時（例如申請帳戶異動、提供建議，或參與我們的行銷活動等)，您需要提供會員帳號資料、個人聯繫方式或其他資訊。
              </p>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                我們將整合您的使用與技術資料，以及您個人資料中的非個人識別資訊。這些整合資訊在共同處理之下，將視同您的個人資料作業。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">二、我們如何使用您的資訊</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                我們收集到您的個人資料，將使用於以下服務：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>您所提供的個人資料，將用來識別會員身分、與您聯繫、完成交易、寄送收據、通知行銷活動、提供 Auto Pilot SEO 服務或其他與 Auto Pilot SEO 服務相關的更新通知。</li>
                <li>我們將利用您的個人資料，寄送電子報及不定期的行銷活動通知。</li>
                <li>您在 Auto Pilot SEO 的個人資料、使用與技術資料及其他相關資料，將提供我們改善 Auto Pilot SEO 服務、開發新服務，與會員溝通之用，包括內部稽核、研究、分析等。</li>
                <li>若您授權 Auto Pilot SEO 取得您的 Google Search Console 或 Google Analytics 資料，我們將會使用授權取得的資訊協助您分析您的網站狀態。</li>
              </ul>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                我們不會將您的個人資料使用於本政策所未明訂之目的，除非有額外需求並經過您的書面同意。
              </p>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                我們可能與第三方共用綜合性的非個人資料。「綜合性非個人資料」為記錄有關用戶並被分組收集的資料，這些資料已不再反映或可識別出特定的使用者。
              </p>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                上述資訊之處理與利用，可能由我們之關係企業或其他合作夥伴進行，或於境外發生。我們不會將您的個人資料或活動個資做其他用途，除非當地法律另有規定。我們不會未經您事先同意向第三者透露您的個人資料，但因國家重大利益或為配合執法機關調查且根據法律而需要透露者則不在此限。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">三、您可以如何使用您的資訊</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>您本人可透過登入 Auto Pilot SEO 查詢、檢視、變動、更新，或複製屬於您的個人資料；若您非會員或我們無法驗證您的會員身分時，您必須提供相關個人資料，讓我們得以協助您處理查詢、檢視、變動、更新，或複製您的個人資料及帳號。</li>
                <li>您本人可要求終止使用或刪除您的個人資料；但一經終止或刪除，您將無法繼續使用本網站 Auto Pilot SEO 服務。</li>
                <li>若您提出變動、更新或刪除您的個人資料的請求，有妨害國家重大利益、妨害公務機關執行法定職務、妨害第三人重大利益之虞，我們有權拒絕您的請求。</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">四、個人資料安全</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>您的個人資料將儲存於我們的伺服器。為確保您的隱私，我們會採取必要之技術及措施保護您的個人資料，包括資料加密傳輸（SSL/TLS）、安全的資料庫存儲、定期安全審查等。</li>
                <li>我們僅基於上述目的儲存您的個人資料。因此，我們將在您終止使用 Auto Pilot SEO 服務時刪除您的個人資料。</li>
                <li>您的個人資料與活動個資，請務必妥善保管。於個人或他人、公用電腦/電子裝置上使用我們的線上服務後，必要時請登出或關閉軟體與瀏覽器視窗，以免您的個人資料與活動個資遭人盜用。</li>
                <li>您的付款資訊（含信用卡資料），請務必妥善保管，切勿告知他人。</li>
                <li>Auto Pilot SEO 有可能包含其他非我們網站或網頁連結與視窗，若您提供該網站您的個人資料，我們不負任何責任。</li>
                <li>您同意在 Auto Pilot SEO 相關網站進行消費時所使用的資料與事實相符，如嗣後發現您的個人資料遭他人非法使用或有任何異常時，應主動通知我們。</li>
                <li>您同意於使用 Auto Pilot SEO 服務時，所提供與使用之資料皆為合法，並無侵害第三人權利、違反第三方協議或涉及任何違法行為。如因使用 Auto Pilot SEO 服務而致第三人損害，除我們故意或重大過失外，我們不負擔相關賠償責任。</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">五、第三方服務</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                我們使用以下第三方服務：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Supabase - 資料庫和認證服務</li>
                <li>Vercel - 網站托管服務</li>
                <li>NewebPay - 支付處理服務</li>
                <li>OpenAI/Anthropic - AI 內容生成服務</li>
                <li>Google Search Console / Google Analytics - 網站數據分析（需使用者授權）</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">六、Cookies</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                我們使用 Cookies 來：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>維持登入狀態</li>
                <li>記住使用者偏好</li>
                <li>分析網站流量</li>
                <li>改善使用者體驗</li>
                <li>提供網頁上的各種功能</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">七、隱私權與個人資料保護政策之修訂與效力</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>我們將不定時更新本政策，並遵循當地隱私權與個人資料保護相關法令，當我們做出重大修改時，會於官方網站公布相關事宜。</li>
                <li>本隱私權與個人資料保護政策構成 Auto Pilot SEO 使用條款的一部分。如您不同意本政策之任何條款或修改變更之內容，請您立即停止使用 Auto Pilot SEO 服務。</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">八、聯絡我們</h2>
              <p className="text-slate-600 dark:text-slate-300">
                如果您對我們的隱私權或個人資料保護政策有任何問題，請聯絡：
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                Email: privacy@auto-pilot-seo.com
              </p>
            </section>

            <section>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                最後更新日期：2025-11-05
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
