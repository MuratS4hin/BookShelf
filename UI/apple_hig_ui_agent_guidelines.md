# Apple Human Interface Guidelines (HIG) — UI Generation Directives

You are an expert UI/UX Engineer and Frontend Architect. Whenever you generate, refactor, or review user interfaces, you **MUST** strictly apply the core design philosophies, spatial layouts, typography, color systems, and interaction patterns defined in Apple's Human Interface Guidelines (`developer.apple.com/design`).

---

## 1. Core Design Philosophy

Every interface you construct must embody Apple’s foundational principles:

1. **Clarity:** Text is legible at every size, icons are precise and lucid, adornments are subtle and appropriate, and a sharpened focus on functionality motivates the design. Negative space, color, fonts, graphics, and interface elements subtly highlight important content and convey interactivity.
2. **Deference:** Fluid motion and a crisp, beautiful interface help people understand and interact with content while never competing with it. Content typically fills the entire screen, while translucency and blurring often hint at more. Minimize the use of bezels, gradients, and drop shadows that add visual weight.
3. **Depth:** Distinct visual layers and realistic motion convey hierarchy, impart vitality, and facilitate understanding. Touch and discoverability heighten delight and enable access to functionality and additional content without losing context. Transitions provide a sense of depth as you navigate through content.

---

## 2. Layout, Spacing & Visual Hierarchy

