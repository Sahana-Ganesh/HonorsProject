# Frame Select Backend

AI-assisted sports photography frame selection API built with FastAPI.

## Setup

### Prerequisites
- Python 3.11+
- pip

### Installation

1. Create and activate virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment (optional):
```bash
cp .env.example .env
# Edit .env if needed
```

### Running the Server

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --reload-exclude storage --port 8000

# Or run directly
python -m app.main
```

The API will be available at:
- Main API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

- `GET /health` - Health check
- `POST /upload` - Upload image files
- `POST /analyze/{upload_id}` - Start analysis job
- `GET /jobs/{job_id}` - Get job status and progress
- `GET /results/{upload_id}` - Get analysis results
- `GET /image/{upload_id}/{filename}` - Serve original image
- `GET /thumb/{upload_id}/{filename}` - Serve thumbnail

## Architecture

- **Pipeline**: Modular scoring system (sharpness, composition, emotion, action)
- **Storage**: File management with thumbnail generation
- **Analysis**: Async job processing with progress tracking
- **Performance**: Memory-safe processing for large uploads

## Storage Structure

```
app/storage/
├── uploads/{upload_id}/     # Original images
├── thumbs/{upload_id}/      # Generated thumbnails
└── results/{upload_id}.json # Analysis results
```