# Web Interface Guide

Complete guide to using the Lecture Mind web interface.

## Overview

The web interface provides a simple way to:

- Upload lecture videos
- View processing progress in real-time
- Explore detected events and transcript
- Search lecture content semantically
- Export results in multiple formats

---

## Uploading Videos

### Supported Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| MP4 | `.mp4` | Recommended |
| WebM | `.webm` | Good for web |
| AVI | `.avi` | Legacy support |
| MOV | `.mov` | Apple format |
| MKV | `.mkv` | Open format |

### File Size Limits

- **Maximum**: 500MB
- **Recommended**: Under 50MB for faster processing

### Upload Process

1. Click **"Upload Video"** or drag-and-drop
2. Select your video file
3. Wait for upload to complete
4. Processing begins automatically

---

## Processing Stages

The progress bar shows the current processing stage:

| Stage | Description | Time Estimate |
|-------|-------------|---------------|
| Extracting frames | Sampling video at 1 FPS | Fast |
| Detecting events | Finding scene changes | Fast |
| Generating transcript | Speech-to-text | Slow (CPU) |
| Building index | Creating search index | Fast |

!!! tip "Processing Time"
    A 10-minute video typically takes 2-5 minutes to process locally.
    Cloud demo may be slower due to resource limits.

---

## Viewing Results

### Events Tab

Shows detected events in the video:

- **Slide transitions** - When slides change
- **Scene changes** - Major visual changes
- **Timestamps** - Click to see context

### Transcript Tab

Full text transcript of the lecture:

- Organized by timestamp
- Searchable
- Click timestamps to navigate

### Search

Semantic search across the lecture:

1. Enter your query (e.g., "machine learning basics")
2. Press Enter or click Search
3. Results ranked by relevance
4. Click results to see context

---

## Exporting Results

### Available Formats

| Format | Best For | Extension |
|--------|----------|-----------|
| Markdown | Notes, documentation | `.md` |
| JSON | Programmatic access | `.json` |
| SRT | Subtitles | `.srt` |

### Export Process

1. Click the **Export** dropdown
2. Select desired format
3. File downloads automatically

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Close dialogs and modals |
| `Ctrl+Enter` | Submit note (in notes panel) |
| `1` - `4` | Jump to bookmarked segments |

---

## Tips and Best Practices

### For Best Results

1. **Use clear audio** - Better transcription accuracy
2. **Good lighting** - Better event detection
3. **Smaller files** - Faster processing

### Troubleshooting

**Video not playing in preview?**

- Try a different browser (Chrome recommended)
- Ensure video codec is supported

**Search not finding content?**

- Try different keywords
- Use phrases, not single words
- Check if transcript was generated correctly

**Export not working?**

- Ensure processing is complete
- Check browser download settings

---

## Next Steps

- [API Reference](api.md) - Programmatic access
- [Local Setup](../local-setup.md) - Full installation
- [Architecture](../ARCHITECTURE.md) - Technical details
