# Cloud Demo

Try Lecture Mind instantly without any installation.

## Access the Demo

**URL**: [https://lecture-mind.onrender.com](https://lecture-mind.onrender.com)

## How to Use

### Step 1: Upload a Video

1. Click the "Upload Video" button
2. Select a video file from your computer
3. Supported formats: MP4, WebM, AVI, MOV, MKV
4. Maximum file size: 500MB

### Step 2: Wait for Processing

The progress bar shows the current status:

- **Extracting frames** - Sampling video frames
- **Detecting events** - Finding scene changes
- **Generating transcript** - Converting speech to text
- **Building index** - Creating searchable index

### Step 3: Explore Results

After processing, you can:

- **Events Tab**: View detected slide transitions and scene changes
- **Transcript Tab**: Read the full lecture transcript
- **Search**: Query the lecture content semantically

### Step 4: Export

Download your results in multiple formats:

- **Markdown** - For notes and documentation
- **JSON** - For programmatic access
- **SRT** - Subtitle format

---

## Demo Mode Limitations

!!! warning "Placeholder Processing"
    The cloud demo runs on Render's free tier with limited memory (512MB).
    Due to these constraints, it uses **placeholder processing** instead of real AI models.

### What This Means

| Feature | Demo Mode | Local Installation |
|---------|-----------|-------------------|
| Video upload | Works | Works |
| Frame extraction | Works | Works |
| Event detection | Placeholder | Real detection |
| Transcription | Placeholder | Whisper AI |
| Semantic search | Placeholder | Real embeddings |

### For Full Functionality

Use the [Local Setup Guide](local-setup.md) to install Lecture Mind on your own machine with:

- Real DINOv2 visual encoding
- Whisper audio transcription
- FAISS semantic search

---

## Technical Details

### Infrastructure

- **Hosting**: Render.com (Free tier)
- **Memory**: 512MB
- **Storage**: Ephemeral (files deleted on restart)
- **Cold Start**: ~30 seconds if inactive

### API Access

The demo also exposes the REST API:

- **Swagger UI**: [/docs](https://lecture-mind.onrender.com/docs)
- **ReDoc**: [/redoc](https://lecture-mind.onrender.com/redoc)

### Rate Limits

- 10 uploads per minute per IP
- 500MB maximum file size

---

## Troubleshooting

### "Service Unavailable"

The demo may be sleeping due to inactivity. Wait 30 seconds and refresh.

### "Processing Failed"

Try with a smaller video file (<50MB). Large files may timeout.

### "Slow Processing"

Free tier has limited CPU. Processing may take longer than local installation.

---

## Next Steps

Ready for the full experience?

- [Local Setup Guide](local-setup.md) - Install locally with real AI models
- [Docker Guide](DOCKER.md) - Run with Docker
