"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";

export function FooterSection() {
  const t = useTranslations("home.v5.footer");
  const tHome = useTranslations("home");
  const tFeatures = useTranslations("home.v5.features");
  const tNav = useTranslations("nav");

  const footerLinks = [
    {
      titleKey: "product",
      links: [
        { name: tFeatures("aiBulkEngine"), href: "#features" },
        { name: t("pricing"), href: "#pricing" },
        { name: tNav("blog"), href: "/blog" },
      ],
    },
    {
      titleKey: "legal",
      links: [
        { name: tHome("privacy"), href: "/privacy" },
        { name: tHome("terms"), href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="pt-24 pb-12 border-t border-border relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full -z-10" />

      <div className="container-section">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-block mb-6 transition-transform hover:scale-105"
            >
              <Image
                src="/1waySEO_logo-LR.svg"
                alt="1waySEO"
                width={140}
                height={36}
                className="h-8 w-auto dark:brightness-0 dark:invert"
              />
            </Link>
            <p className="text-text-sub text-sm max-w-xs mb-8 leading-relaxed">
              {t("description")}
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.titleKey}>
              <h4 className="text-foreground font-bold text-sm mb-6 uppercase tracking-widest">
                {t(group.titleKey)}
              </h4>
              <ul className="space-y-4">
                {group.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-text-dim hover:text-foreground text-sm transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-text-dim text-xs flex items-center gap-1.5">
            {tHome("allRightsReserved")}
            <span className="hidden md:inline mx-2 text-foreground/10">|</span>
            <span className="hidden md:inline flex items-center gap-1">
              <Heart className="w-3 h-3 text-red-500 fill-red-500 inline" />{" "}
              {tHome("madeInTaiwan")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
