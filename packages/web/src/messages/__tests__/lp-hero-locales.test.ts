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
const painKeys = [
  "eyebrow",
  "headline",
  "subheadline",
  "items.speed.title",
  "items.speed.body",
  "items.speed.value",
  "items.reach.title",
  "items.reach.body",
  "items.reach.value",
  "items.discovery.title",
  "items.discovery.body",
  "items.discovery.value",
];
const howKeys = [
  "eyebrow",
  "headline",
  "subheadline",
  "steps.discover.title",
  "steps.discover.description",
  "steps.generate.title",
  "steps.generate.description",
  "steps.cards.title",
  "steps.cards.description",
  "steps.publish.title",
  "steps.publish.description",
];

function getNestedMessage(
  messages: Record<string, unknown>,
  keyPath: string,
): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      messages,
    );
}

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

describe("lp pain locale coverage", () => {
  it.each(Object.entries(localeMessages))(
    "has lp.pain copy in %s",
    (_locale, messages) => {
      for (const key of painKeys) {
        const value = getNestedMessage(messages.lp.pain, key);

        expect(value).toEqual(expect.any(String));
        expect(value).not.toBe("");
      }
    },
  );
});

describe("lp how locale coverage", () => {
  it.each(Object.entries(localeMessages))(
    "has lp.how copy in %s",
    (_locale, messages) => {
      for (const key of howKeys) {
        const value = getNestedMessage(messages.lp.how, key);

        expect(value).toEqual(expect.any(String));
        expect(value).not.toBe("");
      }
    },
  );
});
