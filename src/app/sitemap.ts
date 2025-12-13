import { MetadataRoute } from "next";

/**
 * 生成 sitemap.xml 配置
 * 幫助搜尋引擎發現網站頁面
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://1wayseo.com";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
