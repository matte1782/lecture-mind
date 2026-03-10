# Local Setup Guide

Complete installation guide for running Lecture Mind locally with all features.

## Prerequisites

### Required

| Software | Version | Check Command |
|----------|---------|---------------|
| Python | 3.10+ | `python --version` or `py --version` (Windows) |
| pip | Latest | `pip --version` |
| Git | Any | `git --version` |
| FFmpeg | 4.0+ | `ffmpeg -version` |

> **Windows Users:** Python may be installed as `py` instead of `python`. Use whichever command works on your system.

### Installing FFmpeg

**Windows:**
```bash
# Using winget (Windows 11/10)
winget install FFmpeg

# Or download from https://ffmpeg.org/download.html
# Add to PATH after extraction
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install ffmpeg
```

### Optional: CUDA for GPU Acceleration

For faster processing with NVIDIA GPUs:
1. Install [CUDA Toolkit 11.8+](https://developer.nvidia.com/cuda-toolkit)
2. Install [cuDNN](https://developer.nvidia.com/cudnn)
3. Verify: `nvidia-smi`

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/matte1782/lecture-mind.git
cd lecture-mind
```

### Step 2: Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

> **Tip:** To exit the virtual environment later, run `deactivate`.

### Step 3: Install Dependencies

```bash
# Full installation (recommended)
pip install -e ".[all]"

# Or minimal + API only
pip install -e ".[api]"
```

### Step 4: Verify Installation

```bash
python -c "from vl_jepa import VideoInput; print('OK')"
# On Windows, use: py -c "from vl_jepa import VideoInput; print('OK')"
```

Expected output: `OK`

---

## Running the Web UI

> **Prerequisite:** The Web UI requires the API dependencies.
> If you installed with `[all]`, you're ready. Otherwise, run: `pip install -e ".[api]"`

### Start the Server

```bash
# From the project root directory
uvicorn vl_jepa.api.main:app --host 0.0.0.0 --port 8000
```

### Access the Application

Open your browser and navigate to:
- **Web UI**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Your First Video

1. Click "Upload Video" on the main page
2. Select a video file (MP4, WebM, AVI, MOV, or MKV)
3. Wait for processing to complete
4. Explore the Events, Transcript, and Search tabs
5. Export results in your preferred format

---

## Troubleshooting

### "FFmpeg not found"

**Cause:** FFmpeg is not installed or not in PATH.

**Fix (Windows):**
```bash
# Add FFmpeg to PATH (adjust path to your FFmpeg location)
setx PATH "%PATH%;C:\ffmpeg\bin"

# IMPORTANT: Open a NEW terminal window after running setx
# Then verify:
ffmpeg -version
```

**Fix (macOS/Linux):** See [Installing FFmpeg](#installing-ffmpeg) above.

### "CUDA out of memory"

**Cause:** GPU memory insufficient for the model.

**Fix:** Force CPU mode by disabling CUDA:
```bash
# Windows
set CUDA_VISIBLE_DEVICES=

# macOS/Linux
export CUDA_VISIBLE_DEVICES=""
```

### "ModuleNotFoundError"

**Cause:** Dependencies not installed correctly.

**Fix:**
```bash
pip install -e ".[all]" --force-reinstall
```

### Port 8000 Already in Use

**Cause:** Another application is using port 8000.

**Fix:** Use a different port:
```bash
uvicorn vl_jepa.api.main:app --port 8001
```

### Slow Processing on CPU

**Cause:** No GPU available, using CPU fallback.

**Note:** This is expected. Processing a 1-hour video may take 10-30 minutes on CPU. For faster processing, use a machine with an NVIDIA GPU.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE_MB` | 500 | Maximum upload size |
| `RATE_LIMIT_REQUESTS` | 10 | Requests per minute |
| `JOB_TTL_SECONDS` | 3600 | Job expiration time |

### Example: Increase File Size Limit

```bash
# Windows
set MAX_FILE_SIZE_MB=500
uvicorn vl_jepa.api.main:app --port 8000

# macOS/Linux
MAX_FILE_SIZE_MB=500 uvicorn vl_jepa.api.main:app --port 8000
```

---

## Next Steps

- **Try the Cloud Demo**: https://lecture-mind.onrender.com
- **Explore the API**: http://localhost:8000/docs
- **Read the Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **CLI Usage**: `lecture-mind --help`

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/matte1782/lecture-mind/issues)
- **Discussions**: [GitHub Discussions](https://github.com/matte1782/lecture-mind/discussions)

---

*Last updated: 2026-01-09*
