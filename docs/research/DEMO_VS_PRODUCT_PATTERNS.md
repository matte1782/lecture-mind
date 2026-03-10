# Demo vs Product Separation Patterns for Open-Source Tools

**Date:** 2026-03-10
**Author:** RESEARCH_LEAD
**Scope:** How successful open-source projects separate demos from products, with recommendations for Lecture Mind

---

## 1. Case Studies

### Excalidraw
**Demo:** https://excalidraw.com | **Product:** `@excalidraw/excalidraw` npm package
**Pattern:** Monorepo — demo IS a thin wrapper around the library. Same codebase, different entry points.

### tldraw
**Demo:** https://tldraw.com | **Product:** `tldraw` npm SDK
**Pattern:** SDK-first — demo showcases the SDK capabilities.

### VS Code / vscode.dev
**Demo:** https://vscode.dev (browser) | **Product:** VS Code desktop (Electron)
**Pattern:** Same codebase, different build targets with capability degradation. Web version is a legitimate product with known limitations.

### WordPress Playground
**Demo:** https://wordpress.org/playground/ | **Product:** WordPress (self-hosted)
**Pattern:** Real product code compiled to WebAssembly. The demo IS the product, just containerized differently. Gold standard for "try before install."

### Obsidian
**Pattern:** Post-install sandbox vault. No browser demo. Relies on word-of-mouth.

---

## 2. Pattern Taxonomy

| Pattern | Description | Best For |
|---------|-------------|----------|
| A: Monorepo App + Library | Demo wraps the library | SDK/library products |
| B: Same Code, Different Builds | Feature flags/build targets | Desktop + web versions |
| C: Product-in-Sandbox | Real product in constrained env | Complex products |
| D: Separate Entry Points | Same code, different data source | Tools where data differs |
| E: Public Showcase + Gated | Passive demo, gated product | SaaS products |

### Best fit for Lecture Mind: **Pattern D** (Separate Entry Points)

---

## 3. What a Lecture Tool Demo Should Show

**Must show (pre-populated):**
- Example lecture with real segments, timestamps, content
- Working search across segments
- Flashcard generation and SM-2 study flow
- Photo gallery with timestamps
- Analytics dashboard with sample study data

**Key principle:** Demo should feel like "day 30" of using the product, not "day 1."

**Should NOT show:**
- Live recording (requires permissions, confuses demo visitors)
- Real ML processing (requires backend)
- Empty states (demo must feel populated)

---

## 4. GitHub Pages Considerations

### Communicating the Difference

| Element | Purpose |
|---------|---------|
| Persistent banner | Amber "Demo Mode — sample data. Install for live recording" |
| Feature badges | "DEMO" on pre-loaded data, "FULL VERSION" on recording |
| Install CTA | Specific: `pip install lecture-mind` with copy button |

### Detection logic
```javascript
const isDemo = window.location.hostname.includes('github.io');
```

---

## 5. Recommended Strategy for Lecture Mind

### Phase 1: Demo Banner (1h)
- Persistent amber banner on GitHub Pages: "Student Playground — sample data. [Install for your own lectures]"
- Hidden on local backend

### Phase 2: Pre-loaded Sample Data (4-6h)
- Create sample lecture fixture: "Intro to Machine Learning" with 5 segments
- Pre-generate: 20 flashcards, 3 study sessions, 10 bookmarks, 5 photos
- Load into IndexedDB on first visit (demo seed)

### Phase 3: Feature Gating (2-3h)
- Demo mode: disable recording (tooltip "Available after install")
- Demo mode: show sample AI notes, disable generation
- Keep fully functional: library, flashcards, analytics, bookmarks

### Phase 4: Landing Page (8-12h, post-v0.6.0)
- Hero with dual CTA ("Try Playground" + "Install Locally")
- Feature grid, comparison table

### What NOT to Do
1. Do NOT create a separate codebase (double maintenance)
2. Do NOT build landing page before product works
3. Do NOT hide demo behind any wall (no signup)
4. Do NOT make demo feel different from product (same CSS)

---

## Sources

- Excalidraw GitHub, DeepWiki analysis
- tldraw npm, GitHub, tldraw.dev docs
- VS Code Web official docs, vscode.dev announcement blog
- WordPress Playground docs, web.dev article
- Obsidian Sandbox docs
- Evil Martians: "100 devtool landing pages" study
- NN/g: Modes in User Interfaces

---

*RESEARCH_LEAD — Decisions without evidence are guesses.*
