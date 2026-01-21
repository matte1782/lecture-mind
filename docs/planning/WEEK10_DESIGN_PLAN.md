# Week 10 Plan: Design System Enhancement + Animation Framework

> **⚠️ SUPERSEDED**: This document has been superseded by `WEEK10_UNIFIED_PLAN.md`.
> Do NOT use this document for implementation. Refer to the unified plan only.
> — Marked 2026-01-21 per hostile-reviewer condition N1

**Duration**: 5 days @ 4 hours/day = 20 hours total
**Goal**: Establish premium design foundation for Student Playground (v0.4.0)
**Agent**: ARCHITECT (frontend-design focus)
**Status**: ~~READY FOR EXECUTION~~ **SUPERSEDED**

---

## Prerequisites (MUST COMPLETE BEFORE DAY 1)

### P1: Verify Current CSS Structure
```bash
# Confirm existing files:
ls src/vl_jepa/api/static/*.css
# Expected: tokens.css, components.css, layout.css, animations.css, landing.css
```

### P2: Browser DevTools Setup
- Chrome/Firefox DevTools with CSS Grid inspector
- Lighthouse for performance auditing
- Color contrast checker extension (WCAG)

### P3: Review Existing Design Tokens
- Read `tokens.css` to understand current color palette
- Confirm current animation patterns in `animations.css`

---

## Overview

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|--------------|
| Day 1 | Design Token Audit + Extension | 4h | Extended tokens.css, color documentation |
| Day 2 | Typography + Spacing System | 4h | Typography scale, spacing utilities |
| Day 3 | Animation Library Foundation | 4h | animations-v2.css, micro-interactions |
| Day 4 | Dark Mode + Accessibility | 4h | Dark mode polish, WCAG compliance |
| Day 5 | Component Patterns + Documentation | 4h | Pattern library, hostile review prep |

**Buffer**: Built into each day for unexpected issues

---

## Day 1: Design Token Audit + Extension (4h)

### Objectives
Audit existing design tokens and extend for Student Playground needs.

### Deliverables

**File: `src/vl_jepa/api/static/tokens-v2.css`** (new extended tokens)

```css
/**
 * Lecture Mind - Extended Design Tokens v2.0
 *
 * Additions for Student Playground v0.4.0:
 * - Semantic learning colors (mastery levels)
 * - Flashcard-specific gradients
 * - Progress/achievement colors
 * - Extended shadow system for 3D effects
 */

/* ============================================
   SEMANTIC LEARNING COLORS
   ============================================ */
:root {
  /* Mastery Levels - Spaced Repetition */
  --color-mastery-new: #94a3b8;       /* Slate 400 - New cards */
  --color-mastery-learning: #f97316;  /* Orange 500 - Learning */
  --color-mastery-review: #eab308;    /* Yellow 500 - Review due */
  --color-mastery-known: #22c55e;     /* Green 500 - Known */
  --color-mastery-mastered: #06b6d4;  /* Cyan 500 - Mastered */

  /* Confusion Heatmap Gradient */
  --color-confusion-low: #22c55e;     /* Green - Clear */
  --color-confusion-medium: #eab308;  /* Yellow - Some confusion */
  --color-confusion-high: #f97316;    /* Orange - Confused */
  --color-confusion-critical: #ef4444; /* Red - Very confused */

  /* Quiz Feedback */
  --color-correct: #22c55e;
  --color-correct-bg: rgba(34, 197, 94, 0.12);
  --color-incorrect: #ef4444;
  --color-incorrect-bg: rgba(239, 68, 68, 0.12);
  --color-partial: #f59e0b;
  --color-partial-bg: rgba(245, 158, 11, 0.12);

  /* Progress/Achievement */
  --color-streak: #f59e0b;            /* Amber for streaks */
  --color-goal-complete: #22c55e;     /* Green for completed */
  --color-celebration: #8b5cf6;       /* Purple for celebrations */
}

/* Dark Mode Learning Colors */
.dark {
  --color-mastery-new: #64748b;
  --color-mastery-learning: #fb923c;
  --color-mastery-review: #facc15;
  --color-mastery-known: #4ade80;
  --color-mastery-mastered: #22d3ee;
}

/* ============================================
   FLASHCARD-SPECIFIC GRADIENTS
   ============================================ */
:root {
  /* Card Face Gradients */
  --gradient-card-front: linear-gradient(
    145deg,
    var(--surface) 0%,
    var(--background-subtle) 100%
  );
  --gradient-card-back: linear-gradient(
    145deg,
    var(--primary) 0%,
    var(--accent) 100%
  );
  --gradient-card-answer: linear-gradient(
    145deg,
    #10b981 0%,
    #06b6d4 100%
  );

  /* Swipe Direction Feedback */
  --gradient-swipe-left: linear-gradient(
    90deg,
    rgba(239, 68, 68, 0.2) 0%,
    transparent 50%
  );
  --gradient-swipe-right: linear-gradient(
    -90deg,
    rgba(34, 197, 94, 0.2) 0%,
    transparent 50%
  );
}

/* ============================================
   EXTENDED SHADOW SYSTEM (3D Effects)
   ============================================ */
:root {
  /* Elevation Levels (Material Design inspired) */
  --elevation-0: none;
  --elevation-1: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
  --elevation-2: 0 3px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.12);
  --elevation-3: 0 10px 20px rgba(0,0,0,0.15), 0 3px 6px rgba(0,0,0,0.10);
  --elevation-4: 0 15px 25px rgba(0,0,0,0.15), 0 5px 10px rgba(0,0,0,0.05);
  --elevation-5: 0 20px 40px rgba(0,0,0,0.2);

  /* 3D Card Shadows */
  --shadow-3d-idle:
    0 4px 6px -2px rgba(0,0,0,0.1),
    0 10px 15px -3px rgba(0,0,0,0.1);
  --shadow-3d-hover:
    0 10px 15px -3px rgba(0,0,0,0.15),
    0 20px 25px -5px rgba(0,0,0,0.1);
  --shadow-3d-active:
    0 4px 6px -2px rgba(0,0,0,0.15),
    0 8px 10px -3px rgba(0,0,0,0.1);

  /* Inset Shadows for Depth */
  --shadow-inset-sm: inset 0 1px 2px rgba(0,0,0,0.1);
  --shadow-inset-md: inset 0 2px 4px rgba(0,0,0,0.12);
  --shadow-inset-lg: inset 0 4px 8px rgba(0,0,0,0.15);
}

.dark {
  --elevation-1: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4);
  --elevation-2: 0 3px 6px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.3);
  --elevation-3: 0 10px 20px rgba(0,0,0,0.35), 0 3px 6px rgba(0,0,0,0.2);
  --elevation-4: 0 15px 25px rgba(0,0,0,0.35), 0 5px 10px rgba(0,0,0,0.15);
  --elevation-5: 0 20px 40px rgba(0,0,0,0.4);
}

/* ============================================
   FOCUS RING VARIANTS
   ============================================ */
:root {
  --ring-width: 2px;
  --ring-offset-width: 2px;
  --ring-success: var(--color-success-500);
  --ring-warning: var(--color-warning-500);
  --ring-error: var(--color-error-500);
}
```

