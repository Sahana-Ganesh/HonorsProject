import os
import sys
import uuid
import asyncio
import threading
import zipfile
import tempfile
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

sys.path.append(os.path.dirname(__file__))

from core.config import settings
from core.models import UploadResponse, AnalyzeResponse, JobStatus, ResultsResponse
from services.storage import StorageService
from services.analyze import AnalysisService

app = FastAPI(title="Frame Select API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage_service = StorageService()
analysis_service = AnalysisService(storage_service)

jobs = {}

@app.get("/health")
async def health_check():
    return {"ok": True}

@app.post("/upload", response_model=UploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")
    
    upload_id = str(uuid.uuid4())
    
    try:
        saved_count = await storage_service.save_uploaded_files(upload_id, files)
        
        return UploadResponse(upload_id=upload_id, count=saved_count)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/analyze/{upload_id}", response_model=AnalyzeResponse)
async def analyze_images(upload_id: str, background_tasks: BackgroundTasks):
    if not storage_service.upload_exists(upload_id):
        raise HTTPException(status_code=404, detail="Upload ID not found")
    
    job_id = str(uuid.uuid4())
    
    jobs[job_id] = {
        "status": "queued",
        "progress": 0.0,
        "upload_id": upload_id,
        "error": None
    }
    
    background_tasks.add_task(run_analysis_job, job_id, upload_id)
    
    return AnalyzeResponse(job_id=job_id, upload_id=upload_id, status="queued")

@app.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatus(**jobs[job_id])

@app.get("/results/{upload_id}", response_model=ResultsResponse)
async def get_results(upload_id: str):
    try:
        results = analysis_service.load_results(upload_id)
        return results
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, 
            detail="Results not found. Run analysis first."
        )

@app.get("/image/{upload_id}/{filename}")
async def get_image(upload_id: str, filename: str):
    file_path = storage_service.get_image_path(upload_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(file_path)

@app.get("/thumb/{upload_id}/{filename}")
async def get_thumbnail(upload_id: str, filename: str):
    file_path = storage_service.get_thumbnail_path(upload_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    return FileResponse(file_path)

@app.post("/export/{upload_id}")
async def export_selected_images(upload_id: str, image_ids: List[str]):
    if not storage_service.upload_exists(upload_id):
        raise HTTPException(status_code=404, detail="Upload ID not found")
    
    if not image_ids:
        raise HTTPException(status_code=400, detail="No images selected for export")
    
    available_images = storage_service.get_image_files(upload_id)
    invalid_images = [img for img in image_ids if img not in available_images]
    if invalid_images:
        raise HTTPException(
            status_code=400, 
            detail=f"Images not found: {', '.join(invalid_images)}"
        )
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
        temp_zip_path = temp_zip.name
    
    try:
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for image_id in image_ids:
                image_path = storage_service.get_image_path(upload_id, image_id)
                if os.path.exists(image_path):
                    zip_file.write(image_path, image_id)
        
        zip_filename = f"frame_select_export_{upload_id[:8]}_{len(image_ids)}_images.zip"
        
        return FileResponse(
            path=temp_zip_path,
            filename=zip_filename,
            media_type='application/zip',
            background=BackgroundTasks().add_task(cleanup_temp_file, temp_zip_path)
        )
        
    except Exception as e:
        if os.path.exists(temp_zip_path):
            os.unlink(temp_zip_path)
        raise HTTPException(status_code=500, detail=f"Failed to create ZIP: {str(e)}")

def cleanup_temp_file(file_path: str):
    try:
        if os.path.exists(file_path):
            os.unlink(file_path)
    except Exception as e:
        print(f"Failed to cleanup temp file {file_path}: {e}")

def run_analysis_job(job_id: str, upload_id: str):
    try:
        jobs[job_id]["status"] = "running"
        
        def progress_callback(progress: float):
            jobs[job_id]["progress"] = progress
        
        analysis_service.analyze_upload(upload_id, progress_callback)
        
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 1.0
        
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        reload_exclude=["storage"]
    )