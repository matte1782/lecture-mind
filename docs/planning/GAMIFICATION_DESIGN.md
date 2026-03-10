# Gamification System Design

**Version:** 1.0.0
**Author:** ARCHITECT
**Status:** DRAFT
**Date:** 2026-03-10
**Budget:** 22-28 hours
**Target release:** v0.6.0 (alongside OCR) — NOTE: v0.7.0 is reserved for "Community" (multi-user backend)

---

## 1. Design Principle

**Simplest system that creates a daily habit.**

Khan Academy's gamification works because it is simple: energy points for every action, a level number, badges for milestones, and a streak counter. Students do not need to understand the system -- they just see numbers go up. That feedback loop is the entire mechanism.

We copy that. No leaderboards (single-user, local-first). No social features. No virtual currency or shop. Just: XP, levels, badges, streaks. Four concepts, one IDB store, one module.

**Why this matters for Lecture Mind:** Alessandro is right -- flashcards and quizzes alone are "do once and forget" features. A visible progression system transforms isolated study actions into a continuous journey. NotebookLM has nothing like this. Neither does any free lecture tool in our competitive space.

---

## 2. Point System (XP)

### 2.1 XP Awards

Every meaningful study action earns XP. The amounts are calibrated so that a typical 30-minute study session earns roughly 100-200 XP.

| Action | XP | Rationale |
|--------|-----|-----------|
| **Flashcard review (quality 3)** | 5 | Hard pass -- minimal reward |
| **Flashcard review (quality 4)** | 10 | Good recall -- standard reward |
| **Flashcard review (quality 5)** | 15 | Perfect recall -- bonus |
| **Flashcard review (quality 0-2)** | 3 | Failed -- still rewarded for trying |
| **Card reaches MASTERED** | 50 | Milestone bonus (one-time per card) |
| **Quiz completed** | 20 | Base quiz reward |
| **Quiz 100% accuracy** | 30 | Perfect quiz bonus (replaces base 20) |
| **Confusion vote cast** | 2 | Low -- easy to spam, but want to encourage it |
| **Photo captured** | 5 | Encourage lecture engagement |
| **Recording started** | 10 | One-time per session (not per chunk) |
| **Recording completed (>5 min)** | 20 | Bonus for meaningful recordings |
| **Lecture created** | 15 | Content organization |
| **First study action of the day** | 25 | Daily login bonus (once per calendar day) |
| **Streak milestone (7 days)** | 100 | Weekly streak bonus |
| **Streak milestone (30 days)** | 500 | Monthly streak bonus |

### 2.2 XP Constants

```
XP_VALUES = {
  FLASHCARD_FAIL: 3,
  FLASHCARD_HARD: 5,
  FLASHCARD_GOOD: 10,
  FLASHCARD_EASY: 15,
  CARD_MASTERED: 50,
  QUIZ_COMPLETE: 20,
  QUIZ_PERFECT: 30,
  CONFUSION_VOTE: 2,
  PHOTO_CAPTURE: 5,
  RECORDING_START: 10,
  RECORDING_COMPLETE: 20,
  LECTURE_CREATED: 15,
  DAILY_BONUS: 25,
  STREAK_WEEKLY: 100,
  STREAK_MONTHLY: 500
}
```

### 2.3 Design Decisions

- **Failed flashcard reviews still earn XP.** The point is to reward showing up, not just succeeding. SM-2 already handles the learning mechanics -- XP is purely motivational.
- **Quiz perfect replaces base, not stacks.** A perfect quiz earns 30, not 20+30=50. Keeps inflation in check.
- **Recording XP requires minimum duration.** The completion bonus requires >5 minutes to prevent start-stop farming.
- **No XP for library browsing or watching.** Passive consumption should not be rewarded -- only active study actions.

---

## 3. Level System

### 3.1 XP Curve

Quadratic growth. Each level requires more XP than the last, scaling linearly per level.

