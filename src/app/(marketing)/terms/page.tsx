import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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
              <h2 className="text-2xl font-semibold mb-4">
                一、認知與接受條款
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                1waySEO
                服務是由本公司依據本條款所提供之服務（以下簡稱「本服務」）。當您使用
                1waySEO
                時，即表示您已閱讀、瞭解並同意接受本條款之所有內容。若您未滿十八歲，請您在您的家長（或監護人）閱讀、瞭解並同意您將遵守本條款之全部內容後，方得使用
                1waySEO 提供之服務。
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>
                  使用本服務必須先行同意本條款。如您不接受本條款，則不得使用本服務。
                </li>
                <li>
                  您瞭解並同意於使用本服務時，您得以「電子文件」作為表示，例如您在各項服務與功能頁面點選同意或確認等功能鍵時，均視為您正式之意思表示。
                </li>
                <li>
                  本公司可能因服務內容之調整與相關法規之變動，修改或變更本條款之內容，請您隨時檢視本服務條款。如您在任何修改或變更後繼續使用
                  1waySEO，即視為您或您的家長（或監護人）已閱讀、瞭解並同意接受修改或變更後的服務條款。
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                二、雙方權利義務一般條款
              </h2>

              <h3 className="text-xl font-semibold mb-3 mt-6">2.1 服務內容</h3>
              <p className="text-slate-600 dark:text-slate-300">
                「1waySEO」服務是本公司為提升您於搜尋引擎的搜尋排名，為您提供「AI
                驅動內容生成」、「SEO
                優化建議」、「關鍵字策略分析」及「網站內容優化」等服務項目。
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                2.2 會員帳號、密碼及安全
              </h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>
                  申請加入會員時，您應如實提供正確的個人資料。為獲得本服務之某些相關服務，本公司可能要求您提供有關之個人資訊（如身分或聯絡資料），為確保服務登記流程所需或持續使用本服務，若您的個人資料有所變動，請隨時更新。如您提供之個人資料經本公司查證後有不實或不符現況之情況者，本公司保留隨時暫停或終止您使用本服務之權利。
                </li>
                <li>
                  本服務的使用者帳號和密碼由您自行設定。設定完畢後，您具有妥善保管和保密的義務。本公司將以您設定的使用者帳號和密碼來認證您的身分，您必須為經由這個使用者帳號和密碼所進行的所有行為負責。
                </li>
                <li>
                  為維護您的權益，請勿將帳號和密碼提供予他人使用；若因您提供帳號和密碼予他人使用而造成任何損失時，本公司將不負擔相關責任。如果您發現您的使用者名稱和密碼可能遭他人盜用，請立即通知本公司。
                </li>
                <li>
                  本公司遵守 1waySEO
                  隱私權與個人資料保護政策，並依據相關法令規定將會員資料保密或作相關存取、使用、保存或披露，詳細內容請閱讀本公司的隱私權與個人資料保護政策。此政策亦構成本服務條款之一部分。
                </li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                2.3 使用者的守法義務及承諾
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                會員或未註冊為會員之使用者，在使用本服務時，皆應遵守現行法令。您同意並保證不會利用本服務從事侵害他人權益或從事違法之行為，若您有下列任一情事者，經查證屬實，本公司得停止向您提供服務：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>
                  侵害他人名譽、隱私權、營業秘密、商標權、著作權、專利權、其他智慧財產權及其他權利。
                </li>
                <li>違反依法律或契約所應負之保密義務。</li>
                <li>冒用他人名義使用本服務。</li>
                <li>傳輸或散佈電腦病毒。</li>
                <li>
                  不從事妨礙或者破壞服務（或與服務連接之伺服器及網路）的任何活動。
                </li>
                <li>其他本公司有正當理由認為不適當之行為。</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">三、訂閱和付款</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>訂閱按月或年計費，或採用終身方案。</li>
                <li>月費和年費方案將自動續訂，除非取消。</li>
                <li>可隨時取消訂閱，但不退還已支付費用。</li>
                <li>價格可能調整，將提前通知使用者。</li>
                <li>
                  付款資訊由第三方支付服務商（如
                  NewebPay）處理，本公司不儲存完整的付款資訊。
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">四、智慧財產權</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>使用者生成的內容歸使用者所有。</li>
                <li>1waySEO 保留平台和服務的所有權。</li>
                <li>
                  AI
                  生成的內容可由使用者自由使用，但使用者需自行審核和編輯生成的內容。
                </li>
                <li>使用者需確保使用本服務產生的內容不侵犯他人智慧財產權。</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                五、服務限制與責任
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                服務使用限制：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>每月內容生成配額依訂閱方案而定。</li>
                <li>API 請求速率限制。</li>
                <li>儲存空間限制。</li>
                <li>禁止商業轉售服務。</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mb-3 mt-4">
                本公司保留權利：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>進行系統維護和更新。</li>
                <li>暫停或終止違反條款的帳號。</li>
                <li>修改或終止服務功能。</li>
                <li>在緊急情況下中斷服務。</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mb-3 mt-4">
                1waySEO：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>不保證服務無中斷或無錯誤。</li>
                <li>不對間接損失負責。</li>
                <li>不對 AI 生成內容的準確性承擔責任。</li>
                <li>使用者需自行審核和編輯生成的內容。</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">六、帳號終止</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                使用者可隨時終止帳號。本公司保留在以下情況下暫停或終止帳號的權利：
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>違反服務條款。</li>
                <li>濫用服務。</li>
                <li>長期未使用。</li>
                <li>付款失敗。</li>
                <li>提供不實資料。</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">七、一般條款</h2>

              <h3 className="text-xl font-semibold mb-3 mt-6">7.1 契約效力</h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>
                  本條款的任何約定之全部或一部分如被認定無效時，並不影響其他約定的效力。
                </li>
                <li>
                  本契約內容已經您審閱同意。若您不同意本條款之任何一部分，請勿使用本服務。
                </li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                7.2 準據法與管轄法院
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                本服務條款之解釋與適用，以及與本服務條款有關的爭議，均應依照中華民國法律予以處理，並以台灣台北地方法院為第一審合意排他管轄法院。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">八、聯絡我們</h2>
              <p className="text-slate-600 dark:text-slate-300">
                如對服務條款有任何疑問，請聯絡：
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                Email: service@1wayseo.com
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
  );
}
