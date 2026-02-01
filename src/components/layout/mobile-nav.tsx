"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTranslations } from "next-intl";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");

  const navLinks = [
    { href: "/blog", label: t("blog") },
    { href: "/pricing", label: t("pricing") },
    { href: "/terms", label: t("termsOfService") },
    { href: "/privacy", label: t("privacyPolicy") },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10"
          aria-label={t("openMenu")}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px] sm:w-[320px]">
        <SheetHeader>
          <SheetTitle className="text-left flex items-center gap-2">
            <Image
              src="/1waySEO_icon.svg"
              alt="1waySEO"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="text-xl font-bold">1WaySEO</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-8 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-lg font-medium text-foreground/80 hover:text-foreground transition-colors py-2"
            >
              {link.label}
            </Link>
          ))}

          <div className="my-4 border-t" />

          <div className="flex flex-col gap-3">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full justify-center">
                {t("login")}
              </Button>
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)}>
              <Button className="w-full justify-center">{t("signup")}</Button>
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("themeToggle")}</span>
            <ThemeToggle />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
