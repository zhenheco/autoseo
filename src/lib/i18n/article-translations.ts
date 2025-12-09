/**
 * Article content translations for 18 supported languages
 * These are user-visible labels that appear in generated articles
 */

// Special block labels (tips, warnings, local advantages)
export const SPECIAL_BLOCK_LABELS = {
  tip: {
    "zh-TW": "小提醒",
    "zh-CN": "小提示",
    "en-US": "Tip",
    "ja-JP": "ヒント",
    "ko-KR": "팁",
    "vi-VN": "Mẹo",
    "ms-MY": "Petua",
    "th-TH": "เคล็ดลับ",
    "id-ID": "Tips",
    "tl-PH": "Tip",
    "fr-FR": "Conseil",
    "de-DE": "Tipp",
    "es-ES": "Consejo",
    "pt-PT": "Dica",
    "it-IT": "Suggerimento",
    "ru-RU": "Совет",
    "ar-SA": "نصيحة",
    "hi-IN": "सुझाव",
  },
  warning: {
    "zh-TW": "注意事項",
    "zh-CN": "注意事项",
    "en-US": "Warning",
    "ja-JP": "注意",
    "ko-KR": "주의",
    "vi-VN": "Lưu ý",
    "ms-MY": "Amaran",
    "th-TH": "คำเตือน",
    "id-ID": "Peringatan",
    "tl-PH": "Babala",
    "fr-FR": "Attention",
    "de-DE": "Achtung",
    "es-ES": "Advertencia",
    "pt-PT": "Aviso",
    "it-IT": "Attenzione",
    "ru-RU": "Внимание",
    "ar-SA": "تحذير",
    "hi-IN": "चेतावनी",
  },
  local_advantage: {
    "zh-TW": "本地優勢",
    "zh-CN": "本地优势",
    "en-US": "Local Advantage",
    "ja-JP": "地域の強み",
    "ko-KR": "지역 장점",
    "vi-VN": "Lợi thế địa phương",
    "ms-MY": "Kelebihan Tempatan",
    "th-TH": "ข้อได้เปรียบในท้องถิ่น",
    "id-ID": "Keunggulan Lokal",
    "tl-PH": "Bentahe sa Lokal",
    "fr-FR": "Avantage Local",
    "de-DE": "Lokaler Vorteil",
    "es-ES": "Ventaja Local",
    "pt-PT": "Vantagem Local",
    "it-IT": "Vantaggio Locale",
    "ru-RU": "Местное преимущество",
    "ar-SA": "ميزة محلية",
    "hi-IN": "स्थानीय लाभ",
  },
} as const;

// FAQ section headers
export const FAQ_HEADERS: Record<string, string> = {
  "zh-TW": "常見問題",
  "zh-CN": "常见问题",
  "en-US": "Frequently Asked Questions",
  "ja-JP": "よくある質問",
  "ko-KR": "자주 묻는 질문",
  "vi-VN": "Câu hỏi thường gặp",
  "ms-MY": "Soalan Lazim",
  "th-TH": "คำถามที่พบบ่อย",
  "id-ID": "Pertanyaan Umum",
  "tl-PH": "Mga Madalas Itanong",
  "fr-FR": "Questions Fréquentes",
  "de-DE": "Häufig gestellte Fragen",
  "es-ES": "Preguntas Frecuentes",
  "pt-PT": "Perguntas Frequentes",
  "it-IT": "Domande Frequenti",
  "ru-RU": "Часто задаваемые вопросы",
  "ar-SA": "الأسئلة الشائعة",
  "hi-IN": "अक्सर पूछे जाने वाले प्रश्न",
};

// Image alt text suffixes
export const IMAGE_ALT_SUFFIXES: Record<string, string> = {
  "zh-TW": "說明圖片",
  "zh-CN": "说明图片",
  "en-US": "illustration",
  "ja-JP": "説明画像",
  "ko-KR": "설명 이미지",
  "vi-VN": "hình minh họa",
  "ms-MY": "ilustrasi",
  "th-TH": "ภาพประกอบ",
  "id-ID": "ilustrasi",
  "tl-PH": "ilustrasyon",
  "fr-FR": "illustration",
  "de-DE": "Illustration",
  "es-ES": "ilustración",
  "pt-PT": "ilustração",
  "it-IT": "illustrazione",
  "ru-RU": "иллюстрация",
  "ar-SA": "صورة توضيحية",
  "hi-IN": "चित्रण",
};

// Further reading section headers
export const FURTHER_READING_HEADERS: Record<string, string> = {
  "zh-TW": "延伸閱讀",
  "zh-CN": "延伸阅读",
  "en-US": "Further Reading",
  "ja-JP": "関連記事",
  "ko-KR": "더 읽어보기",
  "vi-VN": "Đọc thêm",
  "ms-MY": "Bacaan Lanjut",
  "th-TH": "อ่านเพิ่มเติม",
  "id-ID": "Bacaan Lebih Lanjut",
  "tl-PH": "Karagdagang Pagbabasa",
  "fr-FR": "Pour aller plus loin",
  "de-DE": "Weiterführende Lektüre",
  "es-ES": "Lectura adicional",
  "pt-PT": "Leitura adicional",
  "it-IT": "Approfondimenti",
  "ru-RU": "Дополнительное чтение",
  "ar-SA": "قراءة إضافية",
  "hi-IN": "आगे पढ़ें",
};

// Introduction section headers
export const INTRODUCTION_HEADERS: Record<string, string> = {
  "zh-TW": "前言",
  "zh-CN": "前言",
  "en-US": "Introduction",
  "ja-JP": "はじめに",
  "ko-KR": "서론",
  "vi-VN": "Giới thiệu",
  "ms-MY": "Pengenalan",
  "th-TH": "บทนำ",
  "id-ID": "Pendahuluan",
  "tl-PH": "Panimula",
  "fr-FR": "Introduction",
  "de-DE": "Einleitung",
  "es-ES": "Introducción",
  "pt-PT": "Introdução",
  "it-IT": "Introduzione",
  "ru-RU": "Введение",
  "ar-SA": "مقدمة",
  "hi-IN": "परिचय",
};

// Conclusion section headers
export const CONCLUSION_HEADERS: Record<string, string> = {
  "zh-TW": "結論",
  "zh-CN": "结论",
  "en-US": "Conclusion",
  "ja-JP": "まとめ",
  "ko-KR": "결론",
  "vi-VN": "Kết luận",
  "ms-MY": "Kesimpulan",
  "th-TH": "สรุป",
  "id-ID": "Kesimpulan",
  "tl-PH": "Konklusyon",
  "fr-FR": "Conclusion",
  "de-DE": "Fazit",
  "es-ES": "Conclusión",
  "pt-PT": "Conclusão",
  "it-IT": "Conclusione",
  "ru-RU": "Заключение",
  "ar-SA": "خاتمة",
  "hi-IN": "निष्कर्ष",
};

/**
 * Helper function to get translation with fallback to English
 */
export function getTranslation(
  translations: Record<string, string>,
  locale: string,
): string {
  return translations[locale] || translations["en-US"] || "";
}

/**
 * Helper function to get special block label
 */
export function getSpecialBlockLabel(
  type: keyof typeof SPECIAL_BLOCK_LABELS,
  locale: string,
): string {
  const labels = SPECIAL_BLOCK_LABELS[type];
  return labels[locale as keyof typeof labels] || labels["en-US"];
}
