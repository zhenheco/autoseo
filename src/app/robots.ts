import { MetadataRoute } from "next";

/**
 * 生成 robots.txt 配置
 * 告訴搜尋引擎哪些頁面可以爬取
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/"],
    },
    sitemap: "https://1wayseo.com/sitemap.xml",
  };
}