**File: `docs/architecture/DESIGN_TOKENS.md`** (documentation)

```markdown
# Design Token Reference

## Color System

### Semantic Colors
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| --primary | #0891b2 | #22d3ee | Primary actions, links |
| --accent | #6366f1 | #818cf8 | Secondary highlights |
| --success | #10b981 | #34d399 | Success states |
| --warning | #f59e0b | #fbbf24 | Warning states |
| --error | #f43f5e | #fb7185 | Error states |

### Mastery Level Colors (NEW)
| Level | Color | Usage |
|-------|-------|-------|
| New | Slate 400 | Unseen flashcards |
| Learning | Orange 500 | Currently learning |
| Review | Yellow 500 | Due for review |
| Known | Green 500 | Well-known items |
| Mastered | Cyan 500 | Fully mastered |

### Confusion Heatmap
| Level | Color | Threshold |
|-------|-------|-----------|
| Low | Green | 0-25% confusion votes |
| Medium | Yellow | 26-50% confusion votes |
| High | Orange | 51-75% confusion votes |
| Critical | Red | 76-100% confusion votes |
```

### Acceptance Criteria
- [ ] All new color tokens have WCAG AA contrast ratio (4.5:1 for text)
- [ ] Mastery colors distinguishable for color-blind users (use colorblindly.com)
- [ ] Dark mode variants tested in actual dark mode
- [ ] Token naming follows BEM-like convention (--category-variant-property)
- [ ] No duplicate token names with existing tokens.css

### Quality Metrics
- Token count: +25-35 new tokens
- Documentation: 100% of new tokens documented
- Contrast validation: All text colors pass WCAG AA

---

## Day 2: Typography + Spacing System (4h)

### Objectives
Enhance typography scale and create utility spacing classes for Student Playground components.

### Deliverables

**Updates to `tokens.css`** (typography extensions)

```css
/* ============================================
   EXTENDED TYPOGRAPHY SCALE
   ============================================ */
:root {
  /* Display Sizes (for hero/celebration screens) */
  --text-6xl: 3.75rem;    /* 60px */
  --text-7xl: 4.5rem;     /* 72px */
  --text-8xl: 6rem;       /* 96px */

  /* Fluid Typography (clamp-based) */
  --text-fluid-sm: clamp(0.875rem, 0.8rem + 0.25vw, 1rem);
  --text-fluid-base: clamp(1rem, 0.9rem + 0.35vw, 1.125rem);
  --text-fluid-lg: clamp(1.125rem, 1rem + 0.5vw, 1.5rem);
  --text-fluid-xl: clamp(1.5rem, 1.25rem + 1vw, 2.25rem);
  --text-fluid-2xl: clamp(2rem, 1.5rem + 2vw, 3rem);

  /* Flashcard-specific Typography */
  --text-card-question: var(--text-lg);
  --text-card-answer: var(--text-base);
  --text-card-hint: var(--text-sm);

  /* Quiz Typography */
  --text-quiz-question: var(--text-xl);
  --text-quiz-option: var(--text-base);
  --text-quiz-score: var(--text-4xl);
}

/* ============================================
   SPACING UTILITIES
   ============================================ */
:root {
  /* Section Spacing */
  --section-gap: var(--space-16);
  --section-padding: var(--space-12);

  /* Card Spacing */
  --card-gap: var(--space-4);
  --card-padding-sm: var(--space-3);
  --card-padding-md: var(--space-4);
  --card-padding-lg: var(--space-6);

  /* Grid Gaps */
  --grid-gap-tight: var(--space-2);
  --grid-gap-normal: var(--space-4);
  --grid-gap-loose: var(--space-6);
  --grid-gap-xl: var(--space-8);
}
```

**File: `src/vl_jepa/api/static/utilities.css`** (new utility classes)

