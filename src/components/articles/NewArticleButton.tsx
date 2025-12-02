"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PenSquare } from "lucide-react";

export function NewArticleButton() {
  return (
    <Button asChild>
      <Link href="/dashboard/articles">
        <PenSquare className="mr-2 h-4 w-4" />
        新增文章
      </Link>
    </Button>
  );
}