```
xpForLevel(n) = n <= 1 ? 0 : 50 * (n - 1) * n
```

| Level | Total XP Required | XP for This Level | Approx. Study Days |
|-------|-------------------|-------------------|---------------------|
| 1 | 0 | 0 (start here) | 0 |
| 2 | 100 | 100 | 1 |
| 3 | 300 | 200 | 2 |
| 4 | 600 | 300 | 4 |
| 5 | 1,000 | 400 | ~1 week |
| 10 | 4,500 | 900 | ~1 month |
| 15 | 10,500 | 1,400 | ~2 months |
| 20 | 19,000 | 1,900 | ~4 months |
| 30 | 43,500 | 2,900 | ~10 months |
| 50 | 122,500 | 4,900 | ~2 years |

### 3.2 Level Cap

**Max level: 50.** After level 50, XP continues to accumulate but level stays at 50. This prevents meaningless numbers while giving a concrete long-term goal.

### 3.3 Level Titles (optional flavor)

| Range | Title |
|-------|-------|
| 1-4 | Novice |
| 5-9 | Student |
| 10-14 | Scholar |
| 15-19 | Expert |
| 20-29 | Master |
| 30-39 | Professor |
| 40-49 | Sage |
| 50 | Legend |

### 3.4 Implementation

```javascript
function xpForLevel(level) {
  if (level <= 1) return 0;
  return 50 * (level - 1) * level;
}

function levelFromXP(totalXP) {
  let level = 1;
  while (level < 50 && xpForLevel(level + 1) <= totalXP) {
    level++;
  }
  return level;
}

function progressToNextLevel(totalXP) {
  const level = levelFromXP(totalXP);
  if (level >= 50) return { level: 50, progress: 1.0, xpInLevel: 0, xpNeeded: 0 };
  const currentThreshold = xpForLevel(level);
  const nextThreshold = xpForLevel(level + 1);
  const xpInLevel = totalXP - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  return { level, progress: xpInLevel / xpNeeded, xpInLevel, xpNeeded };
}
```

These are pure functions -- no state, no side effects. Testable in isolation.

---

## 4. Badge/Achievement System

### 4.1 Badge Categories

Badges are organized into four categories that map to the app's core actions.

#### Study Badges

| Badge | Criteria | Icon Concept |
|-------|----------|--------------|
| First Steps | Complete first flashcard review | Footprints |
| Card Shark | Review 100 flashcards total | Playing cards |
| Memory Palace | Review 500 flashcards total | Castle |
| Quiz Whiz | Complete 10 quizzes | Lightning bolt |
| Perfect Score | Get 100% on a quiz with 5+ questions | Star |
| Mastery I | Get 10 cards to MASTERED status | Bronze medal |
| Mastery II | Get 50 cards to MASTERED status | Silver medal |
| Mastery III | Get 100 cards to MASTERED status | Gold medal |

#### Capture Badges

| Badge | Criteria | Icon Concept |
|-------|----------|--------------|
| Shutterbug | Capture first photo | Camera |
| Photographer | Capture 50 photos total | Camera with flash |
| On the Record | Complete first recording (>5 min) | Microphone |
| Marathon Recorder | Complete 10 recordings | Microphone with star |

#### Consistency Badges

| Badge | Criteria | Icon Concept |
|-------|----------|--------------|
| Getting Started | Study 3 days in a row | Seedling |
| On a Roll | Study 7 days in a row | Fire |
| Dedicated | Study 14 days in a row | Fire x2 |
| Unstoppable | Study 30 days in a row | Rocket |
| Semester Strong | Study 60 days in a row | Trophy |

#### Milestone Badges

| Badge | Criteria | Icon Concept |
|-------|----------|--------------|
| Level 5 | Reach level 5 | Shield (bronze) |
| Level 10 | Reach level 10 | Shield (silver) |
| Level 20 | Reach level 20 | Shield (gold) |
| Organizer | Create 5 lectures | Folder |
| Curious Mind | Cast 20 confusion votes | Question mark |

