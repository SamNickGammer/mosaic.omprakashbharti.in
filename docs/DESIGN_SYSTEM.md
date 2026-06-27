# Mosaic — Design System & Frontend Reference
**Version:** 1.0  
**Stack:** Next.js 14 + Tailwind CSS + shadcn/ui  
**Font delivery:** `next/font/google`

> This file is the single source of truth for all visual decisions in Mosaic.  
> Every color, size, shadow, radius, and animation value lives here.  
> Claude Code must derive every styling decision from this file.

---

## 1. Brand Colors

Extracted from the Mosaic logo palette — indigo → violet → teal gradient system.

```css
/* globals.css or tailwind.config tokens */

:root {
  /* ── Brand ── */
  --mosaic-indigo:        #4F46E5;   /* Primary brand — buttons, links, active states */
  --mosaic-violet:        #7C3AED;   /* Secondary brand — gradients, highlights */
  --mosaic-teal:          #06B6D4;   /* Accent — badges, success, streaming indicators */

  /* ── Backgrounds ── */
  --mosaic-dark:          #0F172A;   /* App bg (dark mode) */
  --mosaic-slate:         #1E293B;   /* Card / panel bg */
  --mosaic-slate-hover:   #263348;   /* Card hover state */
  --mosaic-border:        #2D3F55;   /* Subtle borders, dividers */
  --mosaic-light:         #F8FAFC;   /* App bg (light mode) */
  --mosaic-light-card:    #FFFFFF;   /* Card bg (light mode) */
  --mosaic-light-border:  #E2E8F0;   /* Borders (light mode) */

  /* ── Text ── */
  --mosaic-text-primary:  #F1F5F9;   /* Headings, body (dark) */
  --mosaic-text-secondary:#94A3B8;   /* Subtext, labels (dark) */
  --mosaic-muted:         #64748B;   /* Placeholder, disabled */
  --mosaic-text-dark:     #0F172A;   /* Body text (light mode) */

  /* ── Semantic ── */
  --mosaic-success:       #10B981;   /* Done, complete */
  --mosaic-warning:       #F59E0B;   /* Needs attention, in-progress */
  --mosaic-error:         #EF4444;   /* Errors */
  --mosaic-info:          #06B6D4;   /* Info, streaming (reuses teal) */
}
```

---

## 2. Gradient System

The logo's indigo→violet→teal gradient is the core signature. Use it intentionally — not on every surface.

```css
/* Brand gradient — logo, hero text, primary CTAs */
--gradient-brand: linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%);

/* Subtle gradient — card accents, active sidebar items */
--gradient-subtle: linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(6,182,212,0.10) 100%);

/* Dark panel gradient — main sidebar background */
--gradient-panel: linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
```

### Tailwind config additions

```js
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        mosaic: {
          indigo:  '#4F46E5',
          violet:  '#7C3AED',
          teal:    '#06B6D4',
          dark:    '#0F172A',
          slate:   '#1E293B',
          border:  '#2D3F55',
          muted:   '#64748B',
          light:   '#F8FAFC',
        }
      },
      backgroundImage: {
        'gradient-brand':  'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%)',
        'gradient-subtle': 'linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(6,182,212,0.10) 100%)',
        'gradient-panel':  'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
      }
    }
  }
}
```

---

## 3. Typography

### Font Stack

```ts
// app/layout.tsx
import { Inter, Geist_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})
```

| Role | Font | Use |
|------|------|-----|
| **Display / Wordmark** | Inter 700 | Logo text, page headings, modal titles |
| **Body** | Inter 400–500 | All body copy, task descriptions, chat messages |
| **UI Labels** | Inter 500–600 | Buttons, nav items, badges, column headers |
| **Code / Mono** | Geist Mono 400 | API keys, code snippets, agent trace output |

### Type Scale

```css
/* Base: 1rem = 16px */

--text-xs:    0.75rem;    /* 12px — badges, timestamps, helper text */
--text-sm:    0.875rem;   /* 14px — sidebar labels, card metadata */
--text-base:  1rem;       /* 16px — body text, chat messages */
--text-lg:    1.125rem;   /* 18px — card titles, section subheadings */
--text-xl:    1.25rem;    /* 20px — page subheadings */
--text-2xl:   1.5rem;     /* 24px — page titles */
--text-3xl:   1.875rem;   /* 30px — hero headings */
--text-4xl:   2.25rem;    /* 36px — dashboard welcome */
```

