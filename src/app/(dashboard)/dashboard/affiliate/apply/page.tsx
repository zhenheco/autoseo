"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AffiliateApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    id_number: "",
    phone: "",
    email: "",
    address: "",
    is_resident: true,
    agree_terms: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/affiliate/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "申請失敗");
      }

      alert("申請成功！");
      router.push("/dashboard/affiliate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">申請成為聯盟夥伴</h1>
        <p className="mt-2 text-slate-400">
          加入我們的聯盟計畫，推薦新客戶即可獲得 15%~30% 佣金（依推薦人數分級）
        </p>
      </div>

      <div className="mb-6 rounded-md bg-cyber-violet-500/10 border border-cyber-violet-500/30 p-4">
        <p className="text-sm text-slate-300">
          <strong className="text-white">申請資格：</strong>
          所有已註冊用戶皆可申請。詳細規範請參閱{" "}
          <Link
            href="/dashboard/affiliate/terms"
            className="font-medium underline text-cyber-violet-400 hover:text-cyber-violet-300"
          >
            聯盟行銷計畫服務條款
          </Link>
          。
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-500/15 border border-red-500/30 p-4 text-red-400">
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300">
            真實姓名 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.full_name}
            onChange={(e) =>
              setFormData({ ...formData, full_name: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
            placeholder="請填寫與身份證相符的姓名"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            身份證字號/統一編號 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.id_number}
            onChange={(e) =>
              setFormData({
                ...formData,
                id_number: e.target.value.toUpperCase(),
              })
            }
            className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
            placeholder="A123456789 或 12345678"
          />
          <p className="mt-1 text-sm text-slate-500">
            個人：身份證字號，公司：統一編號
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            聯絡電話 <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
            placeholder="0912345678"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            地址 <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            rows={3}
            className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
            placeholder="請填寫完整地址"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            稅務身份
          </label>
          <div className="mt-2 space-y-2">
            <label className="flex items-center text-slate-300">
              <input
                type="radio"
                checked={formData.is_resident}
                onChange={() => setFormData({ ...formData, is_resident: true })}
                className="mr-2"
              />
              <span>境內居住者（扣繳 10%）</span>
            </label>
            <label className="flex items-center text-slate-300">
              <input
                type="radio"
                checked={!formData.is_resident}
                onChange={() =>
                  setFormData({ ...formData, is_resident: false })
                }
                className="mr-2"
              />
              <span>非境內居住者（扣繳 20%）</span>
            </label>
          </div>
        </div>

        <div className="rounded-md bg-cyber-violet-500/10 border border-cyber-violet-500/30 p-4">
          <h3 className="font-medium text-white">佣金規則</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li>• 佣金比例：15%~30%（依推薦人數分級：銅牌 15% → 白金 30%）</li>
            <li>• 鎖定期：30 天</li>
            <li>• 最低提領：NT$1,000</li>
            <li>• 分潤期限：終身（連續 3 個月無新客戶則停止）</li>
          </ul>
        </div>

        <div>
          <label className="flex items-start">
            <input
              type="checkbox"
              required
              checked={formData.agree_terms}
              onChange={(e) =>
                setFormData({ ...formData, agree_terms: e.target.checked })
              }
              className="mr-2 mt-1"
            />
            <span className="text-sm text-slate-300">
              我已閱讀並同意
              <Link
                href="/dashboard/affiliate/tax-notice"
                target="_blank"
                className="text-cyber-violet-400 hover:underline mx-1"
              >
                聯盟行銷夥伴稅務須知
              </Link>
              及
              <Link
                href="/dashboard/affiliate/terms"
                target="_blank"
                className="text-cyber-violet-400 hover:underline mx-1"
              >
                服務條款
              </Link>
              <span className="text-red-400">*</span>
            </span>
          </label>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:bg-slate-600"
          >
            {loading ? "處理中..." : "提交申請"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-white/10 px-4 py-2 text-slate-300 hover:bg-white/5"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