**Total: 22 badges.** Enough to feel substantial, few enough to implement in a weekend.

### 4.2 Badge Data Structure

```javascript
const BADGE_DEFINITIONS = {
  FIRST_STEPS:       { id: 'first_steps',       category: 'study',       name: 'First Steps',       description: 'Complete your first flashcard review' },
  CARD_SHARK:        { id: 'card_shark',         category: 'study',       name: 'Card Shark',        description: 'Review 100 flashcards' },
  // ... etc
};
```

Badges are defined as constants in `gamification.js`. The store only records which badges have been earned and when -- not the definitions themselves.

### 4.3 Badge Check Logic

Badge checks run after every XP award. The check function receives the current `GamificationProfile` and returns an array of newly earned badge IDs.

```
function checkBadges(profile, actionContext) -> string[]
```

Where `actionContext` provides the specific action that triggered the check (e.g., `{ type: 'flashcard_review', quality: 5 }`). This avoids re-scanning all data on every action -- most checks are simple counter comparisons against the profile.

---

## 5. Streak System

### 5.1 How Streaks Work

A **streak** counts consecutive calendar days (local timezone) where the user performed at least one XP-earning action. The existing `calculateStreak` function in analytics.js already does this for study sessions. Gamification unifies all actions into one streak.

### 5.2 Streak Tracking

The `GamificationProfile` stores:

- `currentStreak`: number of consecutive days (including today if active)
- `longestStreak`: all-time best
- `lastActiveDate`: ISO date string (YYYY-MM-DD) of the last day an XP action occurred

On every XP award:

```
today = toLocalDateString(new Date())
if (lastActiveDate === today) {
  // Same day -- no streak change
} else if (lastActiveDate === yesterday(today)) {
  currentStreak += 1
  if (currentStreak > longestStreak) longestStreak = currentStreak
} else {
  // Streak broken -- reset
  currentStreak = 1
}
lastActiveDate = today
```

### 5.3 Streak Freeze (deferred)

A "streak freeze" (skip one day without breaking streak) is a common gamification feature but adds complexity. **Deferred to v0.8.0+.** For v0.7.0, streaks are strict.

### 5.4 Relationship to analytics.js Streak

The existing `calculateStreak()` in analytics.js computes streak from study session timestamps every time the dashboard renders. This is expensive (scans all sessions) and only covers flashcard/quiz sessions.

The gamification streak replaces this with a pre-computed value updated incrementally. The analytics dashboard should read from `GamificationProfile.currentStreak` instead of recomputing.

**Migration path:** On first load after upgrade, compute streak from existing study sessions and seed the profile. Then switch to incremental updates.

---

## 6. UI Design

### 6.1 Sidebar Level Indicator

The primary visibility point. A compact widget in the sidebar showing:

```
+---------------------------+
|  Lv.12 Scholar            |
|  [=========>         ] 67% |
|  1,847 / 2,760 XP         |
+---------------------------+
```

- Always visible in the sidebar (below navigation, above footer)
- Progress bar uses CSS custom property for fill color (`--xp-bar-fill`)
- Clicking it navigates to `#/profile` (or shows a modal -- TBD during implementation)
- On level-up: brief CSS animation (pulse/glow), no blocking modal

### 6.2 XP Toast Notifications

When XP is earned, a small toast appears briefly (2 seconds, auto-dismiss):

```
+10 XP  Flashcard reviewed
```

Uses the existing `showToast()` from flashcards.js. No new toast system needed.

### 6.3 Badge Unlock Notification

When a badge is earned, a more prominent toast (3 seconds):

```
Badge Unlocked: Card Shark
Review 100 flashcards
```

Same `showToast()` with a different CSS class for badge toasts.

### 6.4 Badge Gallery

A grid view accessible from the profile or dashboard showing all 22 badges. Earned badges are full color; unearned badges are greyed out with a lock icon.