### Font Weights

```css
--font-normal:    400;   /* Body copy */
--font-medium:    500;   /* Labels, nav items */
--font-semibold:  600;   /* Card titles, section headers */
--font-bold:      700;   /* Page headings, logo wordmark */
```

### Line Heights (Leading)

```css
--leading-none:    1;      /* Logo / display text only */
--leading-tight:   1.25;   /* Headings (h1, h2) */
--leading-snug:    1.375;  /* Card titles, subheadings */
--leading-normal:  1.5;    /* Body copy default */
--leading-relaxed: 1.625;  /* Chat messages, long instructions */
--leading-loose:   2;      /* Not used in Mosaic */
```

### Letter Spacing (Tracking)

```css
--tracking-tight:  -0.025em;  /* Large headings (3xl+) */
--tracking-normal:  0em;      /* Body text */
--tracking-wide:    0.025em;  /* Badges, uppercase labels */
--tracking-widest:  0.1em;    /* ALL CAPS metadata labels */
```

### Tailwind Typography Classes (Quick Reference)

```
Headings:     text-2xl font-bold tracking-tight leading-tight
Subheadings:  text-lg font-semibold leading-snug
Body:         text-base font-normal leading-normal
Small/Meta:   text-sm font-medium text-mosaic-muted
Labels/Badge: text-xs font-semibold tracking-wide uppercase
Mono/Code:    font-mono text-sm
```

---

## 4. Spacing System

Mosaic uses an **8px base grid**. All spacing values are multiples of 4px or 8px.

```css
/* Tailwind default spacing scale — use these classes */

--space-1:   4px;    /* px-1, py-1 — micro gaps, icon padding */
--space-2:   8px;    /* px-2, py-2 — badge padding, tight elements */
--space-3:   12px;   /* px-3, py-3 — button padding (sm) */
--space-4:   16px;   /* px-4, py-4 — default card padding, button padding */
--space-5:   20px;   /* px-5, py-5 — section inner padding */
--space-6:   24px;   /* px-6, py-6 — card padding (comfortable) */
--space-8:   32px;   /* px-8, py-8 — section gaps */
--space-10:  40px;   /* px-10 — wide section padding */
--space-12:  48px;   /* px-12 — large section gaps */
--space-16:  64px;   /* px-16 — page-level vertical rhythm */
```

### Layout Dimensions

```css
--sidebar-width:        256px;   /* w-64 */
--sidebar-collapsed:    64px;    /* w-16 (icon-only mode) */
--topbar-height:        56px;    /* h-14 */
--task-card-min-height: 80px;
--chat-input-height:    56px;
--kanban-col-width:     280px;   /* min-w-[280px] */
--modal-sm:             400px;   /* max-w-sm */
--modal-md:             560px;   /* max-w-lg */
--modal-lg:             720px;   /* max-w-2xl */
```

---

## 5. Border Radius

Mosaic uses **rounded but not bubbly** — modern SaaS feel, not toy-like.

```css
--radius-sm:    4px;    /* rounded-sm — badges, inputs, code blocks */
--radius-md:    8px;    /* rounded — cards, buttons, dropdowns (DEFAULT) */
--radius-lg:    12px;   /* rounded-xl — modals, popovers, large cards */
--radius-xl:    16px;   /* rounded-2xl — feature panels, hero sections */
--radius-full:  9999px; /* rounded-full — avatar, status dots, pills */
```

shadcn/ui config:
```json
{
  "style": "default",
  "radius": 0.5
}
```

---

## 6. Shadows & Elevation

```css
/* Dark-mode optimized — use glow instead of hard drop shadows */

--shadow-sm:    0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md:    0 4px 12px rgba(0, 0, 0, 0.35);
--shadow-lg:    0 8px 24px rgba(0, 0, 0, 0.4);
--shadow-xl:    0 16px 48px rgba(0, 0, 0, 0.5);

/* Brand glow — for active states, focused inputs, primary CTAs */
--shadow-brand: 0 0 0 3px rgba(79, 70, 229, 0.35);
--shadow-teal:  0 0 0 3px rgba(6, 182, 212, 0.25);

/* Card hover lift */
--shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(79, 70, 229, 0.2);
```

