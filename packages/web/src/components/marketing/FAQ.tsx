"use client";

import { useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

type FaqItem = {
  question: string;
  answer: string;
};

export function FAQ() {
  const t = useTranslations("lp.faq");
  const items = t.raw("items") as FaqItem[];
  const [openItem, setOpenItem] = useState("");

  return (
    <section
      id="faq"
      className="border-b border-border bg-background py-20 md:py-28"
    >
      <div className="container-section">
        <div className="max-w-3xl">
          <p className="text-body-sm font-semibold uppercase text-primary">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-balance text-h2 font-bold tracking-normal text-foreground">
            {t("headline")}
          </h2>
          <p className="mt-4 text-pretty text-body leading-relaxed text-muted-foreground">
            {t("subheadline")}
          </p>
        </div>

        <Accordion.Root
          className="mt-10 divide-y divide-border rounded-md border border-border bg-card shadow-sm"
          collapsible
          onValueChange={setOpenItem}
          type="single"
          value={openItem}
        >
          {items.map((item, index) => (
            <Accordion.Item
              key={item.question}
              value={`item-${index}`}
              className="px-5"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-body font-semibold text-foreground">
                  <span>{item.question}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                  />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content
                className="overflow-hidden pb-5 text-body-sm leading-relaxed text-muted-foreground data-[state=closed]:hidden"
                forceMount
                hidden={openItem !== `item-${index}`}
              >
                {item.answer}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