```
+-------+-------+-------+-------+
| [B1]  | [B2]  | [B3]  | [B4]  |
| First | Card  | Quiz  | Mastery|
| Steps | Shark | Whiz  |   I   |
+-------+-------+-------+-------+
| [??]  | [??]  | [??]  | [??]  |
| (locked badges shown dimmed)   |
+-------+-------+-------+-------+
```

Badge icons are CSS-only (emoji or CSS shapes). No image assets needed. Keeps the app lightweight.

### 6.5 Streak Display

The streak is shown in two places:
1. **Sidebar widget** (below the level bar): flame emoji + number + "day streak"
2. **Dashboard** (existing streak card): reads from profile instead of recomputing

### 6.6 Profile View (new route: `#/profile`)

A dedicated view showing:
- Level + XP progress (large)
- Current streak + longest streak
- Badge gallery (earned + locked)
- XP history (last 30 days chart, reusing existing `renderBarChart`)
- Total stats: cards reviewed, quizzes taken, photos captured, etc.

This is an L3 feature (rendered by library.js or a new L2 module -- see Architecture section).

---

## 7. Data Model

### 7.1 IDB Store: `gamificationProfiles`

One record per user. For the single-user local-first app, there is exactly one record with a well-known key.

```javascript
// Store definition
gamificationProfiles: {
  keyPath: 'id',
  indexes: []
}
```

### 7.2 Model: GamificationProfile

```javascript
/**
 * @typedef {Object} GamificationProfile
 * @property {string} id - Always 'default' (single-user)
 * @property {number} totalXP - Lifetime XP earned
 * @property {number} currentStreak - Consecutive study days
 * @property {number} longestStreak - All-time best streak
 * @property {string|null} lastActiveDate - 'YYYY-MM-DD' of last XP action
 * @property {Object} counters - Lifetime action counters
 * @property {number} counters.flashcardsReviewed - Total flashcard reviews
 * @property {number} counters.cardsMastered - Total cards reaching MASTERED
 * @property {number} counters.quizzesCompleted - Total quizzes finished
 * @property {number} counters.quizzesPerfect - Total perfect quizzes
 * @property {number} counters.photosCaptured - Total photos taken
 * @property {number} counters.recordingsCompleted - Total recordings finished
 * @property {number} counters.lecturesCreated - Total lectures created
 * @property {number} counters.confusionVotes - Total confusion votes cast
 * @property {string[]} badges - Array of earned badge IDs
 * @property {Object} badgeTimestamps - Map of badgeId -> earned timestamp
 * @property {number} createdAt - Profile creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */
```

### 7.3 Factory Function

```javascript
export function createGamificationProfile({ id = 'default' } = {}) {
  const timestamp = Date.now();
  return {
    id,
    totalXP: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    counters: {
      flashcardsReviewed: 0,
      cardsMastered: 0,
      quizzesCompleted: 0,
      quizzesPerfect: 0,
      photosCaptured: 0,
      recordingsCompleted: 0,
      lecturesCreated: 0,
      confusionVotes: 0
    },
    badges: [],
    badgeTimestamps: {},
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
```

### 7.4 IDB Store: `xpEvents`

An append-only log of XP awards. Used for the XP history chart and for debugging. Pruned to last 1000 entries.

```javascript
// Store definition
xpEvents: {
  keyPath: 'id',
  indexes: [
    { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
    { name: 'date', keyPath: 'date', options: { unique: false } }
  ]
}
```

### 7.5 Model: XPEvent

```javascript
/**
 * @typedef {Object} XPEvent
 * @property {string} id - UUID
 * @property {string} action - Action type (e.g., 'flashcard_review', 'quiz_complete')
 * @property {number} xp - XP amount awarded
 * @property {string} date - 'YYYY-MM-DD' local date
 * @property {number} createdAt - Timestamp
 */

export function createXPEvent({ action, xp }) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    action,
    xp,
    date: toLocalDateString(new Date(now)),
    createdAt: now
  };
}
```

