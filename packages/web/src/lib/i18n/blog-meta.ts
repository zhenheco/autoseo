/**
 * Blog 首頁/列表頁多語系 Meta 資料
 *
 * 18 種語系的 SEO Title/Description/Keywords
 */

import type { SupportedLocale } from "@/types/translations";

/**
 * Blog Meta 資料結構
 */
export interface BlogMeta {
  /** SEO 標題（max 60 chars） */
  title: string;
  /** SEO 描述（max 160 chars） */
  description: string;
  /** SEO 關鍵字 */
  keywords: string[];
  /** 頁面標題（用於 H1） */
  pageTitle: string;
  /** 頁面副標題 */
  pageSubtitle: string;
  /** 精選文章標籤 */
  featuredLabel: string;
  /** 最新文章標籤 */
  latestLabel: string;
  /** 閱讀更多按鈕文字 */
  readMore: string;
  /** 分鐘閱讀 */
  minRead: string;
  /** 沒有文章訊息 */
  noArticles: string;
}

/**
 * 18 種語系的 Blog Meta 資料
 */
export const BLOG_META: Record<SupportedLocale, BlogMeta> = {
  "zh-TW": {
    title: "SEO 部落格 | 1Way SEO 行銷技巧與策略",
    description:
      "探索最新的 SEO 策略、內容行銷技巧與數位行銷洞察。學習如何提升網站排名與流量，掌握搜尋引擎優化的核心技術。",
    keywords: ["SEO", "搜尋引擎優化", "內容行銷", "數位行銷", "網站排名"],
    pageTitle: "SEO 部落格",
    pageSubtitle: "探索 SEO 策略、內容行銷與數位行銷洞察",
    featuredLabel: "精選文章",
    latestLabel: "最新文章",
    readMore: "閱讀更多",
    minRead: "分鐘閱讀",
    noArticles: "目前沒有文章",
  },
  "zh-CN": {
    title: "SEO 博客 | 1Way SEO 营销技巧与策略",
    description:
      "探索最新的 SEO 策略、内容营销技巧与数字营销洞察。学习如何提升网站排名与流量，掌握搜索引擎优化的核心技术。",
    keywords: ["SEO", "搜索引擎优化", "内容营销", "数字营销", "网站排名"],
    pageTitle: "SEO 博客",
    pageSubtitle: "探索 SEO 策略、内容营销与数字营销洞察",
    featuredLabel: "精选文章",
    latestLabel: "最新文章",
    readMore: "阅读更多",
    minRead: "分钟阅读",
    noArticles: "目前没有文章",
  },
  "en-US": {
    title: "SEO Blog | 1Way SEO Marketing Tips & Strategies",
    description:
      "Discover the latest SEO strategies, content marketing tips, and digital marketing insights. Learn how to boost your website rankings and drive organic traffic.",
    keywords: [
      "SEO",
      "search engine optimization",
      "content marketing",
      "digital marketing",
      "website ranking",
    ],
    pageTitle: "SEO Blog",
    pageSubtitle:
      "Explore SEO strategies, content marketing & digital insights",
    featuredLabel: "Featured",
    latestLabel: "Latest Articles",
    readMore: "Read More",
    minRead: "min read",
    noArticles: "No articles available",
  },
  "ja-JP": {
    title: "SEOブログ | 1Way SEO マーケティングのヒントと戦略",
    description:
      "最新のSEO戦略、コンテンツマーケティングのヒント、デジタルマーケティングの洞察を発見。ウェブサイトのランキングを向上させる方法を学びましょう。",
    keywords: [
      "SEO",
      "検索エンジン最適化",
      "コンテンツマーケティング",
      "デジタルマーケティング",
    ],
    pageTitle: "SEOブログ",
    pageSubtitle: "SEO戦略、コンテンツマーケティング、デジタルインサイトを探る",
    featuredLabel: "注目記事",
    latestLabel: "最新記事",
    readMore: "続きを読む",
    minRead: "分で読める",
    noArticles: "記事がありません",
  },
  "ko-KR": {
    title: "SEO 블로그 | 1Way SEO 마케팅 팁과 전략",
    description:
      "최신 SEO 전략, 콘텐츠 마케팅 팁, 디지털 마케팅 인사이트를 발견하세요. 웹사이트 순위를 높이고 유기적 트래픽을 늘리는 방법을 배우세요.",
    keywords: [
      "SEO",
      "검색엔진 최적화",
      "콘텐츠 마케팅",
      "디지털 마케팅",
      "웹사이트 순위",
    ],
    pageTitle: "SEO 블로그",
    pageSubtitle: "SEO 전략, 콘텐츠 마케팅, 디지털 인사이트 탐구",
    featuredLabel: "추천 기사",
    latestLabel: "최신 기사",
    readMore: "더 읽기",
    minRead: "분 소요",
    noArticles: "기사가 없습니다",
  },
  "vi-VN": {
    title: "Blog SEO | Mẹo & Chiến lược Marketing SEO 1Way",
    description:
      "Khám phá các chiến lược SEO mới nhất, mẹo content marketing và insights digital marketing. Học cách cải thiện thứ hạng website và tăng traffic tự nhiên.",
    keywords: [
      "SEO",
      "tối ưu hóa công cụ tìm kiếm",
      "content marketing",
      "digital marketing",
    ],
    pageTitle: "Blog SEO",
    pageSubtitle:
      "Khám phá chiến lược SEO, content marketing & digital insights",
    featuredLabel: "Nổi bật",
    latestLabel: "Bài viết mới nhất",
    readMore: "Đọc thêm",
    minRead: "phút đọc",
    noArticles: "Chưa có bài viết",
  },
  "ms-MY": {
    title: "Blog SEO | Tip & Strategi Pemasaran SEO 1Way",
    description:
      "Temui strategi SEO terkini, tip pemasaran kandungan dan pandangan pemasaran digital. Pelajari cara meningkatkan kedudukan laman web anda.",
    keywords: [
      "SEO",
      "pengoptimuman enjin carian",
      "pemasaran kandungan",
      "pemasaran digital",
    ],
    pageTitle: "Blog SEO",
    pageSubtitle:
      "Terokai strategi SEO, pemasaran kandungan & pandangan digital",
    featuredLabel: "Pilihan",
    latestLabel: "Artikel Terkini",
    readMore: "Baca Lagi",
    minRead: "minit bacaan",
    noArticles: "Tiada artikel",
  },
  "th-TH": {
    title: "บล็อก SEO | เคล็ดลับและกลยุทธ์การตลาด SEO 1Way",
    description:
      "ค้นพบกลยุทธ์ SEO ล่าสุด เคล็ดลับการตลาดเนื้อหา และข้อมูลเชิงลึกด้านการตลาดดิจิทัล เรียนรู้วิธีเพิ่มอันดับเว็บไซต์ของคุณ",
    keywords: [
      "SEO",
      "การเพิ่มประสิทธิภาพเครื่องมือค้นหา",
      "การตลาดเนื้อหา",
      "การตลาดดิจิทัล",
    ],
    pageTitle: "บล็อก SEO",
    pageSubtitle: "สำรวจกลยุทธ์ SEO การตลาดเนื้อหา และข้อมูลเชิงลึกดิจิทัล",
    featuredLabel: "แนะนำ",
    latestLabel: "บทความล่าสุด",
    readMore: "อ่านเพิ่มเติม",
    minRead: "นาทีในการอ่าน",
    noArticles: "ไม่มีบทความ",
  },
  "id-ID": {
    title: "Blog SEO | Tips & Strategi Pemasaran SEO 1Way",
    description:
      "Temukan strategi SEO terbaru, tips content marketing, dan wawasan digital marketing. Pelajari cara meningkatkan peringkat website Anda.",
    keywords: [
      "SEO",
      "optimasi mesin pencari",
      "content marketing",
      "digital marketing",
    ],
    pageTitle: "Blog SEO",
    pageSubtitle: "Jelajahi strategi SEO, content marketing & wawasan digital",
    featuredLabel: "Pilihan",
    latestLabel: "Artikel Terbaru",
    readMore: "Baca Selengkapnya",
    minRead: "menit baca",
    noArticles: "Belum ada artikel",
  },
  "tl-PH": {
    title: "SEO Blog | 1Way SEO Marketing Tips at Strategies",
    description:
      "Tuklasin ang pinakabagong SEO strategies, content marketing tips, at digital marketing insights. Alamin kung paano pataasan ang ranking ng iyong website.",
    keywords: [
      "SEO",
      "search engine optimization",
      "content marketing",
      "digital marketing",
    ],
    pageTitle: "SEO Blog",
    pageSubtitle:
      "Tuklasin ang SEO strategies, content marketing at digital insights",
    featuredLabel: "Featured",
    latestLabel: "Pinakabagong Artikulo",
    readMore: "Magbasa Pa",
    minRead: "minutong basahin",
    noArticles: "Walang artikulo",
  },
  "fr-FR": {
    title: "Blog SEO | Conseils et Stratégies Marketing SEO 1Way",
    description:
      "Découvrez les dernières stratégies SEO, conseils de marketing de contenu et insights du marketing digital. Apprenez à améliorer le classement de votre site.",
    keywords: [
      "SEO",
      "optimisation des moteurs de recherche",
      "marketing de contenu",
      "marketing digital",
    ],
    pageTitle: "Blog SEO",
    pageSubtitle:
      "Explorez les stratégies SEO, le marketing de contenu et les insights digitaux",
    featuredLabel: "À la une",
    latestLabel: "Articles récents",
    readMore: "Lire la suite",
    minRead: "min de lecture",
    noArticles: "Aucun article disponible",
  },
  "de-DE": {
    title: "SEO Blog | 1Way SEO Marketing Tipps & Strategien",
    description:
      "Entdecken Sie die neuesten SEO-Strategien, Content-Marketing-Tipps und Digital-Marketing-Einblicke. Erfahren Sie, wie Sie Ihr Website-Ranking verbessern.",
    keywords: [
      "SEO",
      "Suchmaschinenoptimierung",
      "Content Marketing",
      "Digital Marketing",
    ],
    pageTitle: "SEO Blog",
    pageSubtitle:
      "Entdecken Sie SEO-Strategien, Content Marketing & digitale Einblicke",
    featuredLabel: "Empfohlen",
    latestLabel: "Neueste Artikel",
    readMore: "Weiterlesen",
    minRead: "Min. Lesezeit",
    noArticles: "Keine Artikel verfügbar",
  },
  "es-ES": {
    title: "Blog SEO | Consejos y Estrategias de Marketing SEO 1Way",
    description:
      "Descubre las últimas estrategias SEO, consejos de marketing de contenidos e insights de marketing digital. Aprende a mejorar el posicionamiento de tu web.",
    keywords: [
      "SEO",
      "optimización de motores de búsqueda",
      "marketing de contenidos",
      "marketing digital",
    ],
    pageTitle: "Blog SEO",
    pageSubtitle:
      "Explora estrategias SEO, marketing de contenidos e insights digitales",
    featuredLabel: "Destacado",
    latestLabel: "Artículos recientes",
    readMore: "Leer más",
    minRead: "min de lectura",
    noArticles: "No hay artículos disponibles",
  },
  "pt-PT": {
    title: "Blog SEO | Dicas e Estratégias de Marketing SEO 1Way",
    description:
      "Descubra as últimas estratégias SEO, dicas de marketing de conteúdo e insights de marketing digital. Aprenda a melhorar o ranking do seu website.",
    keywords: [
      "SEO",
      "otimização de motores de busca",
      "marketing de conteúdo",
      "marketing digital",
    ],
    pageTitle: "Blog SEO",
    pageSubtitle:
      "Explore estratégias SEO, marketing de conteúdo e insights digitais",
    featuredLabel: "Destaque",
    latestLabel: "Artigos recentes",
    readMore: "Ler mais",
    minRead: "min de leitura",
    noArticles: "Nenhum artigo disponível",
  },
  "it-IT": {
    title: "Blog SEO | Consigli e Strategie di Marketing SEO 1Way",
    description:
      "Scopri le ultime strategie SEO, consigli di content marketing e insights di digital marketing. Impara come migliorare il posizionamento del tuo sito.",
    keywords: [
      "SEO",
      "ottimizzazione motori di ricerca",
      "content marketing",
      "digital marketing",
    ],
    pageTitle: "Blog SEO",
    pageSubtitle:
      "Esplora strategie SEO, content marketing e insights digitali",
    featuredLabel: "In evidenza",
    latestLabel: "Articoli recenti",
    readMore: "Leggi di più",
    minRead: "min di lettura",
    noArticles: "Nessun articolo disponibile",
  },
  "ru-RU": {
    title: "SEO Блог | Советы и стратегии SEO маркетинга 1Way",
    description:
      "Откройте для себя последние SEO стратегии, советы по контент-маркетингу и инсайты цифрового маркетинга. Узнайте, как улучшить позиции вашего сайта.",
    keywords: [
      "SEO",
      "поисковая оптимизация",
      "контент-маркетинг",
      "цифровой маркетинг",
    ],
    pageTitle: "SEO Блог",
    pageSubtitle:
      "Исследуйте SEO стратегии, контент-маркетинг и цифровые инсайты",
    featuredLabel: "Рекомендуемое",
    latestLabel: "Последние статьи",
    readMore: "Читать далее",
    minRead: "мин чтения",
    noArticles: "Статей пока нет",
  },
  "ar-SA": {
    title: "مدونة SEO | نصائح واستراتيجيات التسويق SEO 1Way",
    description:
      "اكتشف أحدث استراتيجيات SEO ونصائح تسويق المحتوى ورؤى التسويق الرقمي. تعلم كيفية تحسين ترتيب موقعك الإلكتروني.",
    keywords: ["SEO", "تحسين محركات البحث", "تسويق المحتوى", "التسويق الرقمي"],
    pageTitle: "مدونة SEO",
    pageSubtitle: "استكشف استراتيجيات SEO وتسويق المحتوى والرؤى الرقمية",
    featuredLabel: "مميز",
    latestLabel: "أحدث المقالات",
    readMore: "اقرأ المزيد",
    minRead: "دقيقة قراءة",
    noArticles: "لا توجد مقالات",
  },
  "hi-IN": {
    title: "SEO ब्लॉग | 1Way SEO मार्केटिंग टिप्स और रणनीतियाँ",
    description:
      "नवीनतम SEO रणनीतियाँ, कंटेंट मार्केटिंग टिप्स और डिजिटल मार्केटिंग इनसाइट्स खोजें। अपनी वेबसाइट की रैंकिंग बढ़ाना सीखें।",
    keywords: [
      "SEO",
      "सर्च इंजन ऑप्टिमाइजेशन",
      "कंटेंट मार्केटिंग",
      "डिजिटल मार्केटिंग",
    ],
    pageTitle: "SEO ब्लॉग",
    pageSubtitle: "SEO रणनीतियाँ, कंटेंट मार्केटिंग और डिजिटल इनसाइट्स खोजें",
    featuredLabel: "फीचर्ड",
    latestLabel: "नवीनतम लेख",
    readMore: "और पढ़ें",
    minRead: "मिनट पढ़ें",
    noArticles: "कोई लेख उपलब्ध नहीं",
  },
};

/**
 * 取得特定語系的 Blog Meta 資料
 */
export function getBlogMeta(locale: SupportedLocale): BlogMeta {
  return BLOG_META[locale] || BLOG_META["en-US"];
}

/**
 * 生成 Blog 首頁/列表頁的 hreflang alternates
 */
export function generateBlogHreflangAlternates(): Record<string, string> {
  const baseUrl = "https://1wayseo.com";
  const alternates: Record<string, string> = {};

  // zh-TW 使用 /blog（原始版本）
  alternates["zh-TW"] = `${baseUrl}/blog`;
  alternates["x-default"] = `${baseUrl}/blog`;

  // 其他語系使用 /blog/lang/{locale}
  const locales: SupportedLocale[] = [
    "zh-CN",
    "en-US",
    "ja-JP",
    "ko-KR",
    "vi-VN",
    "ms-MY",
    "th-TH",
    "id-ID",
    "tl-PH",
    "fr-FR",
    "de-DE",
    "es-ES",
    "pt-PT",
    "it-IT",
    "ru-RU",
    "ar-SA",
    "hi-IN",
  ];

  for (const locale of locales) {
    alternates[locale] = `${baseUrl}/blog/lang/${locale}`;
  }

  return alternates;
}
