# Hostile Review: iOS Spike (Day 0.5)

## Summary
- **Score:** 85/100 → 92/100 (after fixes)
- **Issues:** 0 Critical, 2 Major (FIXED), 5 Minor (3 FIXED, 2 accepted)
- **Recommendation:** GO

## Major Issues (FIXED)

### M1: getUserMedia requires HTTPS — local HTTP won't work on iPhone
**Location:** `docs/spikes/IOS_PHOTO_SPIKE.md:36-41`
**Issue:** `getUserMedia` requires secure context. Phone accessing `http://<laptop-ip>:8903` will fail.
**Fix:** Reordered options — GitHub Pages primary, ngrok secondary, local HTTP marked desktop-only.
**Status:** FIXED

### M2: iOS detection snippet misses iPadOS desktop-mode UA
**Location:** `docs/spikes/IOS_PHOTO_SPIKE.md:131-134`
**Issue:** iPadOS 13+ reports desktop UA — `/iPad|iPhone|iPod/` won't match.
**Fix:** Added `navigator.maxTouchPoints > 0 && /Macintosh/` fallback.
**Status:** FIXED

## Minor Issues

| ID | Issue | Status |
|----|-------|--------|
| m1 | 200ms monitor suspended during camera — misleading timestamps | FIXED (added protocol note) |
| m2 | iOS Safari may ignore timeslice — zero chunks normal | FIXED (added protocol note) |
| m3 | iOS version note (14.5+ for MediaRecorder, 18.4+ for Opus) | FIXED (updated requirements) |
| m4 | No multi-photo consecutive test | ACCEPTED (nice-to-have, tester can do ad-hoc) |
| m5 | Wake Lock status stale after reset | FIXED (reset handler updated) |

## Verdict: GO