### 7.6 Why Two Stores, Not One

The profile is a single mutable document (read-modify-write on every action). The XP event log is append-only. Separating them means:

- Profile reads are O(1) -- get by known key `'default'`
- XP history queries use the `date` index on `xpEvents`
- No risk of the profile document growing unbounded (events are pruned separately)

---

## 8. Architecture

### 8.1 Module Position

```
dom-utils.js           (L0)
    |
flashcards.js          (L1 - router, study)
    /    |    \
analytics.js  recorder.js  gamification.js    (L2 - parallel)
    \    |    /
  library.js             (L3)
```

`gamification.js` sits at **L2**, parallel to analytics.js and recorder.js. It imports from flashcards.js (for `registerViewCleanup`, `showToast`, `navigateTo`) and dom-utils.js (for `createElement`). It does NOT import from analytics.js, recorder.js, or library.js.

### 8.2 Cross-Module Communication

The key challenge: how do flashcards.js, analytics.js, recorder.js, and library.js emit XP events to gamification.js without importing it (that would violate AD-1)?

**Solution: Callback registration pattern** (same pattern as `setLibraryRenderer` and `setRecordRenderer`).

```javascript
// In flashcards.js (L1):
let _xpCallback = null;
function setXPCallback(fn) { _xpCallback = fn; }
function emitXP(action, xp) { if (_xpCallback) _xpCallback(action, xp); }

// In gamification.js (L2), on module load:
import { setXPCallback } from './flashcards.js';
setXPCallback((action, xp) => awardXP(action, xp));
```

Then flashcards.js calls `emitXP('flashcard_review', 10)` after a card review. The callback goes to gamification.js without flashcards.js knowing about it.

For L2 modules (analytics.js, recorder.js) that also need to emit XP: they call `emitXP()` from flashcards.js as well, since both already import from flashcards.js. For L3 modules (library.js): library.js already imports from flashcards.js (L1), so it can call `emitXP()` directly. This is an upward call from L3 to L1, which is architecturally valid per AD-1 (L3 depends on L1). This keeps the callback registration in one place (L1).

### 8.3 New Exports from flashcards.js

```javascript
export { setXPCallback, emitXP };
```

### 8.4 Hookable Renderer

For the `#/profile` route, gamification.js registers its renderer via a new `setProfileRenderer(fn)` callback in flashcards.js. Same pattern as library and record renderers.

Alternative: skip the `#/profile` route entirely and render the badge gallery as a modal or inline in the dashboard. This avoids adding yet another route. **Decision point during implementation.**

### 8.5 Sidebar Widget

The sidebar widget is rendered by `gamification.js` and injected into the sidebar DOM. Since the sidebar is created by flashcards.js (L1), gamification.js (L2) uses a hookable callback:

```javascript
// flashcards.js
let _sidebarWidgetRenderer = null;
function setSidebarWidgetRenderer(fn) { _sidebarWidgetRenderer = fn; }
// Called during sidebar render:
if (_sidebarWidgetRenderer) _sidebarWidgetRenderer(sidebarElement);
```

### 8.6 File Inventory

| File | Layer | Est. Lines | Purpose |
|------|-------|------------|---------|
| `gamification.js` | L2 | ~500 | XP engine, level calc, badge checks, streak logic, sidebar widget, profile UI |
| `gamification.test.js` | test | ~400 | Unit tests for all pure functions + integration tests for IDB |
| `gamification.css` | style | ~100 | Level bar, badge grid, XP toast variant, animations |

### 8.7 Storage Layer Changes

