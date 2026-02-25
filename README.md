# Bloomfield Community Website

A modern, fully responsive community website built with **vanilla HTML, CSS, and JavaScript** — no frameworks, no dependencies. Designed to showcase professional frontend development skills including advanced CSS animations, intersection observer patterns, accessible markup, and performant JavaScript.

---

## Features

- **Responsive Design** — Mobile-first layout that adapts seamlessly from 320px to 4K screens
- **Dark / Light Mode** — System-preference detection with manual toggle and localStorage persistence
- **Smooth Animations** — Scroll-triggered reveals using Intersection Observer API
- **Accessible Markup** — Semantic HTML5, ARIA labels, skip navigation, focus management
- **Performance Optimized** — No external dependencies, lazy-loaded images, CSS containment
- **Modern CSS** — Custom properties, `clamp()` fluid typography, CSS Grid & Flexbox layouts
- **Interactive Elements** — Animated navigation, accordion FAQ, member counter, event cards

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 (semantic elements) |
| Styling | CSS3 (custom properties, grid, animations) |
| Interactivity | Vanilla JavaScript (ES6+) |
| Icons | Inline SVG |
| Fonts | System font stack (zero network requests) |

## Project Structure

```
bloomfield-community-website/
├── index.html          # Main single-page application
├── css/
│   ├── reset.css       # Modern CSS reset
│   ├── variables.css   # Design tokens & custom properties
│   ├── base.css        # Typography, global styles
│   ├── layout.css      # Grid systems, containers
│   ├── components.css  # Reusable UI components
│   ├── sections.css    # Page section styles
│   ├── animations.css  # Keyframes & scroll animations
│   └── responsive.css  # Media queries & breakpoints
├── js/
│   ├── app.js          # Main application controller
│   ├── theme.js        # Dark/light mode manager
│   ├── navigation.js   # Mobile nav & scroll behavior
│   ├── animations.js   # Intersection Observer animations
│   └── components.js   # Interactive component logic
├── assets/
│   └── images/         # Optimized image assets
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/mathi2k2/Community-Website-.git

# Navigate to the project
cd Community-Website-

# Open in browser (no build step needed)
open index.html

# Or use a local dev server
npx live-server --port=3000
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Skills Demonstrated

- Semantic HTML5 & accessibility (WCAG 2.1 AA)
- CSS architecture (BEM-inspired naming, design tokens)
- CSS Grid & Flexbox mastery
- CSS custom properties & theming system
- Fluid typography with `clamp()`
- Scroll-driven animations (Intersection Observer)
- Responsive images & lazy loading
- JavaScript module pattern
- Event delegation & performance patterns
- Progressive enhancement
- Git workflow & documentation

## License

MIT License — feel free to use as a template for your own community projects.
