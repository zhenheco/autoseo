"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string, json: object) => void;
  editable?: boolean;
}

export function TiptapEditor({
  content,
  onChange,
  editable = true,
}: TiptapEditorProps) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("editor");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4",
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: "rounded-lg max-w-[70%] h-auto",
        },
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      onChange(html, json);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none dark:prose-invert focus:outline-none px-6 py-8 " +
          "prose-p:leading-[1.8] prose-p:my-5 " +
          "prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-2xl prose-h2:font-bold " +
          "prose-h3:mt-7 prose-h3:mb-3 prose-h3:text-xl prose-h3:font-semibold " +
          "prose-li:my-2 prose-li:leading-[1.7] " +
          "prose-ul:my-6 prose-ol:my-6 " +
          "prose-img:my-8 prose-img:rounded-lg",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt(t("enterLinkUrl"), previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, t]);

  // HTML 轉 Markdown 函式
  const htmlToMarkdown = useCallback((html: string): string => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      const children = Array.from(element.childNodes).map(processNode).join("");

      switch (tagName) {
        case "h1":
          return `# ${children}\n\n`;
        case "h2":
          return `## ${children}\n\n`;
        case "h3":
          return `### ${children}\n\n`;
        case "p":
          return `${children}\n\n`;
        case "strong":
        case "b":
          return `**${children}**`;
        case "em":
        case "i":
          return `*${children}*`;
        case "a": {
          const href = element.getAttribute("href") || "";
          return `[${children}](${href})`;
        }
        case "img": {
          const src = element.getAttribute("src") || "";
          const alt = element.getAttribute("alt") || "";
          return `![${alt}](${src})`;
        }
        case "ul":
          return `${children}\n`;
        case "ol":
          return `${children}\n`;
        case "li": {
          const parent = element.parentElement;
          if (parent?.tagName.toLowerCase() === "ol") {
            const index = Array.from(parent.children).indexOf(element) + 1;
            return `${index}. ${children}\n`;
          }
          return `- ${children}\n`;
        }
        case "br":
          return "\n";
        case "code":
          return `\`${children}\``;
        case "pre":
          return `\`\`\`\n${children}\n\`\`\`\n\n`;
        case "blockquote":
          return (
            children
              .split("\n")
              .map((line) => `> ${line}`)
              .join("\n") + "\n\n"
          );
        default:
          return children;
      }
    };

    return processNode(tempDiv).trim();
  }, []);

  const copyAsHtml = useCallback(async () => {
    if (!editor) return;

    const html = editor.getHTML();
    const text = editor.getText();

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      setCopied(true);
      toast.success(t("copiedHtmlToClipboard"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      toast.success(t("copiedHtmlToClipboard"));
      setTimeout(() => setCopied(false), 2000);
    }
  }, [editor, t]);

  const copyAsMarkdown = useCallback(async () => {
    if (!editor) return;

    const html = editor.getHTML();
    const markdown = htmlToMarkdown(html);

    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast.success(t("copiedMarkdownToClipboard"));
    setTimeout(() => setCopied(false), 2000);
  }, [editor, htmlToMarkdown, t]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col border rounded-lg h-full overflow-hidden">
      <div className="border-b p-2 flex flex-wrap gap-1 items-center bg-muted/50 shrink-0">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          disabled={!editable}
          aria-label={t("bold")}
        >
          <Bold className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editable}
          aria-label={t("italic")}
        >
          <Italic className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6" />

        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 1 })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          disabled={!editable}
          aria-label={t("heading1")}
        >
          <Heading1 className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          disabled={!editable}
          aria-label={t("heading2")}
        >
          <Heading2 className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6" />

        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          disabled={!editable}
          aria-label={t("bulletList")}
        >
          <List className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          disabled={!editable}
          aria-label={t("orderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6" />

        <Button
          size="sm"
          variant="ghost"
          onClick={setLink}
          disabled={!editable}
          className={editor.isActive("link") ? "bg-muted" : ""}
          aria-label={t("insertLink")}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editable || !editor.can().undo()}
          aria-label={t("undo")}
        >
          <Undo className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editable || !editor.can().redo()}
          aria-label={t("redo")}
        >
          <Redo className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{copied ? t("copied") : t("oneClickCopy")}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={copyAsHtml}>
              {t("copyHtml")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyAsMarkdown}>
              {t("copyMarkdown")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
