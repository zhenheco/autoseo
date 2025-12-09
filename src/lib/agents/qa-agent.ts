import { BaseAgent } from "./base-agent";
import type { QAInput, QAOutput, ContentContext } from "@/types/agents";
import { LOCALE_FULL_NAMES } from "@/lib/i18n/locales";
import { FAQ_HEADERS, getTranslation } from "@/lib/i18n/article-translations";

export class QAAgent extends BaseAgent<QAInput, QAOutput> {
  get agentName(): string {
    return "QAAgent";
  }

  private buildTopicAlignmentSection(contentContext?: ContentContext): string {
    if (!contentContext) {
      return "";
    }

    return `## ⚠️ CRITICAL: Topic Alignment Requirement

**Article Title**: ${contentContext.selectedTitle}
**PRIMARY KEYWORD**: ${contentContext.primaryKeyword}
**Search Intent**: ${contentContext.searchIntent}
**Target Audience**: ${contentContext.targetAudience}

**All FAQ questions and answers MUST be DIRECTLY relevant to "${contentContext.primaryKeyword}".**
**Do NOT include any questions that are unrelated to the main topic.**
**Every question should address a real concern about "${contentContext.primaryKeyword}".**

---`;
  }

  protected async process(input: QAInput): Promise<QAOutput> {
    const { title, outline, brandVoice, count = 5, contentContext } = input;

    console.log("[QAAgent] 開始生成 FAQ...");

    const targetLang =
      (input as QAInput & { targetLanguage?: string }).targetLanguage ||
      "zh-TW";
    const languageName =
      LOCALE_FULL_NAMES[targetLang] || "Traditional Chinese (繁體中文)";

    const mainTopics = outline.mainSections.map((s) => s.heading).join(", ");
    const topicAlignmentSection =
      this.buildTopicAlignmentSection(contentContext);

    const prompt = `${topicAlignmentSection}

Generate frequently asked questions (FAQ) for the article "${title}".

**Target Language: ${languageName}** (ALL content MUST be written in this language)

## Article Topics
- Title: ${title}
- Main Sections: ${mainTopics}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice}
- Target Audience: ${brandVoice.target_audience}
- Sentence Style: ${brandVoice.sentence_style || "Clear and concise"}
- Interactivity: ${brandVoice.interactivity || "Moderate"}

## Requirements
1. Generate ${count} frequently asked questions
2. Each question should be something readers would actually ask
3. Answers should be detailed and practical (at least 50 words each)
4. Questions should cover different aspects (basic, advanced, application, etc.)
5. Tone should match brand style

**CRITICAL: Write ALL questions and answers in ${languageName}**

## Output Format (JSON)
{
  "faqs": [
    {
      "question": "Question 1 in ${languageName}?",
      "answer": "Detailed answer in ${languageName}"
    }
  ]
}`;

    let faqs: Array<{ question: string; answer: string }> = [];

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.7,
        maxTokens: input.maxTokens || 1500,
        format: "json",
      });

      try {
        const parsed = JSON.parse(response.content);
        faqs = parsed.faqs || parsed;
      } catch {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            faqs = parsed.faqs || parsed;
          } catch {
            console.warn("[QAAgent] JSON 解析失敗，嘗試文字解析...");
            faqs = this.parseFallbackFAQs(response.content);
          }
        } else {
          console.warn("[QAAgent] 無法找到 JSON，嘗試文字解析...");
          faqs = this.parseFallbackFAQs(response.content);
        }
      }

      if (!Array.isArray(faqs) || faqs.length === 0) {
        console.warn("[QAAgent] FAQ 解析結果為空，使用 fallback...");
        faqs = this.getFallbackFAQs(title, targetLang);
      }

      console.log(`[QAAgent] 成功生成 ${faqs.length} 個 FAQ`);
    } catch (error) {
      console.error("[QAAgent] FAQ 生成失敗:", error);
      faqs = this.getFallbackFAQs(title, targetLang);
      console.log(`[QAAgent] 使用 fallback FAQ: ${faqs.length} 個`);
    }

    const markdown = this.formatFAQsAsMarkdown(faqs, targetLang);
    const schemaJson = this.generateFAQSchema(faqs);

    return {
      faqs,
      markdown,
      schemaJson,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private generateFAQSchema(
    faqs: Array<{ question: string; answer: string }>,
  ): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    };
    return JSON.stringify(schema, null, 2);
  }

  private formatFAQsAsMarkdown(
    faqs: Array<{ question: string; answer: string }>,
    targetLanguage?: string,
  ): string {
    const faqHeader = getTranslation(FAQ_HEADERS, targetLanguage || "zh-TW");
    const lines = [`## ${faqHeader}`, ""];

    faqs.forEach((faq, index) => {
      lines.push(`### ${index + 1}. ${faq.question}`, "");
      lines.push(faq.answer, "");
    });

    return lines.join("\n");
  }

  private parseFallbackFAQs(
    content: string,
  ): Array<{ question: string; answer: string }> {
    const faqs: Array<{ question: string; answer: string }> = [];
    const lines = content.split("\n");

    let currentQuestion = "";
    let currentAnswer = "";

    for (const line of lines) {
      if (line.match(/[?？]/)) {
        if (currentQuestion && currentAnswer) {
          faqs.push({
            question: currentQuestion,
            answer: currentAnswer.trim(),
          });
        }
        currentQuestion = line.trim();
        currentAnswer = "";
      } else if (currentQuestion && line.trim()) {
        currentAnswer += line + " ";
      }
    }

    if (currentQuestion && currentAnswer) {
      faqs.push({ question: currentQuestion, answer: currentAnswer.trim() });
    }

    return faqs;
  }

  private getFallbackFAQs(
    title: string,
    targetLang: string = "zh-TW",
  ): Array<{ question: string; answer: string }> {
    // 根據語系返回對應的 fallback FAQ
    const fallbacksByLang: Record<
      string,
      Array<{ question: string; answer: string }>
    > = {
      "zh-TW": [
        {
          question: `什麼是${title}？`,
          answer: `${title}是一個重要的主題，涵蓋多個面向。本文將深入探討${title}的核心概念和實際應用。`,
        },
        {
          question: `${title}適合哪些人？`,
          answer: `${title}適合想要深入了解相關主題的讀者，無論是初學者還是有經驗的從業人員，都能從中獲益。`,
        },
        {
          question: `如何開始學習${title}？`,
          answer: `建議從基礎概念開始，循序漸進地學習。本文提供了完整的指南，幫助您系統性地掌握${title}。`,
        },
      ],
      "zh-CN": [
        {
          question: `什么是${title}？`,
          answer: `${title}是一个重要的主题，涵盖多个方面。本文将深入探讨${title}的核心概念和实际应用。`,
        },
        {
          question: `${title}适合哪些人？`,
          answer: `${title}适合想要深入了解相关主题的读者，无论是初学者还是有经验的从业人员，都能从中获益。`,
        },
        {
          question: `如何开始学习${title}？`,
          answer: `建议从基础概念开始，循序渐进地学习。本文提供了完整的指南，帮助您系统性地掌握${title}。`,
        },
      ],
      en: [
        {
          question: `What is ${title}?`,
          answer: `${title} is an important topic covering multiple aspects. This article explores the core concepts and practical applications of ${title}.`,
        },
        {
          question: `Who is ${title} suitable for?`,
          answer: `${title} is suitable for readers who want to understand the topic deeply, whether beginners or experienced professionals can benefit from it.`,
        },
        {
          question: `How to get started with ${title}?`,
          answer: `It's recommended to start with basic concepts and learn progressively. This article provides a complete guide to help you master ${title} systematically.`,
        },
      ],
    };

    return fallbacksByLang[targetLang] || fallbacksByLang["zh-TW"];
  }
}
