# Bloomfield BCCC — Community Website

A modern, fully responsive community website built with **vanilla HTML, CSS, and JavaScript** — no frameworks, no dependencies. Designed to showcase professional frontend development skills including advanced CSS animations, intersection observer patterns, accessible markup, and performant JavaScript.

---

## Live Features

- **Animated Preloader** — SVG stroke animation with smooth fade-out on page load
- **Dark / Light Mode** — System-preference detection with manual toggle and localStorage persistence
- **Interactive Hero** — Particle effects, animated gradient shimmer text, mouse-following glow, and animated stat counters
- **Infinite Marquee Ticker** — Pure CSS horizontal scroll of community values
- **Meet the Team Section** — Leadership cards with custom hue avatars and social links
- **CSS Gradient Art Gallery** — Beautiful gradient compositions replacing placeholder images, with hover overlays
- **Scroll-Triggered Reveals** — Staggered animations via Intersection Observer API
- **FAQ Accordion** — Native `<details>` element with animated chevrons
- **Contact Form** — Real-time validation, loading spinner, success state animation
- **CTA Banner** — Full-width gradient call-to-action with dot-grid overlay
- **Back-to-Top Button** — Appears on scroll with spring animation
- **Responsive Design** — Mobile-first layout from 320px to 4K screens
- **Accessible Markup** — Semantic HTML5, ARIA labels, skip navigation, focus management, reduced-motion support
- **Print Styles** — Clean print output with non-essential elements hidden

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 (semantic elements) |
| Styling | CSS3 (custom properties, grid, animations, `clamp()`, `aspect-ratio`) |
| Interactivity | Vanilla JavaScript (ES6+ module pattern) |
| Icons | Inline SVG (zero network requests) |
| Fonts | System font stack (zero network requests) |

## Project Structure

```
bloomfield-bccc-website/
├── index.html            # Single-page application
├── css/
│   ├── reset.css         # Modern CSS reset (Andy Bell + Josh Comeau)
│   ├── variables.css     # Design tokens, color palettes, light/dark themes
│   ├── base.css          # Typography, buttons, global elements
│   ├── layout.css        # Container system, section structure
│   ├── components.css    # Nav, event cards, testimonials, FAQ, form
│   ├── sections.css      # Hero, marquee, team, gallery art, CTA, footer
│   ├── animations.css    # Scroll reveals, keyframes, stagger delays
│   └── responsive.css    # Breakpoints, print, high-contrast, hover queries
├── js/
│   ├── app.js            # Main controller — orchestrates all modules
│   ├── theme.js          # Dark/light mode manager with OS detection
│   ├── navigation.js     # Mobile nav, scroll tracking, smooth scroll
│   ├── animations.js     # IntersectionObserver reveals + stat counters
│   └── components.js     # Preloader, mouse glow, form, particles, back-to-top
├── assets/
│   └── images/           # Image assets directory
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/mathi2k2/Community-Website-.git
cd Community-Website-

# Open directly (no build step needed)
open index.html

# Or use a local dev server
npx live-server --port=3000
```

## Skills Demonstrated

**CSS Architecture & Design Systems**
- 8-file modular CSS with BEM-inspired naming
- 50+ CSS custom properties as design tokens
- Complete light/dark theming via `data-theme` attribute
- Fluid typography & spacing with `clamp()`

**Advanced CSS Techniques**
- CSS Grid & Flexbox mastery across all layouts
- `backdrop-filter` glassmorphism navigation
- CSS-only infinite marquee animation
- Gradient art compositions (no images)
- `aspect-ratio`, `color-scheme`, custom `@media` queries
- Print, high-contrast, and hover-capability media queries

**JavaScript Patterns**
- IIFE module pattern for encapsulation
- Intersection Observer for performant scroll animations
- RequestAnimationFrame-throttled scroll handlers
- Event delegation & passive event listeners
- Progressive enhancement (reduced-motion, touch detection)

**Accessibility & Performance**
- Semantic HTML5 landmark elements
- Skip navigation link
- ARIA labels, roles, and live regions
- `prefers-reduced-motion` respected throughout
- Zero external dependencies = zero network requests for assets
- Lazy DOM manipulation (particles created at runtime)

## Browser Support

Chrome 90+ | Firefox 88+ | Safari 14+ | Edge 90+

## License

MIT License — feel free to use as a template for your own community projects.
