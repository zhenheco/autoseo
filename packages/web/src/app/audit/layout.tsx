import { NextIntlClientProvider } from "next-intl";
import messages from "@shared/i18n/messages/zh-TW.json";

export default function PublicAuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale="zh-TW"
      messages={messages}
      timeZone="Asia/Taipei"
    >
      {children}
    </NextIntlClientProvider>
  );
}