```css
/**
 * Lecture Mind - Utility Classes
 *
 * Atomic utility classes for rapid prototyping
 * Inspired by Tailwind but scoped to project needs
 */

/* ============================================
   SPACING UTILITIES
   ============================================ */

/* Margin utilities */
.m-0 { margin: 0; }
.m-1 { margin: var(--space-1); }
.m-2 { margin: var(--space-2); }
.m-3 { margin: var(--space-3); }
.m-4 { margin: var(--space-4); }
.m-6 { margin: var(--space-6); }
.m-8 { margin: var(--space-8); }

.mt-0 { margin-top: 0; }
.mt-1 { margin-top: var(--space-1); }
.mt-2 { margin-top: var(--space-2); }
.mt-3 { margin-top: var(--space-3); }
.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }
.mt-8 { margin-top: var(--space-8); }

.mb-0 { margin-bottom: 0; }
.mb-1 { margin-bottom: var(--space-1); }
.mb-2 { margin-bottom: var(--space-2); }
.mb-3 { margin-bottom: var(--space-3); }
.mb-4 { margin-bottom: var(--space-4); }
.mb-6 { margin-bottom: var(--space-6); }
.mb-8 { margin-bottom: var(--space-8); }

.ml-0 { margin-left: 0; }
.ml-1 { margin-left: var(--space-1); }
.ml-2 { margin-left: var(--space-2); }
.ml-3 { margin-left: var(--space-3); }
.ml-4 { margin-left: var(--space-4); }
.ml-auto { margin-left: auto; }

.mr-0 { margin-right: 0; }
.mr-1 { margin-right: var(--space-1); }
.mr-2 { margin-right: var(--space-2); }
.mr-3 { margin-right: var(--space-3); }
.mr-4 { margin-right: var(--space-4); }
.mr-auto { margin-right: auto; }

.mx-auto { margin-left: auto; margin-right: auto; }
.my-0 { margin-top: 0; margin-bottom: 0; }
.my-4 { margin-top: var(--space-4); margin-bottom: var(--space-4); }
.my-8 { margin-top: var(--space-8); margin-bottom: var(--space-8); }

/* Padding utilities */
.p-0 { padding: 0; }
.p-1 { padding: var(--space-1); }
.p-2 { padding: var(--space-2); }
.p-3 { padding: var(--space-3); }
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }
.p-8 { padding: var(--space-8); }

.pt-0 { padding-top: 0; }
.pt-2 { padding-top: var(--space-2); }
.pt-4 { padding-top: var(--space-4); }
.pt-6 { padding-top: var(--space-6); }

.pb-0 { padding-bottom: 0; }
.pb-2 { padding-bottom: var(--space-2); }
.pb-4 { padding-bottom: var(--space-4); }
.pb-6 { padding-bottom: var(--space-6); }

.px-2 { padding-left: var(--space-2); padding-right: var(--space-2); }
.px-4 { padding-left: var(--space-4); padding-right: var(--space-4); }
.px-6 { padding-left: var(--space-6); padding-right: var(--space-6); }

.py-2 { padding-top: var(--space-2); padding-bottom: var(--space-2); }
.py-4 { padding-top: var(--space-4); padding-bottom: var(--space-4); }
.py-6 { padding-top: var(--space-6); padding-bottom: var(--space-6); }

/* Gap utilities (for flex/grid) */
.gap-0 { gap: 0; }
.gap-1 { gap: var(--space-1); }
.gap-2 { gap: var(--space-2); }
.gap-3 { gap: var(--space-3); }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }
.gap-8 { gap: var(--space-8); }

/* ============================================
   TYPOGRAPHY UTILITIES
   ============================================ */
.text-xs { font-size: var(--text-xs); }
.text-sm { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg { font-size: var(--text-lg); }
.text-xl { font-size: var(--text-xl); }
.text-2xl { font-size: var(--text-2xl); }
.text-3xl { font-size: var(--text-3xl); }
.text-4xl { font-size: var(--text-4xl); }

.font-normal { font-weight: var(--font-normal); }
.font-medium { font-weight: var(--font-medium); }
.font-semibold { font-weight: var(--font-semibold); }
.font-bold { font-weight: var(--font-bold); }

.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

.leading-none { line-height: var(--leading-none); }
.leading-tight { line-height: var(--leading-tight); }
.leading-normal { line-height: var(--leading-normal); }
.leading-relaxed { line-height: var(--leading-relaxed); }

.tracking-tight { letter-spacing: var(--tracking-tight); }
.tracking-normal { letter-spacing: var(--tracking-normal); }
.tracking-wide { letter-spacing: var(--tracking-wide); }

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ============================================
   FLEXBOX UTILITIES
   ============================================ */
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.flex-wrap { flex-wrap: wrap; }
.flex-nowrap { flex-wrap: nowrap; }

.items-start { align-items: flex-start; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }
.items-stretch { align-items: stretch; }

.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }

.flex-1 { flex: 1 1 0%; }
.flex-auto { flex: 1 1 auto; }
.flex-none { flex: none; }
.flex-shrink-0 { flex-shrink: 0; }
.flex-grow { flex-grow: 1; }

/* ============================================
   GRID UTILITIES
   ============================================ */
.grid { display: grid; }
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.col-span-1 { grid-column: span 1 / span 1; }
.col-span-2 { grid-column: span 2 / span 2; }
.col-span-full { grid-column: 1 / -1; }

/* ============================================
   SIZE UTILITIES
   ============================================ */
.w-full { width: 100%; }
.w-auto { width: auto; }
.w-fit { width: fit-content; }
.max-w-sm { max-width: 24rem; }
.max-w-md { max-width: 28rem; }
.max-w-lg { max-width: 32rem; }
.max-w-xl { max-width: 36rem; }
.max-w-2xl { max-width: 42rem; }
.max-w-full { max-width: 100%; }

.h-full { height: 100%; }
.h-auto { height: auto; }
.h-screen { height: 100vh; }
.min-h-screen { min-height: 100vh; }

/* ============================================
   VISIBILITY UTILITIES
   ============================================ */
.visible { visibility: visible; }
.invisible { visibility: hidden; }
.opacity-0 { opacity: 0; }
.opacity-50 { opacity: 0.5; }
.opacity-100 { opacity: 1; }

/* ============================================
   POSITION UTILITIES
   ============================================ */
.relative { position: relative; }
.absolute { position: absolute; }
.fixed { position: fixed; }
.sticky { position: sticky; }

.inset-0 { inset: 0; }
.top-0 { top: 0; }
.right-0 { right: 0; }
.bottom-0 { bottom: 0; }
.left-0 { left: 0; }

/* ============================================
   BORDER UTILITIES
   ============================================ */
.border { border: 1px solid var(--border); }
.border-0 { border: 0; }
.border-t { border-top: 1px solid var(--border); }
.border-b { border-bottom: 1px solid var(--border); }
.border-l { border-left: 1px solid var(--border); }
.border-r { border-right: 1px solid var(--border); }

.rounded-none { border-radius: 0; }
.rounded-sm { border-radius: var(--radius-sm); }
.rounded { border-radius: var(--radius-md); }
.rounded-lg { border-radius: var(--radius-lg); }
.rounded-xl { border-radius: var(--radius-xl); }
.rounded-2xl { border-radius: var(--radius-2xl); }
.rounded-full { border-radius: var(--radius-full); }

/* ============================================
   COLOR UTILITIES
   ============================================ */
.bg-surface { background-color: var(--surface); }
.bg-subtle { background-color: var(--background-subtle); }
.bg-primary { background-color: var(--primary); }
.bg-success { background-color: var(--success); }
.bg-warning { background-color: var(--warning); }
.bg-error { background-color: var(--error); }

.text-foreground { color: var(--foreground); }
.text-muted { color: var(--foreground-muted); }
.text-primary { color: var(--primary); }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }
.text-error { color: var(--error); }

/* ============================================
   CURSOR UTILITIES
   ============================================ */
.cursor-pointer { cursor: pointer; }
.cursor-not-allowed { cursor: not-allowed; }
.cursor-grab { cursor: grab; }
.cursor-grabbing { cursor: grabbing; }

/* ============================================
   OVERFLOW UTILITIES
   ============================================ */
.overflow-hidden { overflow: hidden; }
.overflow-auto { overflow: auto; }
.overflow-scroll { overflow: scroll; }
.overflow-x-auto { overflow-x: auto; }
.overflow-y-auto { overflow-y: auto; }

/* ============================================
   POINTER EVENTS
   ============================================ */
.pointer-events-none { pointer-events: none; }
.pointer-events-auto { pointer-events: auto; }

/* ============================================
   USER SELECT
   ============================================ */
.select-none { user-select: none; }
.select-text { user-select: text; }
.select-all { user-select: all; }
```

