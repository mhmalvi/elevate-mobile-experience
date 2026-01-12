# TradieMate Branding Guidelines

A concise reference for colors, typography, tone, and quick implementation snippets for the TradieMate product.

## 1. Color Palette

- **Primary (Action/Highlight)**: Orange/Gold
  - Hex: `#FF8C00`
  - Hover: `#E67E00`
  - Usage: Primary buttons (CTAs), icon backgrounds, text highlights.
- **Secondary (Brand / Depth)**: Dark Teal
  - Hex: `#004D40`
  - Light: `#00695C`
  - Dark: `#00251F`
  - Usage: Hero backgrounds, footers, headings, text emphasis.
- **Neutral**: `#F5F5F5` (Slate-50)
  - Usage: Section backgrounds, cards.
- **Accents**
  - Success (Green): `#4CAF50` — success badges, money-related UI.
  - Danger (Red): `#F44336` — errors, destructive actions.

## 2. Typography

- **Headings**: `Montserrat` (weights: 600, 700, 800)
  - Style: Bold, modern — used for prominent headings and CTAs.
- **Body**: `Open Sans` (weights: 400, 500, 600)
  - Style: Clean, highly legible for long and dense text.

Suggested sizes (adjust responsively):
- H1: 32–36px / 700
- H2: 24–28px / 700
- H3: 18–20px / 600
- Body: 14–16px / 400–500

Add Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

## 3. Tone of Voice

- **Persona:** The "Aussie Tradie" — down-to-earth, reliable, no-nonsense.
- **Keywords:** Mate, Fair dinkum, Ditch the paperwork, Grind.
- **Style:** Benefit-driven, direct, trusted.

Microcopy examples:
- CTA: "Pay Now", "Send Invoice"
- Friendly nudge: "Need a hand, mate? Book a call."
- Success toast: "Payment received — cheers, mate!"
- Error: "Whoops — that didn’t work. Try again in a minute."

Do / Don't
- Do: Use slang like "Mate" sparingly and in casual contexts.
- Do: Lead with benefits: "Ditch the paperwork — get paid faster."
- Don't: Overuse slang in legal or transactional text.
- Don't: Use cheeky copy for error messages requiring clarity.

## 4. Quick Implementation Snippets

### CSS variables (recommended file: `styles/branding.css`)

```css
:root {
  --color-primary: #FF8C00;
  --color-primary-hover: #E67E00;
  --color-secondary: #004D40;
  --color-secondary-light: #00695C;
  --color-secondary-dark: #00251F;
  --color-neutral-50: #F5F5F5;
  --color-success: #4CAF50;
  --color-danger: #F44336;
  --radius-base: 12px;
  --radius-pill: 9999px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-pill);
  padding: 0.75rem 1.25rem;
  font-weight: 700;
}
.btn-primary:hover { background: var(--color-primary-hover); }

.card {
  background: #fff;
  border-radius: var(--radius-base);
  padding: var(--spacing-md);
  box-shadow: 0 6px 20px rgba(6,6,20,0.06);
}
```

### Tailwind `theme.extend` snippet

Add to your `tailwind.config.js` under `theme.extend`:

```js
colors: {
  primary: { DEFAULT: '#FF8C00', hover: '#E67E00' },
  secondary: { DEFAULT: '#004D40', light: '#00695C', dark: '#00251F' },
  neutral: { 50: '#F5F5F5' },
  success: '#4CAF50',
  danger: '#F44336',
},
fontFamily: {
  heading: ['Montserrat', 'sans-serif'],
  body: ['"Open Sans"', 'sans-serif'],
},
borderRadius: {
  base: '12px',
  pill: '9999px',
},
```

## 5. Accessibility notes

- Ensure sufficient contrast for small text; prefer secondary dark for small text on light backgrounds.
- Use bold white text on the primary orange for CTA copy to meet contrast.


