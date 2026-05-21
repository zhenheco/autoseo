"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

// ========================================
// 型別定義
// ========================================

export type InvoiceCarrierType = "MOBILE" | "CERTIFICATE" | "DONATE";

export interface InvoiceFormData {
  buyerName?: string;
  buyerTaxId?: string;
  buyerEmail?: string;
  buyerAddress?: string;
  buyerPhone?: string;
  carrierType?: InvoiceCarrierType;
  carrierId?: string;
}

export type InvoiceType = "personal" | "company" | "donate";

interface InvoiceFormProps {
  value: InvoiceFormData;
  onChange: (data: InvoiceFormData) => void;
  className?: string;
  disabled?: boolean;
}

// ========================================
// 常見捐贈碼
// ========================================

const COMMON_DONATE_CODES = [
  { code: "25885", name: "伊甸基金會" },
  { code: "8585", name: "喜憨兒基金會" },
  { code: "7000", name: "家扶基金會" },
  { code: "8957282", name: "世界展望會" },
  { code: "2345", name: "陽光基金會" },
] as const;

// ========================================
// 驗證工具
// ========================================

export function isValidTaxId(taxId: string): boolean {
  if (!/^\d{8}$/.test(taxId)) return false;
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const product = parseInt(taxId[i], 10) * weights[i];
    sum += Math.floor(product / 10) + (product % 10);
  }
  if (sum % 5 === 0) return true;
  if (taxId[6] === "7" && (sum + 1) % 5 === 0) return true;
  return false;
}

export function isValidMobileCarrier(id: string): boolean {
  return /^\/[A-Z0-9+\-.]{7}$/.test(id);
}

export function isValidCertificateCarrier(id: string): boolean {
  return /^[A-Z]{2}\d{14}$/.test(id);
}

// ========================================
// 元件
// ========================================

export function InvoiceForm({
  value,
  onChange,
  className = "",
  disabled = false,
}: InvoiceFormProps) {
  const t = useTranslations("invoice");

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(() => {
    if (value.buyerTaxId) return "company";
    if (value.carrierType === "DONATE") return "donate";
    return "personal";
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback(
    (field: keyof InvoiceFormData, fieldValue: string | undefined) => {
      onChange({ ...value, [field]: fieldValue });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [value, onChange],
  );

  const handleTypeChange = useCallback(
    (type: InvoiceType) => {
      setInvoiceType(type);
      setErrors({});

      switch (type) {
        case "personal":
          onChange({
            ...value,
            buyerTaxId: undefined,
            carrierType: "MOBILE",
            carrierId: value.carrierType === "MOBILE" ? value.carrierId : "",
          });
          break;
        case "company":
          onChange({
            ...value,
            carrierType: undefined,
            carrierId: undefined,
            buyerTaxId: value.buyerTaxId || "",
          });
          break;
        case "donate":
          onChange({
            ...value,
            buyerTaxId: undefined,
            carrierType: "DONATE",
            carrierId: value.carrierId || COMMON_DONATE_CODES[0].code,
          });
          break;
      }
    },
    [value, onChange],
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 發票類型選擇 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("invoiceType")}
        </label>
        <div className="flex gap-2">
          {[
            { type: "personal" as const, label: t("personal") },
            { type: "company" as const, label: t("company") },
            { type: "donate" as const, label: t("donate") },
          ].map(({ type, label }) => (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => handleTypeChange(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                invoiceType === type
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              } disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 個人發票 - 載具選擇 */}
      {invoiceType === "personal" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("carrierType")}
            </label>
            <select
              value={value.carrierType || "MOBILE"}
              onChange={(e) => {
                const type = e.target.value as InvoiceCarrierType;
                updateField("carrierType", type);
                updateField("carrierId", "");
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="MOBILE">{t("mobileBarcode")}</option>
              <option value="CERTIFICATE">{t("certificate")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {value.carrierType === "CERTIFICATE"
                ? t("certificateNumber")
                : t("mobileBarcode")}
            </label>
            <input
              type="text"
              value={value.carrierId || ""}
              onChange={(e) =>
                updateField("carrierId", e.target.value.toUpperCase())
              }
              placeholder={
                value.carrierType === "CERTIFICATE"
                  ? "AB12345678901234"
                  : "/ABC+123"
              }
              disabled={disabled}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 ${
                errors.carrierId ? "border-red-500" : ""
              }`}
            />
            {errors.carrierId && (
              <p className="mt-1 text-xs text-red-500">{errors.carrierId}</p>
            )}
            {value.carrierType === "MOBILE" && !value.carrierId && (
              <p className="mt-1 text-xs text-gray-400">
                {t("emailAsCarrierHint")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 公司戶 - 統編 */}
      {invoiceType === "company" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("taxId")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.buyerTaxId || ""}
              onChange={(e) =>
                updateField(
                  "buyerTaxId",
                  e.target.value.replace(/\D/g, "").slice(0, 8),
                )
              }
              placeholder="12345678"
              disabled={disabled}
              maxLength={8}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 ${
                errors.buyerTaxId ? "border-red-500" : ""
              }`}
            />
            {errors.buyerTaxId && (
              <p className="mt-1 text-xs text-red-500">{errors.buyerTaxId}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("companyName")}
            </label>
            <input
              type="text"
              value={value.buyerName || ""}
              onChange={(e) => updateField("buyerName", e.target.value)}
              placeholder={t("companyNamePlaceholder")}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
        </div>
      )}

      {/* 捐贈 */}
      {invoiceType === "donate" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("donateOrg")}
            </label>
            <select
              value={
                COMMON_DONATE_CODES.find((d) => d.code === value.carrierId)
                  ? value.carrierId
                  : "custom"
              }
              onChange={(e) => {
                if (e.target.value === "custom") {
                  updateField("carrierId", "");
                } else {
                  updateField("carrierId", e.target.value);
                }
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700"
            >
              {COMMON_DONATE_CODES.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}（{code}）
                </option>
              ))}
              <option value="custom">{t("customDonateCode")}</option>
            </select>
          </div>
          {!COMMON_DONATE_CODES.find((d) => d.code === value.carrierId) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("donateCode")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={value.carrierId || ""}
                onChange={(e) =>
                  updateField("carrierId", e.target.value.replace(/\D/g, ""))
                }
                placeholder={t("donateCodePlaceholder")}
                disabled={disabled}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 ${
                  errors.carrierId ? "border-red-500" : ""
                }`}
              />
              {errors.carrierId && (
                <p className="mt-1 text-xs text-red-500">{errors.carrierId}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========================================
// 導出
// ========================================

export { COMMON_DONATE_CODES };

export function validateInvoiceData(data: InvoiceFormData): {
  valid: boolean;
  error?: string;
} {
  if (data.buyerTaxId) {
    if (!isValidTaxId(data.buyerTaxId)) {
      return { valid: false, error: "統一編號格式不正確" };
    }
  }

  if (data.carrierType === "MOBILE" && data.carrierId) {
    if (!isValidMobileCarrier(data.carrierId)) {
      return { valid: false, error: "手機條碼格式不正確" };
    }
  }

  if (data.carrierType === "CERTIFICATE" && data.carrierId) {
    if (!isValidCertificateCarrier(data.carrierId)) {
      return { valid: false, error: "自然人憑證格式不正確" };
    }
  }

  if (data.carrierType === "DONATE" && !data.carrierId?.trim()) {
    return { valid: false, error: "請選擇捐贈機構" };
  }

  return { valid: true };
}