| File | Change |
|------|--------|
| `storage/db.js` | Bump `DB_VERSION` to 3 (or 4 if OCR already bumped to 3). Add `gamificationProfiles` and `xpEvents` to STORES. |
| `storage/models.js` | Add `createGamificationProfile`, `createXPEvent`, `validateGamificationProfile`, `validateXPEvent`. Add `XP_VALUES` constant. |
| `storage/repositories.js` | Add `GamificationProfileRepository` (get, getOrCreate, update) and `XPEventRepository` (add, getByDateRange, prune). |
| `storage/index.js` | Re-export new repositories. |
| `storage/migrations.js` | Migration to create 2 new stores. Seed default profile from existing study session data. |

---

## 9. Integration Points

### 9.1 Flashcard Reviews (flashcards.js)

**Where:** Inside the `reviewCard` function, after SM-2 calculation completes.

```javascript
// After SM-2 update:
const xpMap = { 0: 3, 1: 3, 2: 3, 3: 5, 4: 10, 5: 15 };
emitXP('flashcard_review', xpMap[quality]);

// If card just reached MASTERED:
if (newStatus === 'mastered' && oldStatus !== 'mastered') {
  emitXP('card_mastered', 50);
}
```

### 9.2 Quiz Completion (analytics.js)

**Where:** Inside `saveQuizResult`, after the record is stored.

```javascript
emitXP('quiz_complete', result.accuracy === 100 ? 30 : 20);
```

### 9.3 Confusion Voting (library.js)

**Where:** Inside the confusion vote toggle handler, only on vote cast (not removal).

```javascript
if (isNowVoted) {
  emitXP('confusion_vote', 2);
}
```

### 9.4 Photo Capture (recorder.js)

**Where:** After photo is successfully stored in IDB.

```javascript
emitXP('photo_capture', 5);
```

### 9.5 Recording (recorder.js)

**Where:** On recording start and on recording complete (>5 min check).

```javascript
// On start:
emitXP('recording_start', 10);

// On complete, if duration > 5 minutes:
if (session.duration > 300000) {
  emitXP('recording_complete', 20);
}
```

### 9.6 Lecture Creation (library.js or recorder.js post-flow)

**Where:** After lecture record is stored in IDB.

```javascript
emitXP('lecture_created', 15);
```

---

## 10. Anti-Gaming Rules

### 10.1 Per-Action Cooldowns

| Action | Cooldown | Mechanism |
|--------|----------|-----------|
| Flashcard review (same card) | 60 seconds | In-memory Map of cardId -> lastReviewTimestamp. No XP if reviewed within 60s. |
| Confusion vote (same segment) | None needed | Toggle pattern already prevents spam (vote/unvote). XP only on vote, not unvote. |
| Photo capture | 5 seconds | In-memory timestamp. Prevents rapid-fire camera spam. |
| Recording start | None needed | Natural constraint -- can only start one recording. |

### 10.2 Daily XP Cap

**No daily cap.** Reason: a student who genuinely studies for 4 hours should be rewarded more than one who studies 15 minutes. Caps punish dedicated users. The logarithmic level curve already ensures diminishing returns from pure grinding.

### 10.3 Counter Validation

The `awardXP` function validates that the action type is known:

```javascript
function awardXP(action, xp) {
  if (!VALID_ACTIONS.includes(action)) return;
  if (typeof xp !== 'number' || xp <= 0 || xp > 500) return;
  // ... proceed
}
```

### 10.4 No Retroactive XP

When gamification is first enabled (DB migration), existing study history is used only to seed the streak. Historical actions do NOT retroactively earn XP. This prevents a user from starting at level 15 and missing the progression experience.

**Exception:** The profile's `counters` ARE seeded from historical data so badge checks work correctly. A user who already reviewed 100 flashcards before the update should immediately earn the Card Shark badge.

### 10.5 Duplicate Event Prevention

Each call to `awardXP` creates an `XPEvent` with a UUID. The in-memory cooldown map prevents duplicate awards for the same action within the cooldown window. Since all callers are in the same browser tab and the cooldown map is in-memory, there is no cross-tab race condition concern (each tab maintains its own gamification state; on next tab focus, profile is re-read from IDB).

