# UI/UX Audit: Student Playground Frontend

**Date**: 2026-03-05
**Score**: 72 / 100
**Recommendation**: CAUTION

## Summary
- **Critical**: 3
- **Major**: 9
- **Minor**: 11

## Critical Issues

**C1. Analytics CSS uses independent design tokens** (analytics.js inline styles, confidence 95%) — The analytics module uses hard-coded colors (#4a90d9, #ffffff) decoupled from the main token system, breaking dark mode.

**C2. Analytics hard-codes box-shadow with rgba** (analytics.js, confidence 90%) — Raw rgba shadows instead of var(--shadow-sm). Invisible in dark mode.

**C3. Missing role and keyboard handlers on clickable library cards** (confidence 85%) — Cards need role="button", tabindex, and Enter/Space keyboard handlers.

## Major Issues

M1. 12 CSS files loaded synchronously (render-blocking)
M2. No focus-visible on .sp-dialog-btn, .bookmark-delete
M3. .sp-btn--primary:hover uses barely-perceptible opacity: 0.9
M4. Dialog lacks aria-modal, focus trap, escape-to-close
M5. Search input missing aria-label and role="search"
M6. Flashcard flip has no screen reader announcement
M7. Mobile sidebar horizontal scroll has no visual scroll indicators
M8. .bookmark-delete has 2px padding (needs 44px touch target)
M9. Playlist minimap dots 10x10px too small for touch (FIXED in CSS update)

## Minor Issues

m1-m4: Token inconsistencies in analytics inline styles
m5: Missing transition on search results hover
m6: Back button missing focus ring
m7: Toast auto-dismiss without pause-on-hover
m8: Empty state needs illustration/CTA
m9: Confusion heatmap at 0.6 opacity reduces visualization impact

## Positive Findings

Forced-colors support, reduced-motion respect, touch target enforcement, BEM naming, comprehensive token system, safe DOM utilities (no innerHTML), skeleton loading states, dark mode auto-detection.
