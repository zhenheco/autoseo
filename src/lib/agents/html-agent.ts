import { BaseAgent } from './base-agent';
import type { HTMLInput, HTMLOutput } from '@/types/agents';
import { JSDOM } from 'jsdom';

export class HTMLAgent extends BaseAgent<HTMLInput, HTMLOutput> {
  get agentName(): string {
    return 'HTMLAgent';
  }

  protected async process(input: HTMLInput): Promise<HTMLOutput> {
    let html = input.html;

    html = this.insertInternalLinks(html, input.internalLinks);

    html = this.insertExternalReferences(html, input.externalReferences);

    html = this.insertFAQSchema(html);

    html = this.optimizeForWordPress(html);

    const linkCount = this.countLinks(html);

    return {
      html,
      linkCount,
      executionInfo: this.getExecutionInfo('html-processor'),
    };
  }

  private insertInternalLinks(
    html: string,
    internalLinks: HTMLInput['internalLinks']
  ): string {
    if (!internalLinks || internalLinks.length === 0) {
      return html;
    }

    const dom = new JSDOM(html);
    const document = dom.window.document;
    const body = document.body;

    const walker = document.createTreeWalker(
      body,
      dom.window.NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          const element = node as unknown as HTMLElement;
          const parent = element.parentElement;
          if (!parent) return dom.window.NodeFilter.FILTER_REJECT;

          if (['A', 'SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) {
            return dom.window.NodeFilter.FILTER_REJECT;
          }

          return dom.window.NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const textNodes: Node[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    const linkedKeywords = new Set<string>();

    for (const link of internalLinks) {
      if (linkedKeywords.size >= internalLinks.length) break;

      for (const keyword of link.keywords) {
        if (linkedKeywords.has(keyword)) continue;

        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');

        for (const textNode of textNodes) {
          const element = textNode as unknown as HTMLElement;
          const text = element.textContent || '';
          const match = text.match(regex);

          if (match) {
            const matchText = match[0];
            const beforeText = text.substring(0, match.index);
            const afterText = text.substring((match.index || 0) + matchText.length);

            const element2 = textNode as unknown as HTMLElement;
            const parent = element2.parentElement;
            if (!parent) continue;

            const anchor = document.createElement('a');
            anchor.href = link.url;
            anchor.textContent = matchText;
            anchor.setAttribute('rel', 'internal');

            const beforeNode = document.createTextNode(beforeText);
            const afterNode = document.createTextNode(afterText);

            parent.replaceChild(afterNode, textNode);
            parent.insertBefore(anchor, afterNode);
            parent.insertBefore(beforeNode, anchor);

            linkedKeywords.add(keyword);
            break;
          }
        }

        if (linkedKeywords.has(keyword)) break;
      }
    }

    return body.innerHTML;
  }

  private insertExternalReferences(
    html: string,
    externalRefs: HTMLInput['externalReferences']
  ): string {
    if (!externalRefs || externalRefs.length === 0) {
      return html;
    }

    const dom = new JSDOM(html);
    const document = dom.window.document;
    const body = document.body;

    for (const ref of externalRefs) {
      const sections = ref.relevantSection
        ? this.findSections(body, ref.relevantSection)
        : [body];

      if (sections.length === 0) continue;

      const section = sections[0];

      const keywords = this.extractKeywordsFromDescription(ref.description);

      const walker = document.createTreeWalker(
        section,
        dom.window.NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node: Node) => {
            const element = node as unknown as HTMLElement;
            const parent = element.parentElement;
            if (!parent) return dom.window.NodeFilter.FILTER_REJECT;

            if (['A', 'SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) {
              return dom.window.NodeFilter.FILTER_REJECT;
            }

            return dom.window.NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      const textNodes: Node[] = [];
      let currentNode = walker.nextNode();
      while (currentNode) {
        textNodes.push(currentNode);
        currentNode = walker.nextNode();
      }

      let linked = false;
      for (const keyword of keywords) {
        if (linked) break;

        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');

        for (const textNode of textNodes) {
          const element = textNode as unknown as HTMLElement;
          const text = element.textContent || '';
          const match = text.match(regex);

          if (match) {
            const matchText = match[0];
            const beforeText = text.substring(0, match.index);
            const afterText = text.substring((match.index || 0) + matchText.length);

            const element2 = textNode as unknown as HTMLElement;
            const parent = element2.parentElement;
            if (!parent) continue;

            const anchor = document.createElement('a');
            anchor.href = ref.url;
            anchor.textContent = matchText;
            anchor.setAttribute('target', '_blank');
            anchor.setAttribute('rel', 'noopener noreferrer external');

            const beforeNode = document.createTextNode(beforeText);
            const afterNode = document.createTextNode(afterText);

            parent.replaceChild(afterNode, textNode);
            parent.insertBefore(anchor, afterNode);
            parent.insertBefore(beforeNode, anchor);

            linked = true;
            break;
          }
        }
      }
    }

    return body.innerHTML;
  }

  private optimizeForWordPress(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const body = document.body;

    const images = body.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.getAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }

      if (!img.classList.contains('wp-image')) {
        img.classList.add('wp-image');
      }

      if (!img.style.maxWidth) {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
      }
    });

    const headings = body.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading) => {
      if (!heading.id) {
        const text = heading.textContent || '';
        const id = this.slugify(text);
        heading.id = id;
      }
    });

    const tables = body.querySelectorAll('table');
    tables.forEach((table) => {
      if (!table.classList.contains('wp-table')) {
        table.classList.add('wp-table');
      }

      const wrapper = document.createElement('div');
      wrapper.classList.add('table-responsive');
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    return body.innerHTML;
  }

  private findSections(
    element: Element | DocumentFragment,
    sectionName: string
  ): Element[] {
    const results: Element[] = [];
    const headings = (element as Element).querySelectorAll('h1, h2, h3, h4, h5, h6');

    headings.forEach((heading) => {
      const text = heading.textContent || '';
      if (text.toLowerCase().includes(sectionName.toLowerCase())) {
        const section = heading.nextElementSibling;
        if (section) {
          results.push(section);
        }
      }
    });

    return results;
  }

  private extractKeywordsFromDescription(description: string): string[] {
    const words = description.split(/\s+/);

    const keywords = words.filter((word) => {
      word = word.replace(/[^\w\s]/g, '');
      return word.length >= 4 && word.length <= 20;
    });

    return keywords.slice(0, 5);
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private insertFAQSchema(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const body = document.body;

    const faqHeadings = Array.from(body.querySelectorAll('h2, h3')).filter((h) =>
      (h.textContent || '').toLowerCase().includes('常見問題')
    );

    if (faqHeadings.length === 0) {
      return html;
    }

    const faqSection = faqHeadings[0];
    const faqItems: Array<{ question: string; answer: string }> = [];

    let currentElement = faqSection.nextElementSibling;
    while (currentElement && !['H1', 'H2'].includes(currentElement.tagName)) {
      if (currentElement.tagName === 'H3') {
        const questionText = (currentElement.textContent || '').replace(/^Q:\s*/i, '').trim();
        let answerText = '';

        let nextEl = currentElement.nextElementSibling;
        while (nextEl && !['H1', 'H2', 'H3'].includes(nextEl.tagName)) {
          const text = (nextEl.textContent || '').replace(/^A:\s*/i, '').trim();
          if (text) {
            answerText += text + ' ';
          }
          nextEl = nextEl.nextElementSibling;
        }

        if (questionText && answerText.trim()) {
          faqItems.push({
            question: questionText,
            answer: answerText.trim(),
          });
        }
      }
      currentElement = currentElement.nextElementSibling;
    }

    if (faqItems.length === 0) {
      return html;
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    };

    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('type', 'application/ld+json');
    scriptTag.textContent = JSON.stringify(schema, null, 2);

    body.appendChild(scriptTag);

    return body.innerHTML;
  }

  private countLinks(html: string): { internal: number; external: number } {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const body = document.body;

    const allLinks = body.querySelectorAll('a');
    let internal = 0;
    let external = 0;

    allLinks.forEach((link) => {
      const rel = link.getAttribute('rel') || '';
      if (rel.includes('internal')) {
        internal++;
      } else if (rel.includes('external')) {
        external++;
      }
    });

    return { internal, external };
  }
}
