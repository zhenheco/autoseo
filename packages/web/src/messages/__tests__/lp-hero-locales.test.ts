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
const featureKeys = [
  "eyebrow",
  "headline",
  "subheadline",
  "items.article.title",
  "items.article.body",
  "items.socialCards.title",
  "items.socialCards.body",
  "items.publishing.title",
  "items.publishing.body",
  "items.locales.title",
  "items.locales.body",
  "items.brandMemory.title",
  "items.brandMemory.body",
  "items.selfOptimization.title",
  "items.selfOptimization.body",
];
const socialKeys = [
  "eyebrow",
  "headline",
  "subheadline",
  "banner",
  "story.title",
  "story.body",
  "story.attribution",
];
const pricingKeys = [
  "eyebrow",
  "headline",
  "subheadline",
  "billingToggleLabel",
  "billing.monthly",
  "billing.yearly",
  "period.monthly",
  "period.yearly",
  "cta",
  "popular",
  "approxTwd",
  "plans.solo.name",
  "plans.solo.description",
  "plans.solo.features",
  "plans.pro.name",
  "plans.pro.description",
  "plans.pro.features",
];
const faqKeys = ["eyebrow", "headline", "subheadline", "items"];
const finalCtaKeys = [
  "eyebrow",
  "headline",
  "subheadline",
  "primaryCta",
  "emailLabel",
  "emailPlaceholder",
  "emailSubmit",
  "emailHelp",
  "invalidEmail",
  "success",
  "duplicate",
  "error",
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

describe("lp features locale coverage", () => {
  it.each(Object.entries(localeMessages))(
    "has lp.features copy in %s",
    (_locale, messages) => {
      for (const key of featureKeys) {
        const value = getNestedMessage(messages.lp.features, key);

        expect(value).toEqual(expect.any(String));
        expect(value).not.toBe("");
      }
    },
  );
});

describe("lp social locale coverage", () => {
  it.each(Object.entries(localeMessages))(
    "has lp.social copy in %s",
    (_locale, messages) => {
      for (const key of socialKeys) {
        const value = getNestedMessage(messages.lp.social, key);

        expect(value).toEqual(expect.any(String));
        expect(value).not.toBe("");
      }
    },
  );
});

describe("lp pricing locale coverage", () => {
  it.each(Object.entries(localeMessages))(
    "has lp.pricing copy in %s",
    (_locale, messages) => {
      for (const key of pricingKeys) {
        const value = getNestedMessage(messages.lp.pricing, key);

        if (key.endsWith(".features")) {
          expect(value).toEqual(expect.arrayContaining([expect.any(String)]));
        } else {
          expect(value).toEqual(expect.any(String));
          expect(value).not.toBe("");
        }
      }
    },
  );
});

describe("lp faq locale coverage", () => {
  it.each(Object.entries(localeMessages))(
    "has lp.faq copy in %s",
    (_locale, messages) => {
      for (const key of faqKeys) {
        const value = getNestedMessage(messages.lp.faq, key);

        if (key === "items") {
          expect(value).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                question: expect.any(String),
                answer: expect.any(String),
              }),
            ]),
          );
          expect(value).toHaveLength(10);
        } else {
          expect(value).toEqual(expect.any(String));
          expect(value).not.toBe("");
        }
      }
    },
  );
});

describe("lp final CTA locale coverage", () => {
  it.each(Object.entries(localeMessages))(
    "has lp.finalCta copy in %s",
    (_locale, messages) => {
      for (const key of finalCtaKeys) {
        const value = getNestedMessage(messages.lp.finalCta, key);

        expect(value).toEqual(expect.any(String));
        expect(value).not.toBe("");
      }
    },
  );
});
