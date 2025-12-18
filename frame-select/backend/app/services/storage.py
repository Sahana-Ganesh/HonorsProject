import os
import shutil
from typing import List
from pathlib import Path
from PIL import Image
from fastapi import UploadFile
from core.config import settings
from core.utils import ensure_dir, is_image_file, safe_filename

class StorageService:
    def __init__(self):
        ensure_dir(settings.UPLOADS_PATH)
        ensure_dir(settings.THUMBNAILS_PATH)
        ensure_dir(settings.RESULTS_PATH)
    
    async def save_uploaded_files(self, upload_id: str, files: List[UploadFile]) -> int:
        upload_dir = os.path.join(settings.UPLOADS_PATH, upload_id)
        thumb_dir = os.path.join(settings.THUMBNAILS_PATH, upload_id)
        
        ensure_dir(upload_dir)
        ensure_dir(thumb_dir)
        
        saved_count = 0
        
        for file in files:
            if not is_image_file(file.filename):
                continue
            
            safe_name = safe_filename(file.filename)
            
            file_path = os.path.join(upload_dir, safe_name)
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            try:
                self._generate_thumbnail(file_path, thumb_dir, safe_name)
                saved_count += 1
            except Exception as e:
                os.remove(file_path)
                print(f"Failed to process {safe_name}: {e}")
        
        return saved_count
    
    def _generate_thumbnail(self, image_path: str, thumb_dir: str, filename: str):
        with Image.open(image_path) as img:
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            img.thumbnail((settings.THUMBNAIL_MAX_SIZE, settings.THUMBNAIL_MAX_SIZE), Image.Resampling.LANCZOS)
            
            thumb_path = os.path.join(thumb_dir, filename)
            img.save(thumb_path, 'JPEG', quality=85, optimize=True)
    
    def upload_exists(self, upload_id: str) -> bool:
        upload_dir = os.path.join(settings.UPLOADS_PATH, upload_id)
        return os.path.exists(upload_dir) and os.path.isdir(upload_dir)
    
    def get_image_files(self, upload_id: str) -> List[str]:
        upload_dir = os.path.join(settings.UPLOADS_PATH, upload_id)
        if not os.path.exists(upload_dir):
            return []
        
        files = []
        for filename in os.listdir(upload_dir):
            if is_image_file(filename):
                files.append(filename)
        
        return sorted(files)
    
    def get_image_path(self, upload_id: str, filename: str) -> str:
        return os.path.join(settings.UPLOADS_PATH, upload_id, filename)
    
    def get_thumbnail_path(self, upload_id: str, filename: str) -> str:
        return os.path.join(settings.THUMBNAILS_PATH, upload_id, filename)
    
    def get_results_path(self, upload_id: str) -> str:
        return os.path.join(settings.RESULTS_PATH, f"{upload_id}.json")