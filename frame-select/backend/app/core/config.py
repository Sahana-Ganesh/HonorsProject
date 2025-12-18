import os
from typing import Dict

class Settings:
    STORAGE_BASE_PATH = "app/storage"
    UPLOADS_PATH = "app/storage/uploads"
    THUMBNAILS_PATH = "app/storage/thumbs"
    RESULTS_PATH = "app/storage/results"
    
    THUMBNAIL_MAX_SIZE = 512
    ANALYSIS_MAX_SIZE = 1600
    
    SCORING_WEIGHTS: Dict[str, float] = {
        "sharpness": 0.35,
        "composition": 0.30,
        "emotion": 0.15,
        "action": 0.10,
        "duplicate": 0.10
    }
    
    DUPLICATE_DETECTION = {
        "hash_threshold": 3,
        "feature_similarity_threshold": 0.98,
        "clustering_eps": 0.05,
        "min_samples": 2,
        "enable_clustering": False,
        "enable_hash_comparison": True,
        "enable_feature_comparison": True,
        "min_duplicate_similarity": 0.99
    }
    
    MAX_WORKERS = 2
    
    SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp"}
    
    def __init__(self):
        os.makedirs(self.UPLOADS_PATH, exist_ok=True)
        os.makedirs(self.THUMBNAILS_PATH, exist_ok=True)
        os.makedirs(self.RESULTS_PATH, exist_ok=True)

settings = Settings()