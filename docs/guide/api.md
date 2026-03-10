# API Reference

Lecture Mind provides a REST API for programmatic access.

## Interactive Documentation

The API includes built-in interactive documentation:

| Tool | URL | Description |
|------|-----|-------------|
| **Swagger UI** | [/docs](/docs) | Interactive API explorer |
| **ReDoc** | [/redoc](/redoc) | Clean reference documentation |
| **OpenAPI Spec** | [/openapi.json](/openapi.json) | Machine-readable spec |

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Cloud Demo | `https://lecture-mind.onrender.com` |
| Local | `http://localhost:8000` |

---

## Quick Examples

### Health Check

```bash
curl "http://localhost:8000/api/health"
```

**Response:**
```json
{
  "status": "healthy",
  "service": "lecture-mind"
}
```

### Upload a Video

```bash
curl -X POST "http://localhost:8000/api/upload" \
  -F "file=@lecture.mp4"
```

**Response:**
```json
{
  "job_id": "abc123",
  "message": "Video uploaded successfully",
  "status": "processing"
}
```

### Check Processing Status

```bash
curl "http://localhost:8000/api/status/abc123"
```

**Response:**
```json
{
  "job_id": "abc123",
  "status": "processing",
  "progress": 0.45,
  "current_stage": "generating_transcript",
  "message": "Generating transcript..."
}
```

### Get Results

```bash
curl "http://localhost:8000/api/results/abc123"
```

**Response:**
```json
{
  "job_id": "abc123",
  "metadata": {
    "duration": 600.5,
    "fps": 30,
    "resolution": "1920x1080"
  },
  "events": [
    {"timestamp": 12.5, "type": "slide_transition"},
    {"timestamp": 45.2, "type": "scene_change"}
  ],
  "transcript": [
    {"start": 0.0, "end": 5.2, "text": "Welcome to today's lecture..."}
  ]
}
```

### Search Transcript

```bash
curl -X POST "http://localhost:8000/api/search/abc123" \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "top_k": 5}'
```

**Response:**
```json
{
  "query": "machine learning",
  "results": [
    {"timestamp": 120.5, "score": 0.89, "text": "Machine learning is..."},
    {"timestamp": 245.0, "score": 0.75, "text": "Neural networks..."}
  ],
  "total": 2
}
```

### Export Results

```bash
# Markdown
curl "http://localhost:8000/api/export/abc123/markdown"

# JSON
curl "http://localhost:8000/api/export/abc123/json"

# SRT (subtitles)
curl "http://localhost:8000/api/export/abc123/srt"
```

**Response (Markdown example):**
```json
{
  "format": "markdown",
  "content": "# Lecture Summary\n\n## Events\n\n- 0:12 - Slide transition\n...",
  "filename": "abc123_summary.md"
}
```

### Delete Job

```bash
curl -X DELETE "http://localhost:8000/api/job/abc123"
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/upload` | 10 requests per minute per IP |
| All other endpoints | No limit |

### Configuring Rate Limits

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `RATE_LIMIT_REQUESTS` | 10 | Max requests per window |
| `RATE_LIMIT_WINDOW_SECONDS` | 60 | Window duration in seconds |

```bash
# Example: Allow 20 requests per 2 minutes
RATE_LIMIT_REQUESTS=20 RATE_LIMIT_WINDOW_SECONDS=120 uvicorn vl_jepa.api.main:app
```

---

## File Size Limits

| Setting | Default | Environment Variable |
|---------|---------|---------------------|
| Maximum upload | 500MB | `MAX_FILE_SIZE_MB` |

## Supported File Formats

| Format | Extension | MIME Type |
|--------|-----------|-----------|
| MP4 | `.mp4` | `video/mp4` |
| WebM | `.webm` | `video/webm` |
| AVI | `.avi` | `video/x-msvideo` |
| MOV | `.mov` | `video/quicktime` |
| MKV | `.mkv` | `video/x-matroska` |

---

## Error Responses

All errors return JSON with this structure:

```json
{
  "detail": "Error message here"
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request (invalid input) |
| 404 | Job not found |
| 413 | File too large |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Python Client Example

```python
import httpx

BASE_URL = "http://localhost:8000"

# Upload video
with open("lecture.mp4", "rb") as f:
    response = httpx.post(
        f"{BASE_URL}/api/upload",
        files={"file": f}
    )
job_id = response.json()["job_id"]

# Poll for completion
import time
while True:
    status = httpx.get(f"{BASE_URL}/api/status/{job_id}").json()
    if status["status"] == "completed":
        break
    time.sleep(2)

# Get results
results = httpx.get(f"{BASE_URL}/api/results/{job_id}").json()
print(f"Found {len(results['events'])} events")

# Search
search = httpx.post(
    f"{BASE_URL}/api/search/{job_id}",
    json={"query": "introduction", "top_k": 3}
).json()
for r in search["results"]:
    print(f"{r['timestamp']:.1f}s: {r['text'][:50]}...")
```

---

## JavaScript Client Example

```javascript
const BASE_URL = 'http://localhost:8000';

// Upload video
const formData = new FormData();
formData.append('file', videoFile);

const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
  method: 'POST',
  body: formData
});
const { job_id } = await uploadRes.json();

// Poll for completion
while (true) {
  const statusRes = await fetch(`${BASE_URL}/api/status/${job_id}`);
  const status = await statusRes.json();
  if (status.status === 'completed') break;
  await new Promise(r => setTimeout(r, 2000));
}

// Get results
const resultsRes = await fetch(`${BASE_URL}/api/results/${job_id}`);
const results = await resultsRes.json();
console.log(`Found ${results.events.length} events`);
```

---

## Next Steps

- [Web Interface Guide](web-ui.md) - Visual interface usage
- [Local Setup](../local-setup.md) - Full installation
- [Architecture](../ARCHITECTURE.md) - Technical details
