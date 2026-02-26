# Known Bugs & Issues

> Last updated: 2026-02-26
> Version: 0.3.0

---

## Critical

### BUG-001: Module Not Importable After Editable Install

**Status:** Open
**Severity:** Critical
**Found:** 2026-01-30

**Description:**
Running `pip install -e ".[audio]"` completes without errors, but `import vl_jepa` fails with `ModuleNotFoundError`.

**Reproduction:**
```bash
cd lecture_mind
python -m venv .venv
.venv/Scripts/activate  # or source .venv/bin/activate
pip install -e ".[audio]"
python -c "from vl_jepa.audio import WhisperTranscriber"
# ModuleNotFoundError: No module named 'vl_jepa'
```

**Root Cause:**
Hatch build configuration in `pyproject.toml` uses:
```toml
[tool.hatch.build.targets.wheel]
packages = ["src/vl_jepa"]
```
This works for wheel builds but not for editable installs.

**Workaround:**
```bash
PYTHONPATH="./src" python -c "from vl_jepa.audio import WhisperTranscriber"
```

**Proposed Fix:**
1. Add editable install config:
```toml
[tool.hatch.build.targets.editable]
packages = ["src/vl_jepa"]
```
2. Or try: `pip install -e . --config-settings editable_mode=compat`
3. Or restructure to flat layout without `src/`

**Priority:** P0 - Blocks basic usage

---

## Major

### BUG-002: Unicode Path Corruption

**Status:** Open
**Severity:** Major
**Found:** 2026-01-30

**Description:**
Paths containing special characters (à, è, ü, etc.) get corrupted when processed, causing `FileNotFoundError`.

**Reproduction:**
```python
from pathlib import Path
# Path with "Università" (à character)
path = Path("/c/Users/matte/Desktop/Università AI/file.mp4")
path.mkdir(exist_ok=True)
# FileNotFoundError: '\\c\\Users\\matte\\...\\Universit� AI\\...'
```

**Root Cause:**
Mixing path formats:
- Git Bash style: `/c/Users/...`
- Windows style: `C:/Users/...`
- Raw strings vs regular strings

**Workaround:**
Use Windows-style paths with raw strings:
```python
path = Path(r'C:/Users/matte/Desktop/Università AI/file.mp4')
```

**Proposed Fix:**
1. Create path normalization utility:
```python
def normalize_path(p: str | Path) -> Path:
    """Normalize path to work across platforms."""
    p = str(p)
    if p.startswith('/c/'):
        p = 'C:/' + p[3:]
    return Path(p).resolve()
```
2. Use this utility at all path entry points
3. Add tests with unicode characters in paths

**Priority:** P1 - Affects non-ASCII environments

---

## Minor

### BUG-003: CLI Command Not Available

**Status:** Open
**Severity:** Minor
**Found:** 2026-01-30

**Description:**
The `lecture-mind` CLI command defined in `pyproject.toml` is not available when the module import fails (BUG-001).

**Expected:**
```bash
lecture-mind process video.mp4 --output data/
```

**Actual:**
```bash
lecture-mind: command not found
# or
ModuleNotFoundError when trying to run
```

**Workaround:**
Run directly with Python and PYTHONPATH:
```bash
PYTHONPATH="./src" python -m vl_jepa.cli process video.mp4
```

**Proposed Fix:**
1. Add `__main__.py` to enable `python -m vl_jepa`
2. Add standalone runner script `scripts/run.py`
3. Fix BUG-001 (root cause)

**Priority:** P2 - Workaround available

---

### BUG-004: Silent Installation Failures

**Status:** Open
**Severity:** Minor
**Found:** 2026-01-30

**Description:**
`pip install -e ".[audio]"` returns exit code 0 and no output, but the package is not actually installed/importable.

**Workaround:**
Manually verify installation:
```bash
pip show lecture-mind
python -c "import vl_jepa; print('OK')"
```

**Proposed Fix:**
1. Add post-install hook to verify
2. Add `lecture-mind --version` command
3. Add installation test to CI

**Priority:** P2 - Confusing but not blocking

---

## UX Improvements

### UX-001: No Progress Feedback During Transcription

**Status:** Open
**Severity:** UX
**Found:** 2026-01-30

**Description:**
Long-running transcription operations provide no progress feedback. Users don't know if the process is working or frozen.

**Current Behavior:**
```
[1/12] 2025-11-10.mp4
# ... silence for 15-30 minutes ...
    -> 1989 segments
```

**Expected Behavior:**
```
[1/12] 2025-11-10.mp4
  Extracting audio... done (45s)
  Transcribing: 45% [████████░░░░░░░░] 12:34 remaining
    -> 1989 segments
```

**Proposed Fix:**
1. Add `tqdm` to dependencies
2. Wrap transcription loop with progress bar
3. Add ETA calculation based on audio duration

**Priority:** P3 - Nice to have

---

## Summary

| ID | Title | Severity | Status | Blocking |
|----|-------|----------|--------|----------|
| BUG-001 | Module not importable | Critical | Open | Yes |
| BUG-002 | Unicode path corruption | Major | Open | Partial |
| BUG-003 | CLI not available | Minor | Open | No |
| BUG-004 | Silent install failures | Minor | Open | No |
| UX-001 | No progress feedback | UX | Open | No |

---

## Version History

- **0.3.0** (2026-01-30): Initial bug tracking created