```js
// tailwind.config.ts
boxShadow: {
  'brand': '0 0 0 3px rgba(79, 70, 229, 0.35)',
  'teal':  '0 0 0 3px rgba(6, 182, 212, 0.25)',
  'card':  '0 4px 12px rgba(0, 0, 0, 0.35)',
  'card-hover': '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(79, 70, 229, 0.2)',
}
```

---

## 7. Component Patterns

### Buttons

```tsx
/* Primary — gradient brand */
<button className="
  bg-gradient-brand text-white
  px-4 py-2 rounded-md
  text-sm font-semibold
  hover:opacity-90 active:opacity-80
  transition-opacity duration-150
  shadow-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mosaic-indigo
">
  Start Agent
</button>

/* Secondary — outlined */
<button className="
  border border-mosaic-border text-mosaic-text-primary bg-transparent
  px-4 py-2 rounded-md text-sm font-medium
  hover:bg-mosaic-slate-hover hover:border-mosaic-indigo
  transition-colors duration-150
">
  Cancel
</button>

/* Ghost — minimal */
<button className="
  text-mosaic-text-secondary text-sm font-medium
  px-3 py-1.5 rounded-md
  hover:bg-mosaic-slate hover:text-mosaic-text-primary
  transition-colors duration-150
">
  View trace
</button>

/* Destructive */
<button className="
  bg-red-500/10 text-red-400 border border-red-500/20
  px-4 py-2 rounded-md text-sm font-medium
  hover:bg-red-500/20
  transition-colors duration-150
">
  Remove
</button>
```

### Cards

```tsx
/* Standard card */
<div className="
  bg-mosaic-slate border border-mosaic-border
  rounded-xl p-6
  hover:shadow-card-hover hover:border-mosaic-indigo/30
  transition-all duration-200
">

/* Task card (Kanban) */
<div className="
  bg-mosaic-slate border border-mosaic-border
  rounded-lg p-4 cursor-pointer
  hover:border-mosaic-indigo/40 hover:-translate-y-0.5
  transition-all duration-150
  shadow-card
">

/* Active/selected state */
<div className="
  bg-gradient-subtle border border-mosaic-indigo/40
  rounded-xl p-6
">
```

### Badges / Status Pills

```tsx
/* Backlog */
<span className="text-xs font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-mosaic-slate text-mosaic-muted border border-mosaic-border">
  Backlog
</span>

/* In Progress */
<span className="text-xs font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
  In Progress
</span>

/* Review */
<span className="text-xs font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
  Review
</span>

/* Done */
<span className="text-xs font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
  Done
</span>

/* Agent streaming indicator */
<span className="flex items-center gap-1.5 text-xs font-medium text-mosaic-teal">
  <span className="w-1.5 h-1.5 rounded-full bg-mosaic-teal animate-pulse" />
  Analyzing...
</span>
```

### Inputs

```tsx
<input className="
  w-full bg-mosaic-dark border border-mosaic-border
  rounded-md px-3 py-2
  text-sm text-mosaic-text-primary placeholder:text-mosaic-muted
  focus:outline-none focus:border-mosaic-indigo focus:ring-1 focus:ring-mosaic-indigo
  transition-colors duration-150
" />
```

### Sidebar Item

```tsx
/* Default */
<button className="
  w-full flex items-center gap-3 px-3 py-2 rounded-md
  text-sm font-medium text-mosaic-text-secondary
  hover:bg-mosaic-slate hover:text-mosaic-text-primary
  transition-colors duration-150
">

/* Active */
<button className="
  w-full flex items-center gap-3 px-3 py-2 rounded-md
  text-sm font-semibold text-white
  bg-gradient-subtle border border-mosaic-indigo/30
">
```

---

## 8. Agent Provider Colors

Each AI provider has a consistent color identity used across badges, icons, and trace UI.

```css
/* Use as Tailwind arbitrary values or extend config */
--agent-claude:   #CC785C;   /* Anthropic orange-brown */
--agent-openai:   #10A37F;   /* OpenAI green */
--agent-copilot:  #0078D4;   /* GitHub/Microsoft blue */
--agent-custom:   #64748B;   /* Neutral slate for custom */
```

```tsx
/* Agent badge pattern */
const agentColors = {
  anthropic:      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  openai:         'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  github_copilot: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  custom:         'bg-slate-500/10 text-slate-400 border-slate-500/20',
}
```

---

## 9. Motion & Animation

