# Student Playground

The Student Playground is a client-side learning environment that lets you organize lectures, create flashcards, track study progress, and review analytics — all from your browser with no server required for core features.

## Overview

Access the playground at `/static/index.html` when running the Lecture Mind server, or via GitHub Pages at the project's published URL.

**Key Features:**

- Multi-lecture library with course organization
- Auto-generated flashcards with SM-2 spaced repetition
- Study session analytics with streaks and mastery tracking
- Cross-lecture search across transcripts and segments
- Offline support via Service Worker caching
- Fully keyboard-navigable and accessible

## Library Management

### Courses

Organize lectures into courses using the sidebar:

- Click **New Course** to create a course with a name and color
- Right-click a course to edit or delete it
- Click a course in the sidebar to filter lectures
- **Favorites** and **Uncategorized** are built-in filters

### Importing Lectures

Process a video through the Lecture Mind API, then the results appear automatically in the library. You can also:

- Drag and drop processing results (JSON) into the import area
- Assign lectures to courses after import
- Batch-select lectures for course assignment or deletion

### Searching

The search bar supports cross-lecture full-text search:

- Type to search across all lecture transcripts and segment titles
- Results are grouped by lecture with relevance scoring
- Use tabs to filter by segments, flashcards, or bookmarks

## Flashcard System

### Auto-Generation

Flashcards are automatically generated from lecture segments. Each flashcard has:

- A question derived from the segment content
- An answer with key points
- A difficulty level (easy, medium, hard)

### Study Sessions

Start a study session from any lecture's detail view:

1. Click the **Flashcards** tab
2. Click **Start Study Session**
3. Rate each card: Again (1), Hard (2), Good (3), Easy (4)
4. The SM-2 algorithm schedules reviews based on your ratings

### Spaced Repetition (SM-2)

Cards are scheduled using the SM-2 algorithm:

- **New** cards appear immediately
- **Learning** cards repeat within the session
- **Review** cards appear based on their interval
- **Mastered** cards have intervals > 21 days

## Study Analytics

### Per-Lecture Analytics

Each lecture's detail view has an **Analytics** tab showing:

- Watch time statistics
- Quiz accuracy trend (line chart)
- Mastery distribution (donut chart)
- Recent quiz results table

### Aggregate Dashboard

The library sidebar has a **Dashboard** link showing:

- Current study streak (consecutive days)
- Weekly study time (bar chart)
- Global mastery breakdown across all lectures
- Top lectures by study time

### Data Persistence

All analytics data is stored in IndexedDB:

- Study sessions, quiz results, and watch time persist across browser sessions
- Data is automatically pruned after 90 days to manage storage
- No data leaves your browser — everything is local

## Offline Support

The Service Worker (`sw.js`) enables offline access:

- **Static assets** (HTML, CSS, JS) are cached on first load
- **Cache-first** strategy for the playground UI
- **Network-first** for API calls (falls back to cached responses)
- The SW updates automatically when a new version is deployed

### What Works Offline

- Browsing previously loaded lectures
- Studying flashcards
- Viewing analytics
- Navigating the library

### What Requires Network

- Processing new videos
- Importing new lectures
- Initial first load

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `?` | Show keyboard shortcuts help |
| `/` | Focus search bar |
| `Escape` | Close dialogs / clear search |
| `Enter` | Open selected lecture |
| `Arrow keys` | Navigate library grid |
| `1-4` | Rate flashcard (during study session) |
| `Tab` | Navigate between UI sections |

## Accessibility

The playground follows WCAG 2.1 AA guidelines:

- All interactive elements are keyboard-accessible
- ARIA roles and labels on all components
- Reduced-motion support via `prefers-reduced-motion`
- Skeleton loading states are marked `aria-hidden="true"`
- Focus management during navigation and dialog interactions
