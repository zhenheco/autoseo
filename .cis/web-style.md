# 1wayseo Web Style CIS Draft

Status: DRAFT, pending Ace's review before downstream Gemini dispatches treat this as canonical.

## Brand Frame

1wayseo is a content flywheel SaaS for operators who need one repeatable loop from trend discovery to articles, social cards, distribution, and performance insight.

Tagline: Trends → Articles → Cards → Distribution → Insight, in one loop.

## Audience

Primary audience: Solo SEO operators and small content teams running multi-brand businesses.

Secondary audience: Founders of niche SaaS and DTC brands publishing weekly content.

Market assumptions: Asia plus global, ages 28-45, comfortable with English UI, working across English and CJK content.

## Voice

- Confident: write like a capable operator, not a hype-driven vendor.
- Operator-empathetic: acknowledge production workload, deadlines, handoffs, and review loops.
- Low-jargon: explain automation value in practical workflow terms.
- Evidence-led: prefer metrics, comparisons, and observed outcomes over abstract claims.

## Differentiation

- End-to-end flywheel from trends to publishing.
- Brand memory that improves prompts week over week.
- Multi-language and multi-platform workflows out of the box.

## Visual Direction

Use a quiet SaaS operations interface, not a marketing-heavy or decorative product shell. Prioritize dense but readable dashboards, restrained surfaces, consistent hierarchy, and clear action paths.

Primary color: `hsl(217, 91%, 55%)`.

Secondary color: `hsl(150, 70%, 50%)`.

Accent color: violet scale from the design-system token contract.

Semantic color rule: use only design-system tokens for UI state. Avoid hardcoded color literals in components.

## Typography

Display: Plus Jakarta Sans.

Body: Inter.

CJK body fallback: Noto Sans TC, Noto Sans JP, Noto Sans KR.

Use the design-system type ladder:

- Display: `var(--font-display)`
- H1: `var(--font-h1)`
- H2: `var(--font-h2)`
- H3: `var(--font-h3)`
- Body: `var(--font-body)`
- Small: `var(--font-small)`
- Tiny: `var(--font-tiny)`

CJK content receives a 12.5 percent base-size bump through `:lang(zh-Hant)`, `:lang(ja)`, and `:lang(ko)`.

## UI Guidance For Gemini

- Build actual workflow screens first; do not create a generic landing page unless explicitly requested.
- Prefer operational layouts: tables, filters, metric strips, split panes, review queues, and compact cards for repeated objects.
- Keep cards at 8px radius unless the surrounding component contract uses a larger token.
- Use token names in code and styles. Do not introduce hardcoded color values.
- Use focus-visible states, reduced-motion compatibility, and dark-mode-aware surfaces.
- Keep content language practical and specific to the content flywheel loop.

## Competitor Context

Reference category peers: Surfer SEO, Jasper, Frase, and Letterdrop.

The visual opportunity is to feel more workflow-complete than writing tools, less dense than enterprise SEO suites, and more production-aware than prompt wrappers.
