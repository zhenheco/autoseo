import { describe, expect, it } from "vitest";

import deDE from "@shared/i18n/messages/de-DE.json";
import enUS from "@shared/i18n/messages/en-US.json";
import esES from "@shared/i18n/messages/es-ES.json";
import frFR from "@shared/i18n/messages/fr-FR.json";
import jaJP from "@shared/i18n/messages/ja-JP.json";
import koKR from "@shared/i18n/messages/ko-KR.json";
import zhTW from "@shared/i18n/messages/zh-TW.json";

const localeMessages = {
  "zh-TW": zhTW,
  "en-US": enUS,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "de-DE": deDE,
  "es-ES": esES,
  "fr-FR": frFR,
} as const;

const heroKeys = ["headline", "subheadline", "primaryCta", "secondaryCta"];

describe("lp hero locale coverage", () => {
  it.each(Object.entries(localeMessages))(
    "has lp.hero copy in %s",
    (_locale, messages) => {
      for (const key of heroKeys) {
        expect(
          messages.lp?.hero?.[key as keyof typeof messages.lp.hero],
        ).toEqual(expect.any(String));
        expect(messages.lp.hero[key as keyof typeof messages.lp.hero]).not.toBe(
          "",
        );
      }
    },
  );
});