### Acceptance Criteria
- [ ] Fluid typography scales correctly from 320px to 1920px viewport
- [ ] All spacing utilities use design token values (not magic numbers)
- [ ] Utility class names follow consistent naming convention
- [ ] No naming conflicts with existing component classes
- [ ] File size of utilities.css < 10KB (minified)

### Quality Metrics
- Utility class count: 150-200 classes
- Coverage: Spacing, typography, flexbox, grid, colors
- File size target: < 15KB unminified

---

## Day 3: Animation Library Foundation (4h)

### Objectives
Create comprehensive animation library for Student Playground micro-interactions.

### Deliverables

**File: `src/vl_jepa/api/static/animations-v2.css`** (extended animations)

```css
/**
 * Lecture Mind - Animation Library v2.0
 *
 * Extended animations for Student Playground:
 * - Flashcard flip/swipe
 * - Quiz feedback
 * - Progress celebrations
 * - Micro-interactions
 *
 * CRITICAL: All animations respect prefers-reduced-motion
 */

/* ============================================
   TIMING TOKENS (Extended)
   ============================================ */
:root {
  /* Micro-interaction Timings */
  --timing-instant: 0ms;
  --timing-quick: 100ms;
  --timing-normal: 200ms;
  --timing-moderate: 300ms;
  --timing-slow: 400ms;
  --timing-slower: 600ms;
  --timing-deliberate: 800ms;

  /* Spring Physics (Extended) */
  --spring-wobbly: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --spring-stiff: cubic-bezier(0.5, 1.8, 0.5, 0.8);
  --spring-gentle: cubic-bezier(0.34, 1.2, 0.64, 1);
  --spring-elastic: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* ============================================
   FLASHCARD ANIMATIONS
   ============================================ */

/* 3D Flip Effect */
.flashcard-flip-container {
  perspective: 1200px;
  perspective-origin: center;
}

.flashcard-flip {
  transform-style: preserve-3d;
  transition: transform var(--timing-slow) var(--spring-gentle);
}

.flashcard-flip.flipped {
  transform: rotateY(180deg);
}

.flashcard-face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flashcard-back {
  transform: rotateY(180deg);
}

/* Swipe Animations */
@keyframes swipeOutLeft {
  0% {
    transform: translateX(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateX(-150%) rotate(-20deg);
    opacity: 0;
  }
}

@keyframes swipeOutRight {
  0% {
    transform: translateX(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateX(150%) rotate(20deg);
    opacity: 0;
  }
}

@keyframes swipeInFromRight {
  0% {
    transform: translateX(100%) rotate(10deg);
    opacity: 0;
  }
  100% {
    transform: translateX(0) rotate(0deg);
    opacity: 1;
  }
}

.animate-swipe-left {
  animation: swipeOutLeft var(--timing-moderate) var(--spring-gentle) forwards;
}

.animate-swipe-right {
  animation: swipeOutRight var(--timing-moderate) var(--spring-gentle) forwards;
}

.animate-card-enter {
  animation: swipeInFromRight var(--timing-moderate) var(--spring-wobbly) forwards;
}

/* Card Shake (wrong answer feedback) */
@keyframes cardShake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.animate-shake {
  animation: cardShake var(--timing-slow) ease-in-out;
}

/* ============================================
   QUIZ FEEDBACK ANIMATIONS
   ============================================ */

/* Correct Answer Celebration */
@keyframes correctPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 0 15px rgba(34, 197, 94, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

.animate-correct {
  animation: correctPulse var(--timing-slow) ease-out;
}

/* Wrong Answer Shake */
@keyframes wrongShake {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-8px) rotate(-1deg); }
  20% { transform: translateX(8px) rotate(1deg); }
  30% { transform: translateX(-8px) rotate(-1deg); }
  40% { transform: translateX(8px) rotate(1deg); }
  50% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

.animate-wrong {
  animation: wrongShake var(--timing-slow) ease-in-out;
}

/* Option Select Bounce */
@keyframes optionSelect {
  0% { transform: scale(1); }
  50% { transform: scale(0.97); }
  100% { transform: scale(1); }
}

.animate-option-select {
  animation: optionSelect var(--timing-quick) var(--spring-stiff);
}

/* Score Counter Animation */
@keyframes scoreCount {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-score {
  animation: scoreCount var(--timing-moderate) var(--spring-wobbly);
}

/* ============================================
   PROGRESS ANIMATIONS
   ============================================ */

/* Progress Bar Fill */
@keyframes progressFill {
  from { width: var(--progress-from, 0%); }
  to { width: var(--progress-to, 100%); }
}

.animate-progress {
  animation: progressFill var(--timing-deliberate) var(--spring-gentle) forwards;
}

/* Streak Counter */
@keyframes streakPop {
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.2) rotate(10deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

.animate-streak {
  animation: streakPop var(--timing-slow) var(--spring-elastic);
}

/* Checkmark Draw */
@keyframes checkmarkDraw {
  0% {
    stroke-dashoffset: 100;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

.animate-checkmark path {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: checkmarkDraw var(--timing-moderate) ease-out forwards;
  animation-delay: var(--timing-quick);
}

/* ============================================
   CELEBRATION ANIMATIONS
   ============================================ */

/* Confetti Particle */
@keyframes confettiFall {
  0% {
    transform: translateY(-100vh) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

.confetti-particle {
  position: fixed;
  width: 10px;
  height: 10px;
  pointer-events: none;
  animation: confettiFall 3s linear forwards;
}

/* Star Burst */
@keyframes starBurst {
  0% {
    transform: scale(0) rotate(0deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.5) rotate(180deg);
    opacity: 1;
  }
  100% {
    transform: scale(0) rotate(360deg);
    opacity: 0;
  }
}

.animate-star-burst {
  animation: starBurst var(--timing-deliberate) var(--spring-elastic);
}

/* Trophy Reveal */
@keyframes trophyReveal {
  0% {
    transform: translateY(50px) scale(0.5);
    opacity: 0;
  }
  60% {
    transform: translateY(-10px) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.animate-trophy {
  animation: trophyReveal var(--timing-slower) var(--spring-wobbly);
}

/* ============================================
   MICRO-INTERACTIONS
   ============================================ */

/* Button Press */
.btn-press {
  transition: transform var(--timing-instant) ease;
}

.btn-press:active {
  transform: scale(0.96);
}

/* Icon Bounce */
@keyframes iconBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.hover-bounce:hover {
  animation: iconBounce var(--timing-moderate) var(--spring-gentle);
}

/* Focus Ring Animation */
@keyframes focusRing {
  0% {
    box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.5);
  }
  100% {
    box-shadow: 0 0 0 4px rgba(6, 182, 212, 0);
  }
}

.animate-focus-ring {
  animation: focusRing var(--timing-slow) ease-out;
}

/* Loading Dots */
@keyframes loadingDot {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.loading-dots span {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin: 0 2px;
  background: var(--primary);
  border-radius: 50%;
  animation: loadingDot 1.4s infinite ease-in-out;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }
.loading-dots span:nth-child(3) { animation-delay: 0s; }

/* Tooltip Appear */
@keyframes tooltipAppear {
  0% {
    opacity: 0;
    transform: translateY(5px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-tooltip {
  animation: tooltipAppear var(--timing-quick) var(--spring-gentle);
}

/* ============================================
   PAGE TRANSITIONS
   ============================================ */

/* Fade Slide */
@keyframes fadeSlideIn {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeSlideOut {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-20px);
  }
}

.page-enter {
  animation: fadeSlideIn var(--timing-moderate) var(--spring-gentle);
}

.page-exit {
  animation: fadeSlideOut var(--timing-moderate) ease-in;
}

/* View Transition (native) */
@supports (view-transition-name: none) {
  ::view-transition-old(page-content) {
    animation: fadeSlideOut var(--timing-moderate) ease-in;
  }

  ::view-transition-new(page-content) {
    animation: fadeSlideIn var(--timing-moderate) var(--spring-gentle);
  }
}

/* ============================================
   REDUCED MOTION OVERRIDES
   ============================================ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .flashcard-flip {
    transition: none;
  }

  .flashcard-flip.flipped {
    transform: none;
    /* Use opacity instead for reduced motion */
    opacity: 1;
  }

  .flashcard-flip.flipped .flashcard-front {
    display: none;
  }

  .flashcard-flip.flipped .flashcard-back {
    transform: none;
    display: block;
  }

  /* Disable particle animations */
  .confetti-particle {
    display: none;
  }

  /* Simplify all spring animations */
  [class*="animate-"] {
    animation: none !important;
    transition: none !important;
  }
}

/* ============================================
   ANIMATION UTILITY CLASSES
   ============================================ */

/* Delay utilities */
.delay-75 { animation-delay: 75ms; }
.delay-100 { animation-delay: 100ms; }
.delay-150 { animation-delay: 150ms; }
.delay-200 { animation-delay: 200ms; }
.delay-300 { animation-delay: 300ms; }
.delay-500 { animation-delay: 500ms; }
.delay-700 { animation-delay: 700ms; }
.delay-1000 { animation-delay: 1000ms; }

/* Duration utilities */
.duration-75 { animation-duration: 75ms; }
.duration-100 { animation-duration: 100ms; }
.duration-150 { animation-duration: 150ms; }
.duration-200 { animation-duration: 200ms; }
.duration-300 { animation-duration: 300ms; }
.duration-500 { animation-duration: 500ms; }
.duration-700 { animation-duration: 700ms; }
.duration-1000 { animation-duration: 1000ms; }

/* Iteration utilities */
.animate-once { animation-iteration-count: 1; }
.animate-twice { animation-iteration-count: 2; }
.animate-infinite { animation-iteration-count: infinite; }

/* Fill mode utilities */
.animate-fill-forwards { animation-fill-mode: forwards; }
.animate-fill-backwards { animation-fill-mode: backwards; }
.animate-fill-both { animation-fill-mode: both; }

/* Play state utilities */
.animate-running { animation-play-state: running; }
.animate-paused { animation-play-state: paused; }
```

