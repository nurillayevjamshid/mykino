# Spatial Glass Chat — Implementation Plan

## Scope and structure

Add a standalone mobile-first chat/search experience at `/spatial` within the existing NTV static web application. Preserve the current movie-app homepage and all existing business logic. The static implementation consists of `webapp/spatial/index.html` for accessible semantic UI and inline-SVG controls, `webapp/spatial/spatial.css` for the visual system and responsive motion, and `webapp/spatial/spatial.js` for local interactions. Add explicit Vercel route aliases for `/spatial` and `/spatial/` before the root fallback. No new dependencies or backend services are required; conversation examples and note actions are local demo interactions.

## Design system

- **Design Movement:** Premium visionOS-inspired spatial glassmorphism: polished, thick, refractive acrylic slabs floating over a midnight ocean aurora.
- **Core Principles:** Layered depth; crisp light-catching bevels; calm high-contrast typography; tactile motion with clear focus and reduced-motion support.
- **Color Philosophy:** Ink-navy and deep teal preserve night-sky calm, while cyan, lavender, and a small warm highlight create prism-like edge refraction and make primary actions legible.
- **Layout Paradigm:** A full-height, asymmetric conversation canvas with a floating top identity/control rail, spacious message stream, contextual floating menus, and a bottom-anchored composer that respects mobile safe areas.
- **Signature Elements:** 1) CSS aurora ribbons and blurred ambient light sources; 2) acrylic slabs with 40px backdrop blur, thin gradient bevels, inner top-glow, and deep ambient shadows; 3) restrained iridescent action halos.
- **Interaction Philosophy:** Menus and controls feel like physical glass objects: gentle lift/press states, spring-like easing, outside-click/Escape dismissal, and useful feedback for local demo actions.
- **Animation:** 240–420ms cubic-bezier transitions for slab reveal and press; slow ambient background drift; message entrance fade/translate; honor `prefers-reduced-motion`.
- **Typography System:** Inter with system sans fallback. Compact tracked eyebrow labels, 34px responsive display heading, 16px semibold controls, and 14–16px message text with generous line-height.
- **Brand Essence:** A quiet, tactile AI workspace for capturing and finding thoughts, distinct through substantial physical-glass controls; **calm, luminous, precise**.
- **Brand Voice:** Clear, warm, and concise. Examples: “A little more clarity, right where you left it.” and “Ask me anything…”
- **Wordmark & Logo:** A small custom four-point glint inside a refractive orb paired with the “AURA” wordmark.
- **Signature Brand Color:** Polar cyan `#9DEBFF`, used as a soft luminous edge rather than a flat fill.

## Project structure

- `webapp/spatial/index.html` — standalone app shell, menu/dialog markup, conversation stream, and accessible composer.
- `webapp/spatial/spatial.css` — tokens, aurora background, beveled acrylic surfaces, responsive layout, and motion states.
- `webapp/spatial/spatial.js` — menu controls, note actions, prompt chips, local conversation composer, upload affordance, and keyboard behavior.
- `vercel.json` — two explicit aliases to the new static entry point; existing routing remains unchanged.
- `plan.md` / `TODO.md` — implementation decisions and acceptance clauses.

## Behavior

The page includes the exact “Ask me anything...” placeholder, plus and image/camera affordances, and distinct “Find in Note” and “Move Note” popup actions on matching glass surfaces. Users can enter and submit a message to see it appear locally, open and dismiss menus, filter demo notes, select a destination note, and trigger the image file picker. This is a polished front-end prototype; no external AI or persistent notes backend is implied.