Keep animations fast and purposeful. Mosaic is a tool, not a showcase.

```css
/* Duration tokens */
--duration-instant:  100ms;   /* Hover micro-feedback */
--duration-fast:     150ms;   /* Button states, badge changes */
--duration-normal:   200ms;   /* Card hover, sidebar transitions */
--duration-slow:     300ms;   /* Modal open/close, panel slide */
--duration-slower:   500ms;   /* Page transitions, skeleton loaders */

/* Easing */
--ease-out:    cubic-bezier(0.0, 0.0, 0.2, 1);   /* Enter animations */
--ease-in:     cubic-bezier(0.4, 0.0, 1, 1);      /* Exit animations */
--ease-inout:  cubic-bezier(0.4, 0.0, 0.2, 1);    /* Reposition */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Card lift, modal pop */
```

```js
// tailwind.config.ts
transitionDuration: {
  'instant': '100ms',
  'fast':    '150ms',
  'normal':  '200ms',
  'slow':    '300ms',
},
transitionTimingFunction: {
  'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}
```

### Streaming Pulse (Agent Thinking)

```css
/* Teal pulse for active streaming */
@keyframes mosaic-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.streaming-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--mosaic-teal);
  animation: mosaic-pulse 1.2s ease-in-out infinite;
}

.streaming-dot:nth-child(2) { animation-delay: 0.2s; }
.streaming-dot:nth-child(3) { animation-delay: 0.4s; }
```

---

## 10. Dark Mode (Default) vs Light Mode

Mosaic defaults to **dark mode**. Light mode is available but secondary.

```tsx
// app/layout.tsx
<html lang="en" className="dark">
```

```css
/* Dark (default) */
.dark {
  --bg-app:       #0F172A;
  --bg-card:      #1E293B;
  --bg-input:     #0F172A;
  --text-primary: #F1F5F9;
  --text-muted:   #64748B;
  --border:       #2D3F55;
}

/* Light */
:root:not(.dark) {
  --bg-app:       #F8FAFC;
  --bg-card:      #FFFFFF;
  --bg-input:     #F8FAFC;
  --text-primary: #0F172A;
  --text-muted:   #94A3B8;
  --border:       #E2E8F0;
}
```

---

## 11. Accessibility Baseline

- Minimum contrast: 4.5:1 for body text, 3:1 for large headings
- All interactive elements have `focus-visible` styles using `ring-2 ring-mosaic-indigo`
- Never rely on color alone to convey state — always pair with icon or label
- `prefers-reduced-motion` respected — wrap animations in:
  ```css
  @media (prefers-reduced-motion: no-preference) {
    /* animation here */
  }
  ```
- All icon buttons need `aria-label`
- Agent status updates should use `aria-live="polite"` for screen readers

---

## 12. globals.css Starter

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --mosaic-indigo:       #4F46E5;
    --mosaic-violet:       #7C3AED;
    --mosaic-teal:         #06B6D4;
    --mosaic-dark:         #0F172A;
    --mosaic-slate:        #1E293B;
    --mosaic-slate-hover:  #263348;
    --mosaic-border:       #2D3F55;
    --mosaic-light:        #F8FAFC;
    --mosaic-text-primary: #F1F5F9;
    --mosaic-text-secondary:#94A3B8;
    --mosaic-muted:        #64748B;
    --gradient-brand: linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%);
    --gradient-subtle: linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(6,182,212,0.10) 100%);
  }

  * {
    @apply border-border;
  }

  html {
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    @apply bg-[#0F172A] text-[#F1F5F9];
    font-family: var(--font-inter), system-ui, sans-serif;
  }

  code, kbd, pre {
    font-family: var(--font-mono), 'Courier New', monospace;
  }
}

@layer utilities {
  .bg-gradient-brand {
    background: var(--gradient-brand);
  }
  .bg-gradient-subtle {
    background: var(--gradient-subtle);
  }
  .text-gradient-brand {
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

@keyframes mosaic-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.streaming-dot {
  width: 6px; height: 6px;
  border-radius: 9999px;
  background: #06B6D4;
  animation: mosaic-pulse 1.2s ease-in-out infinite;
}
.streaming-dot:nth-child(2) { animation-delay: 0.2s; }
.streaming-dot:nth-child(3) { animation-delay: 0.4s; }
```

---

*Mosaic Design System v1.0 — every pixel intentional.*
