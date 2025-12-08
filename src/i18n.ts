import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  // 目前固定使用繁體中文，未來可根據 cookie 或 header 動態選擇
  const locale = "zh-TW";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