---

## 11. Migration Plan

### 11.1 DB Version Bump

This feature requires DB_VERSION to increment. If OCR (v0.6.0) has already bumped to 3, gamification bumps to 4.

```javascript
// In migrations.js
if (event.oldVersion < GAMIFICATION_VERSION) {
  // Stores are created by createStores() in db.js onupgradeneeded
  // No manual store creation needed -- additive schema change
}
```

### 11.2 Profile Seeding

On first app load after migration, if `gamificationProfiles` store has no record with id `'default'`:

1. Create default profile via `createGamificationProfile()`
2. Read existing study sessions from `analytics:studySessions` setting
3. Compute `currentStreak` and `longestStreak` from session timestamps
4. Count historical flashcard reviews, quizzes, etc. from session records
5. Populate `counters` object
6. Run badge checks against seeded counters -- award any earned badges
7. Set `totalXP = 0` (no retroactive XP -- see 10.4)
8. Save profile

This seeding runs once, in `gamification.js` module init (not in the migration itself), because it needs to read from the settings store which requires a completed DB transaction.

### 11.3 Files Modified

| File | Change |
|------|--------|
| `storage/db.js` | Add 2 stores to STORES, bump DB_VERSION |
| `storage/models.js` | Add 2 factories + 2 validators + XP_VALUES constant |
| `storage/repositories.js` | Add 2 repository classes |
| `storage/index.js` | Re-export 2 new repositories |
| `flashcards.js` | Add `setXPCallback`, `emitXP`, `setSidebarWidgetRenderer`, `setProfileRenderer`. Call `emitXP` after SM-2 review. |
| `analytics.js` | Call `emitXP` after quiz save. Optionally read streak from profile instead of recomputing. |
| `recorder.js` | Call `emitXP` after photo capture, recording start/complete. |
| `library.js` | Call `emitXP` after confusion vote (on cast only) and lecture creation. |
| `sw.js` | Add `gamification.js`, `gamification.css` to STATIC_ASSETS. Bump CACHE_NAME. |
| `index.html` | Add `<section id="profile-view">` if using route. Add `<script type="module" src="gamification.js">`. |

---

## 12. Implementation Plan

### Week A: Core Engine + Storage (10h)

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Day 1 | Storage: 2 new stores, factories, validators, repositories | 4h | models.js + repos + 20 tests |
| Day 2 | XP engine: awardXP, level functions, streak logic, badge checks | 4h | gamification.js core + 25 tests |
| Day 3 | Profile seeding from existing data + migration | 2h | Seed logic + 5 tests |

### Week B: UI + Integration (10-12h)

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Day 4 | Sidebar widget + XP toast + level-up animation | 3h | UI rendering + CSS + 5 tests |
| Day 5 | Integration: flashcards.js + analytics.js emit hooks | 3h | setXPCallback + emitXP wiring + 5 tests |
| Day 6 | Integration: recorder.js + library.js emit hooks | 2h | Remaining integrations + 5 tests |
| Day 7 | Badge gallery + profile view (or dashboard integration) | 3h | Badge grid UI + 5 tests |

### Week C: Polish + Review (4-6h)

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Day 8 | Edge cases, anti-gaming cooldowns, XP event pruning | 2h | Hardening + 5 tests |
| Day 9 | Hostile review + fixes | 2-4h | Review score >= 85 |

**Total: ~75 new tests. Total estimated hours: 22-28h.**

---

## 13. Testing Strategy

### 13.1 Pure Function Tests (gamification.test.js)

- `xpForLevel`: boundary cases (level 1, 2, 50, >50)
- `levelFromXP`: exact thresholds, between levels, 0 XP, huge XP
- `progressToNextLevel`: 0%, 50%, 99%, capped at 50
- `checkBadges`: each badge criterion individually, no duplicate awards
- `updateStreak`: same day, consecutive day, gap, first ever

### 13.2 Repository Tests (repositories.test.js additions)

