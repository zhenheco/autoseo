import { BaseAgent } from './base-agent';
import type { QAInput, QAOutput } from '@/types/agents';

export class QAAgent extends BaseAgent<QAInput, QAOutput> {
  get agentName(): string {
    return 'QAAgent';
  }

  protected async process(input: QAInput): Promise<QAOutput> {
    const { title, outline, brandVoice, count = 3 } = input;

    const mainTopics = outline.mainSections.map(s => s.heading).join('、');

    const prompt = `為文章「${title}」生成常見問題（FAQ）。

## 文章主題
- 標題：${title}
- 主要段落：${mainTopics}

## 品牌語調
- 語調：${brandVoice.tone_of_voice}
- 目標受眾：${brandVoice.target_audience}

## 要求
1. 生成 ${count} 個常見問題
2. 每個問題都應該是讀者可能會問的
3. 答案要詳細且實用（每個答案至少 50 字）
4. 問題要涵蓋不同面向（基礎、進階、應用等）
5. 語調符合品牌風格

## 輸出格式（JSON）
{
  "faqs": [
    {
      "question": "問題1？",
      "answer": "詳細答案"
    }
  ]
}`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: input.maxTokens || 1500,
      format: 'json',
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

    return {
      faqs,
      markdown,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private formatFAQsAsMarkdown(faqs: Array<{ question: string; answer: string }>): string {
    const lines = ['## 常見問題', ''];

    faqs.forEach((faq, index) => {
      lines.push(`### ${index + 1}. ${faq.question}`, '');
      lines.push(faq.answer, '');
    });

    return lines.join('\n');
  }

  private parseFallbackFAQs(content: string): Array<{ question: string; answer: string }> {
    const faqs: Array<{ question: string; answer: string }> = [];
    const lines = content.split('\n');

    let currentQuestion = '';
    let currentAnswer = '';

    for (const line of lines) {
      if (line.match(/[?？]/)) {
        if (currentQuestion && currentAnswer) {
          faqs.push({ question: currentQuestion, answer: currentAnswer.trim() });
        }
        currentQuestion = line.trim();
        currentAnswer = '';
      } else if (currentQuestion && line.trim()) {
        currentAnswer += line + ' ';
      }
    }

    if (currentQuestion && currentAnswer) {
      faqs.push({ question: currentQuestion, answer: currentAnswer.trim() });
    }

    return faqs;
  }

  private getFallbackFAQs(title: string): Array<{ question: string; answer: string }> {
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
