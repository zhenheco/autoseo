"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, FileText, Calendar, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TaxNoticePage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/affiliate/apply">
          <Button variant="ghost" className="mb-4">
            ← 返回申請頁面
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">聯盟行銷夥伴稅務須知</h1>
        <p className="text-muted-foreground">
          本文件說明加入本平台聯盟行銷計畫的稅務相關規定，請仔細閱讀。
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>重要提醒：</strong>
          聯盟佣金屬於所得，需依法申報並繳納所得稅。請確實了解相關稅務規定。
        </AlertDescription>
      </Alert>

      {/* 台灣稅務規定 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            一、台灣稅務規定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-3">1. 佣金所得類型</h3>
            <p className="text-foreground">
              聯盟行銷佣金屬於「<strong>其他所得</strong>」（所得稅法第 14 條第
              1 項第 10 類），需併入個人綜合所得稅申報。
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">2. 扣繳義務</h3>
            <p className="text-foreground mb-4">
              根據「各類所得扣繳率標準」規定：
            </p>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold mb-2 text-blue-900">
                  📌 境內居住者（台灣居民）
                </h4>
                <ul className="space-y-2 text-foreground">
                  <li>
                    <strong>年度累計佣金 ≤ NT$20,000</strong>
                    ：免扣繳，但仍需申報所得
                  </li>
                  <li>
                    <strong>年度累計佣金 {">"} NT$20,000</strong>：扣繳稅率{" "}
                    <strong className="text-blue-600">10%</strong>
                  </li>
                  <li>我們將於隔年 1 月底前開立「扣繳憑單」供報稅使用</li>
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="font-semibold mb-2 text-orange-900">
                  📌 非境內居住者（外國人/僑胞）
                </h4>
                <ul className="space-y-2 text-foreground">
                  <li>
                    無論金額大小，一律扣繳{" "}
                    <strong className="text-orange-600">20%</strong>
                  </li>
                  <li>需填寫「非居住者身分聲明書」</li>
                </ul>
              </div>

              <div className="bg-muted p-4 rounded-lg border">
                <p className="text-sm text-foreground">
                  <strong>境內居住者定義：</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                  <li>在台灣有戶籍，且於一課稅年度內在台居住滿 183 天以上</li>
                  <li>或在台灣設有戶籍，並經常居住在台灣</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 扣繳憑單說明 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            二、扣繳憑單說明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-3">什麼是扣繳憑單？</h3>
            <p className="text-foreground">
              扣繳憑單是證明您已預先繳納部分所得稅的文件，報稅時可抵扣應繳稅額。
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">我們的處理方式</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">發放時間</p>
                  <p className="text-sm text-muted-foreground">每年 1 月底前</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">發放條件</p>
                  <p className="text-sm text-muted-foreground">
                    年度累計佣金超過 NT$20,000
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">報稅流程</h3>
            <ol className="list-decimal list-inside space-y-2 text-foreground">
              <li>5 月報稅季時，使用自然人憑證或健保卡線上報稅</li>
              <li>系統會自動帶入我們申報的所得資料</li>
              <li>確認資料無誤後送出申報</li>
              <li>已扣繳的稅額會自動抵扣應繳稅額</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* 實際稅額計算 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            三、實際稅額計算
          </CardTitle>
          <CardDescription>台灣採用累進稅率制度</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              實際應繳稅額會根據您的<strong>年度總所得</strong>
              和適用稅率計算，扣繳的 10% 只是預繳，不是最終稅率。
            </AlertDescription>
          </Alert>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">課稅所得級距</th>
                  <th className="border p-2 text-left">稅率</th>
                  <th className="border p-2 text-left">累進差額</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr>
                  <td className="border p-2">NT$0 - NT$590,000</td>
                  <td className="border p-2 font-semibold">5%</td>
                  <td className="border p-2">NT$0</td>
                </tr>
                <tr>
                  <td className="border p-2">NT$590,001 - NT$1,330,000</td>
                  <td className="border p-2 font-semibold">12%</td>
                  <td className="border p-2">NT$41,300</td>
                </tr>
                <tr>
                  <td className="border p-2">NT$1,330,001 - NT$2,660,000</td>
                  <td className="border p-2 font-semibold">20%</td>
                  <td className="border p-2">NT$147,700</td>
                </tr>
                <tr>
                  <td className="border p-2">NT$2,660,001 - NT$4,980,000</td>
                  <td className="border p-2 font-semibold">30%</td>
                  <td className="border p-2">NT$413,700</td>
                </tr>
                <tr>
                  <td className="border p-2">NT$4,980,001 以上</td>
                  <td className="border p-2 font-semibold">40%</td>
                  <td className="border p-2">NT$911,700</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">💡 計算範例</h4>
            <div className="space-y-2 text-sm text-foreground">
              <p>
                假設您年度佣金收入為 <strong>NT$100,000</strong>，其他收入為{" "}
                <strong>NT$500,000</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>預扣 10%：NT$100,000 × 10% = NT$10,000</li>
                <li>總所得：NT$600,000（扣除免稅額後假設為 NT$510,000）</li>
                <li>應納稅額：NT$510,000 × 5% = NT$25,500（適用 5% 級距）</li>
                <li>
                  退稅：已預扣 NT$10,000，但實際只需繳 NT$25,500，因此無退稅
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 注意事項 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>四、注意事項</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-foreground">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                請確保提供的<strong>身分證字號/統編</strong>和
                <strong>銀行帳戶</strong>資料正確無誤
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                首次提領前需上傳<strong>身分證明文件</strong>和
                <strong>銀行存摺影本</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                提領金額為<strong>扣除稅款後的淨額</strong>（例如：申請提領
                NT$10,000，實際入帳 NT$9,000）
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>如有稅務相關疑問，請諮詢專業會計師或國稅局</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 參考資源 */}
      <Card>
        <CardHeader>
          <CardTitle>五、參考資源</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>
              <a
                href="https://www.ntbna.gov.tw/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-2"
              >
                <span>財政部北區國稅局</span>
                <span className="text-xs">↗</span>
              </a>
            </li>
            <li>
              <a
                href="https://www.etax.nat.gov.tw/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-2"
              >
                <span>財政部電子申報繳稅服務網</span>
                <span className="text-xs">↗</span>
              </a>
            </li>
            <li>
              <a
                href="https://www.mof.gov.tw/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-2"
              >
                <span>財政部官網</span>
                <span className="text-xs">↗</span>
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>本文件僅供參考，實際稅務處理請以國稅局規定為準</p>
        <p className="mt-2">最後更新：2025 年 1 月</p>
      </div>
    </div>
  );
}