- `GamificationProfileRepository.getOrCreate`: creates default on first call, returns existing on second
- `GamificationProfileRepository.update`: merges partial updates, sets updatedAt
- `XPEventRepository.add`: creates valid record
- `XPEventRepository.getByDateRange`: correct filtering
- `XPEventRepository.prune`: keeps last N, removes oldest

### 13.3 Integration Tests (gamification.test.js)

- `awardXP`: updates profile totalXP, counters, streak, badges in one call
- `awardXP` with cooldown: second call within cooldown returns 0 XP
- Badge unlock: earning 100th flashcard review triggers Card Shark badge
- Daily bonus: first action of day gets +25 XP, second does not
- Profile seeding: mock existing study sessions, verify streak/counters seeded correctly

### 13.4 UI Tests (gamification.test.js)

- Sidebar widget renders level, progress bar, XP text
- Badge gallery renders correct number of earned/locked badges
- XP toast calls `showToast` with correct message

---

## 14. Open Questions

| # | Question | Owner | Decision Needed By |
|---|----------|-------|--------------------|
| Q1 | Should `#/profile` be a new route or a modal from the sidebar? | ARCHITECT | Week B Day 7 |
| Q2 | Should the analytics dashboard streak card read from GamificationProfile or keep its own calculation? | ARCHITECT | Week B Day 5 |
| Q3 | Should badge icons be emoji (zero-cost) or SVG (better but 22 SVGs to create)? | Contributor | Week B Day 7 |
| Q4 | ~~Should gamification ship in v0.6.0 alongside OCR, or in a separate v0.7.0?~~ **RESOLVED: v0.6.0 alongside OCR. v0.7.0 is reserved for "Community" (multi-user).** | PM | RESOLVED |
| Q5 | Cross-tab consistency: if user has two tabs open, both award XP independently. Is this acceptable? | ARCHITECT | Week A Day 2 |

### Preliminary Answers

- **Q1:** Start with a modal. If it feels cramped, upgrade to a route. Modal avoids adding router complexity.
- **Q2:** Read from profile. Single source of truth. Delete `calculateStreak` from analytics.js or keep it as deprecated.
- **Q3:** Emoji for MVP. Replace with SVG in a polish pass if the feature proves popular.
- **Q5:** Acceptable for MVP. Two tabs = two instances. Profile is last-write-wins. XP inflation from multi-tab is negligible in practice (who studies in two tabs?).

---

## 15. What is NOT in Scope

| Feature | Why Not | When |
|---------|---------|------|
| Leaderboards | Single-user, local-first -- no one to compete with | v0.8.0+ with multi-user backend |
| Virtual currency / shop | Over-engineering. XP is the only currency. | Never (probably) |
| Streak freeze | Adds settings UI + edge cases. Strict streaks first. | v0.8.0+ |
| Animated badge unlock | CSS animation on toast is enough. No confetti or full-screen overlay. | Maybe v0.8.0 polish |
| Seasonal badges | Requires date-based logic, expiration, etc. | v0.8.0+ |
| Custom themes unlocked by level | Cool but scope creep | v0.8.0+ |

---

## 16. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| XP inflation makes levels meaningless | LOW | MEDIUM | Logarithmic curve + no daily cap but natural action limits. Monitor in first month. |
| Integration touches 4 modules -- high regression risk | MEDIUM | HIGH | Each integration is a 1-line `emitXP()` call. Test each independently. |
| Profile seeding miscount from legacy data | MEDIUM | LOW | Seed counters conservatively. Off-by-one in badges is not critical. |
| Users ignore gamification entirely | LOW | LOW | Sidebar widget is always visible. Zero opt-in required. Worst case: inert feature, no harm. |
| Performance: badge checks on every action | LOW | LOW | Badge checks are simple counter comparisons. O(22) comparisons per action = negligible. |

---

*ARCHITECT -- Good design makes implementation obvious.*