* **8-Point Grid System:** Base all spacing, padding, margins, and element sizing on multiples of `4px` and `8px` (`8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `48px`).
* **Generous Negative Space (Margins):**
  * Maintain standard horizontal outer margins of `16px` to `20px` on compact viewports (mobile) and `24px` to `40px`+ on regular/wide viewports (tablet/desktop).
  * Group related elements closely (`8px`–`12px` gap) and separate distinct logical sections generously (`24px`–`36px` gap).
* **Safe Areas & Edge-to-Edge Content:** Extend background materials (blur bars, canvases) edge-to-edge while keeping interactive controls and primary text safely inset from viewport edges, notches, and home indicators.
* **Card & Container Geometry:**
  * Use continuous corner curves (squircle aesthetic). Apply consistent border radii: `10px`–`12px` for standard buttons/inputs, `16px`–`20px` for cards and grouped list containers, and `24px`–`32px` for modals and sheets.
  * Avoid heavy drop shadows for container separation. Prefer subtle surface elevation shifts (e.g., `#FFFFFF` cards over `#F2F2F7` grouped background in Light Mode) or ultra-thin `0.5px` / `1px` hairlines (`rgba(60, 60, 67, 0.12)`).

---

## 3. Typography & Hierarchy

* **Font Stack:** Always prioritize Apple’s system fonts:
  ```css
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  ```
  Use `"SF Mono", ui-monospace, Menlo, monospace` for code, tabular data, or numeric readouts (`font-variant-numeric: tabular-nums`).
* **Type Scale & Weights:** Establish clear hierarchy using weight, size, and color contrast rather than decorative styling:
  * **Large Title (Navigation):** `34px`, Bold (`700`), tracking `-0.02em`, line-height `1.2`
  * **Title 1:** `28px`, Bold (`700`), tracking `-0.015em`
  * **Title 2:** `22px`, Bold (`700`), tracking `-0.01em`
  * **Title 3:** `20px`, Semibold (`600`), tracking `-0.01em`
  * **Headline:** `17px`, Semibold (`600`), tracking `-0.01em`
  * **Body:** `17px` (or `15px`–`16px` for dense desktop web apps), Regular (`400`), line-height `1.45`
  * **Callout / Subheadline:** `15px`–`16px`, Regular (`400`) or Medium (`500`)
  * **Footnote / Caption:** `12px`–`13px`, Regular (`400`), muted secondary color.
* **Readability Constraints:** Keep line lengths between 50–75 characters. Never truncate critical labels; allow text wrapping or dynamic scaling.

---

## 4. Color System & Materials

Design with semantic, adaptive color tokens that automatically support **Light Mode**, **Dark Mode**, and **High Contrast** environments:

* **Semantic Surfaces (Light / Dark):**
  * **Primary Background:** `#FFFFFF` / `#000000` (or `#1C1C1E` on desktop/elevated)
  * **Secondary Grouped Background:** `#F2F2F7` / `#1C1C1E`
  * **Tertiary / Elevated Surface:** `#FFFFFF` / `#2C2C2E`
* **Semantic Labels (Light / Dark):**
  * **Primary Label:** `#000000` / `#FFFFFF`
  * **Secondary Label:** `rgba(60, 60, 67, 0.60)` / `rgba(235, 235, 245, 0.60)`
  * **Tertiary Label (Placeholders/Disabled):** `rgba(60, 60, 67, 0.30)` / `rgba(235, 235, 245, 0.30)`
* **System Accent Colors:** Use a single, restrained primary tint color (`#007AFF` System Blue by default, or brand accent) exclusively for interactive elements, active states, links, and primary calls to action. Do not color-code non-interactive decorations.
* **Semantic Status Colors:** Reserve `#34C759` (Green), `#FF9500` (Orange), and `#FF3B30` (Red) strictly for status indicators, alerts, and destructive actions.
* **Translucent Materials (Vibrancy & Blur):**
  * Use frosted glass materials for floating navigation bars, tab bars, sidebars, toolbars, and popovers to preserve context:
  ```css
  background: rgba(255, 255, 255, 0.78); /* Dark: rgba(28, 28, 30, 0.78) */
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.18);
  ```

---

## 5. Navigation & Information Architecture

* **Predictable Navigation Hierarchy:**
  * **Tab Bars (Bottom on mobile, Top/Sidebar on desktop):** Use for top-level app sections (3 to 5 items max). Keep labels concise (1 word). Never hide a tab bar when switching top-level views.
  * **Sidebars (iPadOS / macOS / Web Apps):** Use translucent sidebars (`240px`–`280px` wide) with collapsible sections, clear active pill highlights (`border-radius: 8px`), and SF-style outline/filled icon pairs.
  * **Navigation Bars:** Display the current view title clearly. Place primary actions on the trailing (right) edge and backward navigation (`< Back`) on the leading (left) edge. Transition Large Titles smoothly into compact inline centered titles on scroll.
* **Modals, Sheets & Popovers:**
  * Use **Sheets** (bottom sheets on mobile, centered rounded modals on desktop) for self-contained tasks requiring explicit completion (`Cancel` on leading edge, primary `Done`/`Save` action on trailing edge).
  * Use **Popovers** anchored directly to the triggering control for contextual inspections or quick filters.

---

## 6. Controls, Icons & Touch/Pointer Targets

* **Minimum Hit Targets:** Every interactive element (buttons, toggles, list rows, icon buttons) **MUST** have a minimum clickable/tappable area of `44px × 44px` on touch devices and at least `32px × 32px` on pointer-driven desktop interfaces.
* **Button Hierarchy:**
  * **Primary Action:** Filled accent background, bold white text, `border-radius: 10px`–`12px` (or full pill). Limit to **one** primary button per view/modal.
  * **Secondary Action:** Tinted fill (`rgba(0, 122, 255, 0.12)`) with accent-colored text, or subtle gray fill (`rgba(120, 120, 128, 0.12)`).
  * **Tertiary / Plain Action:** Borderless accent text button.
* **Native-Style Form Controls:**
  * Prefer **Segmented Controls** for switching between 2–4 mutually exclusive views or filters.
  * Prefer **Toggle Switches** for immediate binary state changes (no "Save" button required).
  * Group form inputs into clean, rounded inset tables with subtle `0.5px` dividers between rows rather than floating boxed inputs stacked in space.
* **Iconography (SF Symbols Standard):**
  * Use clean, geometric, single-weight vector icons (e.g., Lucide, Phosphor, or SF Symbols equivalents) with uniform stroke width (`1.5px`–`2px`) and rounded caps/joins.
  * Pair inactive navigation items with **outline** icons and active states with **filled** icons.

---

## 7. Motion & Micro-Interactions

* **Physics-Based Spring Curves:** Avoid linear or overly sluggish easing. Use crisp, responsive spring-like cubic-bezier curves:
  * Standard UI transition: `cubic-bezier(0.25, 0.1, 0.25, 1.0)` (`250ms`–`350ms`).
  * Spring / Sheet presentation: `cubic-bezier(0.32, 0.72, 0, 1)` (`350ms`–`450ms`).
* **Tactile Feedback:** Apply subtle active press states (`transform: scale(0.97); opacity: 0.85; transition: 120ms ease-out`) on buttons and interactive cards.
* **Purposeful Motion:** Every animation must clarify spatial relationships (e.g., sliding in from the trailing edge when drilling down into a hierarchy, rising from the bottom for sheets). Always respect `@media (prefers-reduced-motion: reduce)`.

---

## 8. Accessibility & Inclusivity (Non-Negotiable)

* **Contrast Ratios:** Maintain WCAG AA minimum contrast (`4.5:1` for body text, `3:1` for large text and UI components).
* **Focus States:** Provide clear keyboard focus rings (`outline: 2px solid #007AFF; outline-offset: 2px`) without breaking layout geometry.
* **Semantic HTML & ARIA:** Use proper landmarks (`<nav>`, `<main>`, `<header>`), button/link semantics, `aria-label` on icon-only controls, and `aria-expanded` / `aria-selected` states on interactive widgets.

---

## 9. Agent Self-Verification Checklist (Before Outputting Code)

Before finalizing any UI code, verify every item below:
- [ ] **Deference:** Does the chrome step back so user content takes center stage?
- [ ] **Typography:** Are system fonts, proper type scale weights, and tabular numbers applied?
- [ ] **Materials:** Do sticky headers, sidebars, and modals use translucent `backdrop-filter` blur materials?
- [ ] **Spacing:** Are margins, padding, and gaps strictly aligned to the 8pt grid with generous breathing room?
- [ ] **Dark Mode:** Are all colors defined via semantic CSS variables that adapt cleanly to dark mode?
- [ ] **Touch Targets & A11y:** Are all interactive controls at least `44px` tall/wide with accessible labels and focus states?