### Acceptance Criteria
- [ ] All animations achieve 60fps (test with Chrome DevTools Performance)
- [ ] Flashcard flip completes in <500ms
- [ ] prefers-reduced-motion stops ALL animations
- [ ] No janky animations on Safari (test -webkit-backface-visibility)
- [ ] Animation file size < 15KB (minified)

### Quality Metrics
- Animation count: 20-30 distinct animations
- Performance: 60fps target
- Reduced motion: 100% coverage

---

## Day 4: Dark Mode + Accessibility (4h)

### Objectives
Polish dark mode implementation and ensure WCAG 2.1 AA compliance.

### Deliverables

**Updates to `tokens.css`** (dark mode improvements)

```css
/* ============================================
   DARK MODE ENHANCEMENTS
   ============================================ */
.dark {
  /* Improved contrast for text */
  --foreground: #f8fafc;                 /* Slate 50 */
  --foreground-muted: #94a3b8;           /* Slate 400 - 5.5:1 contrast */
  --foreground-subtle: #64748b;          /* Slate 500 - 4.5:1 contrast */

  /* Enhanced surface hierarchy */
  --surface: #0f172a;                    /* Slate 900 */
  --surface-raised: #1e293b;             /* Slate 800 */
  --surface-overlay: rgba(15, 23, 42, 0.95);

  /* Improved border visibility */
  --border: #334155;                     /* Slate 700 */
  --border-subtle: #1e293b;              /* Slate 800 */
  --border-strong: #475569;              /* Slate 600 */

  /* Adjusted semantic colors for dark mode */
  --success: #4ade80;                    /* Green 400 */
  --success-bg: rgba(74, 222, 128, 0.15);
  --warning: #facc15;                    /* Yellow 400 */
  --warning-bg: rgba(250, 204, 21, 0.15);
  --error: #fb7185;                      /* Rose 400 */
  --error-bg: rgba(251, 113, 133, 0.15);

  /* Focus rings with better visibility */
  --ring: #38bdf8;                       /* Sky 400 - high visibility */
  --ring-offset: var(--surface);

  /* Enhanced glow effects */
  --glow-primary: rgba(56, 189, 248, 0.2);
  --glow-accent: rgba(167, 139, 250, 0.2);
  --glow-success: rgba(74, 222, 128, 0.2);
}

/* Color scheme declaration */
:root {
  color-scheme: light;
}

.dark {
  color-scheme: dark;
}
```

