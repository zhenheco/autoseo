import { BaseAgent } from "./base-agent";
import type { QAInput, QAOutput } from "@/types/agents";

export class QAAgent extends BaseAgent<QAInput, QAOutput> {
  get agentName(): string {
    return "QAAgent";
  }

  protected async process(input: QAInput): Promise<QAOutput> {
    const { title, outline, brandVoice, count = 5 } = input;

    // Language mapping
    const languageNames: Record<string, string> = {
      "zh-TW": "Traditional Chinese (繁體中文)",
      "zh-CN": "Simplified Chinese (简体中文)",
      en: "English",
      ja: "Japanese (日本語)",
      ko: "Korean (한국어)",
      es: "Spanish (Español)",
      fr: "French (Français)",
      de: "German (Deutsch)",
      pt: "Portuguese (Português)",
      it: "Italian (Italiano)",
      ru: "Russian (Русский)",
      ar: "Arabic (العربية)",
      th: "Thai (ไทย)",
      vi: "Vietnamese (Tiếng Việt)",
      id: "Indonesian (Bahasa Indonesia)",
    };

    const targetLang = (input as any).targetLanguage || "zh-TW";
    const languageName = languageNames[targetLang] || languageNames["zh-TW"];

    const mainTopics = outline.mainSections.map((s) => s.heading).join(", ");

    const prompt = `Generate frequently asked questions (FAQ) for the article "${title}".

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

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: input.maxTokens || 1500,
      format: "json",
    });

    let faqs: Array<{ question: string; answer: string }> = [];

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
          faqs = this.parseFallbackFAQs(response.content);
        }
      } else {
        faqs = this.parseFallbackFAQs(response.content);
      }
    }

    if (!Array.isArray(faqs) || faqs.length === 0) {
      faqs = this.getFallbackFAQs(title);
    }

    const markdown = this.formatFAQsAsMarkdown(faqs);
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
  ): string {
    const lines = ["## 常見問題", ""];

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
  ): Array<{ question: string; answer: string }> {
    return [
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
    ];
  }
}
