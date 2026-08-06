# Design — Reflectometry

A locked design system for the reflectometry app. Functional and scientific behaviour takes precedence over decoration.

## Genre

Modern-minimal, technical and austere.

## Macrostructure family

- App pages: Workbench; configuration is layered and results remain the primary visual plane.
- Content pages: Long Document with the same type, colour and control language.
- Marketing pages: not currently used.

## Theme

- Paper: warm near-white surfaces (`--color-paper` through `--color-paper-raised`).
- Ink: warm charcoal, never pure black.
- Accent: signal orange, restricted to active states, focus and primary actions.
- Scientific plots: accessible blue/orange pair with different line and marker patterns.

## Typography

- Display: Geist, weight 700, roman.
- Body: IBM Plex Sans, weight 400 or 600.
- Mono: Geist Mono, for parameters, units and numerical results.
- Display tracking: `-0.035em`.
- Type scale: major third; `--text-display` is capped at `4rem`.

## Spacing

Four-point named scale defined in `tokens.css`. Components consume named tokens rather than raw spacing values.

## Motion

- Motion communicates press, disclosure and state change only.
- Easings: `--ease-out`, `--ease-in`, `--ease-in-out`.
- Reduced motion: spatial effects collapse to an opacity change of at most 150 ms.

## Microinteractions stance

- Silent success; status text carries asynchronous feedback.
- Focus is immediate and never animated.
- Hover uses a single colour or one-pixel position change.
- Popovers and primary workflow disclosures use Headless UI interaction primitives.
- Interface icons use the Heroicons 24 px outline set at an 18 px rendered size.

## CTA voice

- Primary: dark ink fill with concise verb-first copy.
- Secondary: raised paper with a visible rule.
- All controls share a 44 px minimum height on touch surfaces.

## Per-page allowances

- App pages use no decorative enrichment; function carries the page.
- Scientific plots may retain semantic data colours and patterns.
- Advanced scientific controls stay behind native disclosures until requested.

## What pages MUST share

- Reflectometry wordmark and three-bar mark.
- Warm paper, charcoal ink and signal-orange accent.
- Geist, IBM Plex Sans and Geist Mono roles.
- Input, button, disclosure, focus and status language.

## What pages MAY differ on

- Result density and plot arrangement.
- Which workflow disclosure is initially open.
- Content-page measure and section rhythm.

## Exports

### tokens.css

```css
:root {
  --color-paper: oklch(97% 0.009 65);
  --color-paper-2: oklch(94.5% 0.012 65);
  --color-paper-3: oklch(91.5% 0.014 65);
  --color-paper-raised: oklch(98.5% 0.007 65);
  --color-rule: oklch(85% 0.012 65);
  --color-rule-2: oklch(70% 0.014 65);
  --color-muted: oklch(44% 0.014 60);
  --color-neutral: oklch(34% 0.014 60);
  --color-ink-2: oklch(28% 0.016 60);
  --color-ink: oklch(17% 0.016 55);
  --color-accent: oklch(65% 0.205 42);
  --color-accent-ink: oklch(17% 0.016 55);
  --color-focus: oklch(49% 0.18 42);
  --font-display: "Geist", ui-sans-serif, sans-serif;
  --font-body: "IBM Plex Sans", ui-sans-serif, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --space-3xs: 0.25rem; --space-2xs: 0.5rem; --space-xs: 0.75rem;
  --space-sm: 1rem; --space-md: 1.5rem; --space-lg: 2rem;
  --space-xl: 2.5rem; --space-2xl: 4rem; --space-3xl: 6rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --radius-card: 0.5rem; --radius-pill: 999px; --radius-input: 0.375rem;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(97% 0.009 65);
  --color-paper-2: oklch(94.5% 0.012 65);
  --color-paper-3: oklch(91.5% 0.014 65);
  --color-ink: oklch(17% 0.016 55);
  --color-ink-2: oklch(28% 0.016 60);
  --color-accent: oklch(65% 0.205 42);
  --font-display: "Geist", ui-sans-serif, sans-serif;
  --font-body: "IBM Plex Sans", ui-sans-serif, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --spacing-sm: 1rem; --spacing-md: 1.5rem; --spacing-lg: 2rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --radius-card: 0.5rem;
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(97% 0.009 65)", "$type": "color" },
    "paper-2": { "$value": "oklch(94.5% 0.012 65)", "$type": "color" },
    "ink": { "$value": "oklch(17% 0.016 55)", "$type": "color" },
    "accent": { "$value": "oklch(65% 0.205 42)", "$type": "color" },
    "focus": { "$value": "oklch(49% 0.18 42)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Geist, ui-sans-serif, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "IBM Plex Sans, ui-sans-serif, sans-serif", "$type": "fontFamily" },
    "mono": { "$value": "Geist Mono, ui-monospace, monospace", "$type": "fontFamily" }
  },
  "space": {
    "sm": { "$value": "1rem", "$type": "dimension" },
    "md": { "$value": "1.5rem", "$type": "dimension" },
    "lg": { "$value": "2rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 97% 0.009 65;
  --foreground: 17% 0.016 55;
  --card: 98.5% 0.007 65;
  --card-foreground: 17% 0.016 55;
  --popover: 98.5% 0.007 65;
  --popover-foreground: 17% 0.016 55;
  --primary: 65% 0.205 42;
  --primary-foreground: 17% 0.016 55;
  --secondary: 91.5% 0.014 65;
  --secondary-foreground: 28% 0.016 60;
  --muted: 85% 0.012 65;
  --muted-foreground: 44% 0.014 60;
  --border: 85% 0.012 65;
  --input: 85% 0.012 65;
  --ring: 49% 0.18 42;
  --radius: 0.5rem;
}
```