**File: `src/vl_jepa/api/static/accessibility.css`** (new)

```css
/**
 * Lecture Mind - Accessibility Styles
 *
 * WCAG 2.1 AA Compliance
 * - Focus management
 * - High contrast mode
 * - Screen reader utilities
 * - Reduced motion
 */

/* ============================================
   FOCUS MANAGEMENT
   ============================================ */

/* Default focus style */
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Remove outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* Enhanced focus for interactive elements */
.btn:focus-visible,
.card:focus-visible,
.input:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--glow-primary);
}

/* Skip link styling */
.skip-link {
  position: absolute;
  top: -100%;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-tooltip);
  padding: var(--space-3) var(--space-6);
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: var(--radius-lg);
  font-weight: var(--font-semibold);
  text-decoration: none;
  transition: top var(--timing-normal) ease;
}

.skip-link:focus {
  top: var(--space-4);
}

/* ============================================
   SCREEN READER UTILITIES
   ============================================ */

/* Visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Visible on focus (for skip links) */
.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}

/* Not for screen readers (decorative) */
.aria-hidden {
  aria-hidden: true;
}

/* ============================================
   HIGH CONTRAST MODE
   ============================================ */
@media (prefers-contrast: high) {
  :root {
    --border: #000000;
    --foreground-muted: #000000;
  }

  .dark {
    --border: #ffffff;
    --foreground-muted: #ffffff;
  }

  /* Force high contrast borders */
  .card,
  .btn,
  .input,
  .badge {
    border-width: 2px;
  }

  /* Force solid backgrounds */
  .surface-overlay {
    background: var(--surface);
  }
}

/* ============================================
   FORCED COLORS MODE (Windows High Contrast)
   ============================================ */
@media (forced-colors: active) {
  .btn {
    border: 2px solid currentColor;
  }

  .card {
    border: 2px solid CanvasText;
  }

  .input {
    border: 2px solid CanvasText;
  }

  /* Ensure focus is visible */
  :focus-visible {
    outline: 3px solid Highlight;
    outline-offset: 2px;
  }
}

/* ============================================
   REDUCED MOTION PREFERENCES
   ============================================ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Disable parallax effects */
  .parallax-layer {
    transform: none !important;
  }

  /* Disable hover transforms */
  .hover-lift:hover,
  .card:hover,
  .btn:hover {
    transform: none;
  }

  /* Simple opacity transitions only */
  .fade-transition {
    transition: opacity 0.1ms linear;
  }
}

/* ============================================
   TOUCH TARGET SIZES
   ============================================ */

/* Ensure 44x44px minimum touch targets */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

/* Add touch padding without visual change */
.touch-target-padding {
  position: relative;
}

.touch-target-padding::after {
  content: '';
  position: absolute;
  inset: -8px;
}

/* ============================================
   TEXT RESIZING SUPPORT
   ============================================ */

/* Ensure text can scale to 200% */
html {
  font-size: 100%; /* Respect user's browser setting */
}

/* Prevent layout breaking on zoom */
.text-container {
  max-width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
  hyphens: auto;
}

/* ============================================
   LINK STYLING
   ============================================ */

/* Links must be distinguishable from text */
a:not(.btn):not(.card) {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

a:not(.btn):not(.card):hover {
  text-decoration-thickness: 2px;
}

/* ============================================
   FORM ACCESSIBILITY
   ============================================ */

/* Error state indication */
.input[aria-invalid="true"] {
  border-color: var(--error);
  box-shadow: 0 0 0 3px var(--error-bg);
}

/* Required field indication */
.label[data-required="true"]::after {
  content: ' *';
  color: var(--error);
}

/* Error message styling */
.error-message {
  color: var(--error);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}

.error-message::before {
  content: '\26A0 '; /* Warning symbol */
}

/* ============================================
   LIVE REGION ANNOUNCEMENTS
   ============================================ */

/* For dynamic content updates */
.live-region {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Status messages */
[role="status"],
[role="alert"] {
  /* Ensure screen readers announce these */
}

/* ============================================
   KEYBOARD NAVIGATION HELPERS
   ============================================ */

/* Show keyboard nav hint */
.keyboard-nav-active .keyboard-hint {
  display: block;
}

.keyboard-hint {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-1) var(--space-2);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  white-space: nowrap;
  z-index: var(--z-tooltip);
}
```

### Acceptance Criteria
- [ ] All text passes WCAG AA contrast (4.5:1 for normal, 3:1 for large)
- [ ] Focus indicators visible with 3:1 contrast
- [ ] Skip link functional on keyboard navigation
- [ ] High contrast mode tested (Windows)
- [ ] Forced colors mode does not break layout
- [ ] Touch targets meet 44x44px minimum
- [ ] Text scales to 200% without breaking layout

### Quality Metrics
- Lighthouse Accessibility score: >= 95
- Color contrast: 100% of text passes WCAG AA
- Focus visibility: All interactive elements have visible focus

---

