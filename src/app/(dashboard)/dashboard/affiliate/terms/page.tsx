"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/affiliate/apply">
          <Button variant="ghost" className="mb-4">
            ← 返回申請頁面
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">聯盟行銷計畫服務條款</h1>
        <p className="text-muted-foreground">
          本條款規範聯盟夥伴與本平台之間的權利義務關係，請仔細閱讀。
        </p>
      </div>

      <Alert className="mb-6">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>生效日期：</strong>2025 年 1 月 1 日｜
          <strong>最後更新：</strong>2025 年 1 月 6 日
        </AlertDescription>
      </Alert>

      {/* 1. 定義與說明 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>一、定義與說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-foreground">
          <div>
            <p className="font-semibold mb-1">1.1 聯盟夥伴（Affiliate）</p>
            <p className="text-sm pl-4">
              指通過申請並獲得本平台核准，推廣本平台服務並獲得佣金的個人或企業。
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">1.2 推薦連結（Referral Link）</p>
            <p className="text-sm pl-4">
              包含聯盟夥伴專屬推薦碼的網址，用於追蹤推薦來源。
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">
              1.3 推薦客戶（Referred Customer）
            </p>
            <p className="text-sm pl-4">
              透過聯盟夥伴的推薦連結註冊並付費訂閱本平台服務的客戶。
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">1.4 佣金（Commission）</p>
            <p className="text-sm pl-4">
              聯盟夥伴成功推薦客戶後，依據訂閱金額計算的推薦獎金。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2. 佣金制度 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>二、佣金制度</CardTitle>
          <CardDescription>詳細的佣金計算規則與發放方式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold mb-2 text-blue-900">
              2.1 分級佣金比例
            </h4>
            <p className="text-sm text-foreground mb-3">
              佣金比例依據您的有效推薦客戶數量分級計算：
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <div className="bg-white p-2 rounded border text-center">
                <div className="text-xs text-muted-foreground">
                  銅牌 (0-5 人)
                </div>
                <div className="text-lg font-bold text-blue-600">15%</div>
              </div>
              <div className="bg-white p-2 rounded border text-center">
                <div className="text-xs text-muted-foreground">
                  銀牌 (6-15 人)
                </div>
                <div className="text-lg font-bold text-blue-600">20%</div>
              </div>
              <div className="bg-white p-2 rounded border text-center">
                <div className="text-xs text-muted-foreground">
                  金牌 (16-30 人)
                </div>
                <div className="text-lg font-bold text-blue-600">25%</div>
              </div>
              <div className="bg-white p-2 rounded border text-center">
                <div className="text-xs text-muted-foreground">
                  白金 (31+ 人)
                </div>
                <div className="text-lg font-bold text-blue-600">30%</div>
              </div>
            </div>
            <ul className="space-y-1 text-sm text-foreground">
              <li>
                • 計算基準：推薦客戶的<strong>所有付費金額</strong>（訂閱 +
                Credit 包）
              </li>
              <li>
                • 等級升級：達到門檻後<strong>自動升級</strong>，立即適用新比例
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2.2 終身佣金制度</h4>
            <p className="text-sm text-foreground mb-2">
              只要推薦客戶持續訂閱，聯盟夥伴即可持續獲得佣金，但有以下限制：
            </p>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <p className="text-sm font-semibold text-orange-900">
                  不活躍終止條件
                </p>
              </div>
              <p className="text-sm text-foreground">
                若聯盟夥伴連續 <strong>3 個月</strong>{" "}
                沒有新的付費客戶，該夥伴帳號將被標記為「不活躍」，
                並停止所有佣金發放（包括既有客戶的續訂佣金）。
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2.3 鎖定期與提領</h4>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <span>
                  <strong>鎖定期：</strong>佣金產生後需等待{" "}
                  <strong>30 天</strong> 才可提領（用於處理退款與糾紛）
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <span>
                  <strong>最低提領金額：</strong>NT$ <strong>1,000</strong> 元
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <span>
                  <strong>提領週期：</strong>無限制，可隨時提領（達最低金額後）
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <span>
                  <strong>稅務扣繳：</strong>依法扣除所得稅後撥款（境內居民
                  10%，非居民 20%）
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 3. 推薦追蹤規則 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>三、推薦追蹤規則</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">3.1 Cookie 追蹤期限</h4>
            <p className="text-sm text-foreground">
              當潛在客戶點擊推薦連結後，系統會記錄 <strong>30 天</strong>。
              若該客戶在 30 天內註冊並訂閱，該推薦將歸屬於聯盟夥伴。
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3.2 首次點擊優先</h4>
            <p className="text-sm text-foreground">
              若客戶點擊多個不同聯盟夥伴的推薦連結，以
              <strong>第一次點擊</strong>為準。
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3.3 自我推薦限制</h4>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-foreground">
                  <p className="font-semibold text-red-900 mb-1">
                    嚴格禁止自我推薦
                  </p>
                  <p>
                    聯盟夥伴不得使用自己的推薦連結註冊新帳號以賺取佣金。
                    一經發現，將取消聯盟資格並沒收所有佣金。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. 允許與禁止的推廣方式 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>四、允許與禁止的推廣方式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-900">
                  ✅ 允許的推廣方式
                </h4>
              </div>
              <ul className="space-y-2 text-sm text-foreground">
                <li>• 個人部落格、網站文章</li>
                <li>• 社群媒體貼文（Facebook、X、LinkedIn 等）</li>
                <li>• YouTube 影片介紹與評測</li>
                <li>• Email 電子報推薦</li>
                <li>• 線上課程或工作坊中推薦</li>
                <li>• 合法的 SEO 與內容行銷</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-900">
                  ❌ 禁止的推廣方式
                </h4>
              </div>
              <ul className="space-y-2 text-sm text-foreground">
                <li>• 垃圾郵件（Spam）</li>
                <li>• 購買付費搜尋廣告使用品牌關鍵字</li>
                <li>• 虛假或誤導性內容</li>
                <li>• Cookie Stuffing 等作弊手法</li>
                <li>• 冒用本平台名義發送訊息</li>
                <li>• 在色情、賭博等不當網站推廣</li>
                <li>• 侵犯他人著作權或商標權</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. 聯盟夥伴的權利與義務 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>五、聯盟夥伴的權利與義務</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">5.1 權利</h4>
            <ul className="space-y-1 text-sm text-foreground pl-4">
              <li>• 獲得專屬推薦連結與推廣素材</li>
              <li>• 即時查看推薦統計與佣金明細</li>
              <li>• 定期領取合法賺取的佣金</li>
              <li>• 獲得推廣支援與行銷資源</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">5.2 義務</h4>
            <ul className="space-y-1 text-sm text-foreground pl-4">
              <li>• 遵守本服務條款及相關法律規定</li>
              <li>• 提供真實、正確的個人資料與稅務資訊</li>
              <li>• 不得進行任何欺詐、作弊或違規推廣行為</li>
              <li>• 保護推薦連結與帳號安全</li>
              <li>• 尊重本平台的商標與智慧財產權</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 6. 違規處理 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>六、違規處理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p>本平台保留以下權利：</p>
          <ul className="space-y-2 pl-4">
            <li>
              • <strong>警告：</strong>首次輕微違規給予書面警告
            </li>
            <li>
              • <strong>暫停：</strong>嚴重違規暫停聯盟資格 30-90 天
            </li>
            <li>
              • <strong>終止：</strong>重大違規或累犯永久取消資格
            </li>
            <li>
              • <strong>沒收佣金：</strong>因違規產生的佣金將全數沒收
            </li>
            <li>
              • <strong>法律追訴：</strong>涉及詐欺、侵權等行為將追究法律責任
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 7. 條款變更與終止 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>七、條款變更與終止</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <div>
            <h4 className="font-semibold mb-2">7.1 條款變更</h4>
            <p>
              本平台保留隨時修改本條款的權利。重大變更將於生效前 30
              天通知聯盟夥伴。 繼續使用服務視為接受變更後的條款。
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">7.2 終止合作</h4>
            <p>聯盟夥伴或本平台均可隨時終止合作關係：</p>
            <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
              <li>聯盟夥伴可於後台申請退出</li>
              <li>本平台有權因違規或營運考量終止合作</li>
              <li>終止後，已產生且符合提領條件的佣金仍會發放</li>
              <li>鎖定期內的佣金將視情況處理</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 8. 其他條款 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>八、其他條款</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <div>
            <h4 className="font-semibold mb-1">8.1 適用法律</h4>
            <p>本條款適用中華民國法律。</p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">8.2 爭議解決</h4>
            <p>
              因本條款產生的爭議，雙方應先協商解決。協商不成時，同意以台灣桃園地方法院為第一審管轄法院。
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">8.3 隱私保護</h4>
            <p>
              本平台將依據隱私權政策保護聯盟夥伴的個人資料。推薦客戶的個人資料僅供內部統計使用，不會提供給聯盟夥伴。
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">8.4 免責聲明</h4>
            <p>
              本平台不保證聯盟夥伴的收入，佣金取決於推廣成效。本平台對推廣過程中產生的任何糾紛或損失不負責任。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 聯絡資訊 */}
      <Card>
        <CardHeader>
          <CardTitle>九、聯絡我們</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground">
          <p className="mb-2">如對本條款有任何疑問，請聯絡我們：</p>
          <ul className="space-y-1 pl-4">
            <li>• Email: service@1wayseo.com</li>
            <li>• 客服時間：週一至週五 9:00-18:00（台灣時間）</li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>感謝您加入我們的聯盟行銷計畫！</p>
        <p className="mt-2">本條款最後更新：2025 年 1 月 6 日</p>
      </div>
    </div>
  );
}