## Day 5: Component Patterns + Documentation (4h)

### Objectives
Create reusable component patterns and prepare for hostile review.

### Deliverables

**File: `src/vl_jepa/api/static/playground-components.css`** (new)

```css
/**
 * Lecture Mind - Student Playground Component Patterns
 *
 * Reusable patterns for v0.4.0 features:
 * - Flashcard components
 * - Quiz components
 * - Progress indicators
 * - Library cards
 * - Dashboard widgets
 */

/* ============================================
   FLASHCARD PATTERN
   ============================================ */

.flashcard-deck {
  position: relative;
  width: 100%;
  max-width: 400px;
  aspect-ratio: 3 / 2;
  margin: 0 auto;
}

.flashcard {
  position: absolute;
  inset: 0;
  cursor: pointer;
  transform-style: preserve-3d;
  transition: transform var(--timing-slow) var(--spring-gentle);
}

/* Deck stack effect */
.flashcard:nth-child(1) { z-index: 3; }
.flashcard:nth-child(2) {
  z-index: 2;
  transform: translateY(4px) scale(0.98);
  opacity: 0.8;
}
.flashcard:nth-child(3) {
  z-index: 1;
  transform: translateY(8px) scale(0.96);
  opacity: 0.6;
}

.flashcard__face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-3d-idle);
  backface-visibility: hidden;
}

.flashcard__face--front {
  background: var(--gradient-card-front);
}

.flashcard__face--back {
  background: var(--gradient-card-back);
  color: var(--primary-foreground);
  transform: rotateY(180deg);
}

.flashcard.is-flipped {
  transform: rotateY(180deg);
}

.flashcard__label {
  position: absolute;
  top: var(--space-3);
  left: var(--space-4);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  opacity: 0.6;
}

.flashcard__content {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  text-align: center;
  line-height: var(--leading-relaxed);
}

.flashcard__hint {
  position: absolute;
  bottom: var(--space-3);
  font-size: var(--text-xs);
  color: var(--foreground-muted);
}

/* Mastery indicator */
.flashcard__mastery {
  position: absolute;
  top: var(--space-3);
  right: var(--space-4);
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
}

.flashcard__mastery--new { background: var(--color-mastery-new); }
.flashcard__mastery--learning { background: var(--color-mastery-learning); }
.flashcard__mastery--review { background: var(--color-mastery-review); }
.flashcard__mastery--known { background: var(--color-mastery-known); }
.flashcard__mastery--mastered { background: var(--color-mastery-mastered); }

/* ============================================
   QUIZ PATTERN
   ============================================ */

.quiz {
  max-width: 600px;
  margin: 0 auto;
}

.quiz__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.quiz__progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.quiz__progress-bar {
  width: 100px;
  height: 6px;
  background: var(--background-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.quiz__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  border-radius: var(--radius-full);
  transition: width var(--timing-moderate) var(--spring-gentle);
}

.quiz__progress-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--foreground-muted);
}

.quiz__body {
  padding: var(--space-6);
}

.quiz__question {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-6);
}

.quiz__options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.quiz__option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all var(--timing-normal) var(--spring-gentle);
}

.quiz__option:hover {
  border-color: var(--primary);
  background: var(--background-subtle);
}

.quiz__option.is-selected {
  border-color: var(--primary);
  background: var(--glow-primary);
}

.quiz__option.is-correct {
  border-color: var(--success);
  background: var(--success-bg);
}

.quiz__option.is-incorrect {
  border-color: var(--error);
  background: var(--error-bg);
}

.quiz__option-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--background-subtle);
  border-radius: var(--radius-full);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.quiz__option.is-selected .quiz__option-marker {
  background: var(--primary);
  color: var(--primary-foreground);
}

.quiz__option-text {
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

.quiz__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-top: 1px solid var(--border);
  background: var(--background-subtle);
}

/* ============================================
   PROGRESS RING PATTERN
   ============================================ */

.progress-ring {
  position: relative;
  width: 120px;
  height: 120px;
}

.progress-ring__svg {
  transform: rotate(-90deg);
}

.progress-ring__track {
  fill: none;
  stroke: var(--background-subtle);
  stroke-width: 8;
}

.progress-ring__fill {
  fill: none;
  stroke: var(--primary);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: var(--circumference, 283);
  stroke-dashoffset: var(--offset, 283);
  transition: stroke-dashoffset var(--timing-deliberate) var(--spring-gentle);
}

.progress-ring__value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.progress-ring__percent {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
}

.progress-ring__label {
  font-size: var(--text-xs);
  color: var(--foreground-muted);
}

/* ============================================
   LIBRARY CARD PATTERN
   ============================================ */

.library-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: all var(--timing-normal) var(--spring-gentle);
  cursor: pointer;
}

.library-card:hover {
  border-color: var(--border-focus);
  box-shadow: var(--elevation-3);
  transform: translateY(-2px);
}

.library-card__thumbnail {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--background-subtle);
  overflow: hidden;
}

.library-card__thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.library-card__duration {
  position: absolute;
  bottom: var(--space-2);
  right: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-sm);
}

.library-card__progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(0, 0, 0, 0.3);
}

.library-card__progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width var(--timing-normal) ease;
}

.library-card__body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.library-card__title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.library-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--foreground-muted);
}

.library-card__date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* ============================================
   DASHBOARD WIDGET PATTERN
   ============================================ */

.widget {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.widget__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.widget__title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.widget__action {
  font-size: var(--text-sm);
  color: var(--primary);
  cursor: pointer;
}

.widget__body {
  padding: var(--space-4);
}

.widget__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border);
  background: var(--background-subtle);
}

/* Stat widget variant */
.widget--stat .widget__value {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  line-height: 1;
}

.widget--stat .widget__change {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-top: var(--space-2);
}

.widget--stat .widget__change--positive {
  color: var(--success);
}

.widget--stat .widget__change--negative {
  color: var(--error);
}

/* ============================================
   STREAK COUNTER PATTERN
   ============================================ */

.streak {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(234, 179, 8, 0.1));
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-xl);
}

.streak__icon {
  font-size: var(--text-2xl);
}

.streak__info {
  display: flex;
  flex-direction: column;
}

.streak__count {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--color-streak);
}

.streak__label {
  font-size: var(--text-xs);
  color: var(--foreground-muted);
}

/* ============================================
   CONFUSION HEATMAP PATTERN
   ============================================ */

.heatmap {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-4);
}

.heatmap__segment {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform var(--timing-quick) ease;
}

.heatmap__segment:hover {
  transform: scaleY(1.5);
}

.heatmap__segment--low { background: var(--color-confusion-low); }
.heatmap__segment--medium { background: var(--color-confusion-medium); }
.heatmap__segment--high { background: var(--color-confusion-high); }
.heatmap__segment--critical { background: var(--color-confusion-critical); }
```

**File: `docs/architecture/DESIGN_PATTERNS.md`** (documentation)

```markdown
# Design Patterns Reference

## Component Pattern Structure

All Student Playground components follow BEM-like naming:

```
.component
.component__element
.component__element--modifier
.component.is-state
```

## Pattern Inventory

### Flashcard
- `.flashcard-deck` - Container for card stack
- `.flashcard` - Individual card with 3D flip
- `.flashcard__face` - Card faces (front/back)
- `.flashcard__mastery` - Spaced repetition indicator

### Quiz
- `.quiz` - Quiz container
- `.quiz__option` - Answer option with states
- `.quiz__progress` - Progress indicator

### Progress Ring
- `.progress-ring` - Circular progress SVG
- Uses CSS custom properties for dynamic values

### Library Card
- `.library-card` - Lecture thumbnail card
- Built-in progress bar and hover effects

### Dashboard Widget
- `.widget` - Generic dashboard widget
- `.widget--stat` - Stat variant

## State Classes

| Class | Usage |
|-------|-------|
| `.is-flipped` | Flashcard is showing back |
| `.is-selected` | Option is selected |
| `.is-correct` | Correct answer revealed |
| `.is-incorrect` | Wrong answer revealed |
| `.is-loading` | Loading state |
| `.is-disabled` | Disabled state |

## Animation Classes

See `animations-v2.css` for available animation utilities.
```

### Acceptance Criteria
- [ ] All patterns use design tokens (no hardcoded values)
- [ ] BEM naming convention followed consistently
- [ ] State classes (is-*) documented
- [ ] Responsive behavior defined for each pattern
- [ ] Patterns tested in light and dark mode

### Quality Metrics
- Pattern count: 6-8 reusable patterns
- CSS specificity: All patterns <= 0,2,0
- Documentation: 100% of patterns documented

---

## Quality Gates

### Pre-Hostile Review Checklist (End of Day 5)
- [ ] All new CSS files pass `ruff format` style checks (via prettier or stylelint)
- [ ] No CSS errors in browser DevTools console
- [ ] Lighthouse Accessibility score >= 95
- [ ] Lighthouse Performance score >= 90
- [ ] All color tokens pass WCAG AA contrast
- [ ] prefers-reduced-motion tested and functional
- [ ] Dark mode tested on all new components
- [ ] File size budget met (< 50KB total new CSS)

### Verification Commands
```bash
# Check file sizes
wc -c src/vl_jepa/api/static/*.css

# Validate CSS syntax (via stylelint if installed)
npx stylelint "src/vl_jepa/api/static/*.css"

# Run Lighthouse (requires Chrome)
# Open Chrome DevTools > Lighthouse > Accessibility + Performance
```

---

## Files Created/Modified Summary

### New Files
| File | Purpose | Day |
|------|---------|-----|
| `src/vl_jepa/api/static/tokens-v2.css` | Extended design tokens | Day 1 |
| `src/vl_jepa/api/static/utilities.css` | Utility classes | Day 2 |
| `src/vl_jepa/api/static/animations-v2.css` | Animation library | Day 3 |
| `src/vl_jepa/api/static/accessibility.css` | A11y styles | Day 4 |
| `src/vl_jepa/api/static/playground-components.css` | Component patterns | Day 5 |
| `docs/architecture/DESIGN_TOKENS.md` | Token documentation | Day 1 |
| `docs/architecture/DESIGN_PATTERNS.md` | Pattern documentation | Day 5 |

### Modified Files
| File | Changes | Day |
|------|---------|-----|
| `src/vl_jepa/api/static/tokens.css` | Typography + spacing extensions | Day 2 |

---

## Risk Mitigation

| Risk | Mitigation | Fallback |
|------|------------|----------|
| Animation performance issues | Use GPU-composited properties only | Disable animations |
| Dark mode contrast failures | Pre-test with colorblindly.com | Increase contrast values |
| Browser compatibility | Test Safari/Firefox | Add vendor prefixes |
| File size bloat | Monitor throughout | Purge unused utilities |
| Hostile reviewer finds issues | Build in Day 5 buffer | Address in Week 11 |

---

## Handoff

```markdown
## ARCHITECT: Week 10 Design Complete

Artifacts:
- src/vl_jepa/api/static/tokens-v2.css (extended tokens)
- src/vl_jepa/api/static/utilities.css (utility classes)
- src/vl_jepa/api/static/animations-v2.css (animation library)
- src/vl_jepa/api/static/accessibility.css (a11y styles)
- src/vl_jepa/api/static/playground-components.css (patterns)
- docs/architecture/DESIGN_TOKENS.md
- docs/architecture/DESIGN_PATTERNS.md

Status: PENDING_HOSTILE_REVIEW

Quality Metrics:
- New token count: ~35
- Utility class count: ~180
- Animation count: ~25
- Component patterns: 6
- WCAG AA compliance: 100%
- File size total: < 50KB

Next: /review:hostile docs/architecture/DESIGN_TOKENS.md docs/architecture/DESIGN_PATTERNS.md
```

---

## Notes

### Browser Compatibility Targets
- Chrome 100+ (primary)
- Firefox 100+
- Safari 15.4+
- Edge 100+

### Performance Targets
- Animation: 60fps
- First paint impact: < 50ms
- Total CSS size: < 100KB (all files combined)

### Dependencies
- No external libraries required
- Uses native CSS features (custom properties, logical properties)
- Leverages CSS-only animations where possible

---

*Plan created: 2026-01-09*
*Agent: ARCHITECT (frontend-design)*
*Status: READY FOR EXECUTION*
