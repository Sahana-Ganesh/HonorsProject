import os
import json
import cv2
import numpy as np
from typing import Callable, Optional
from PIL import Image
from core.config import settings
from core.models import ResultsResponse, ImageScore, DuplicateReport, DuplicateGroup
from pipeline.score import ScoreCalculator
from services.storage import StorageService

class AnalysisService:
    def __init__(self, storage_service: StorageService):
        self.storage = storage_service
        self.score_calculator = ScoreCalculator()
    
    def analyze_upload(self, upload_id: str, progress_callback: Optional[Callable[[float], None]] = None):
        image_files = self.storage.get_image_files(upload_id)
        if not image_files:
            raise ValueError("No images found for upload")
        
        self.score_calculator.reset_for_upload()
        
        variances = []
        images_data = []
        
        for i, filename in enumerate(image_files):
            try:
                image_path = self.storage.get_image_path(upload_id, filename)
                image = self._load_and_resize_image(image_path)
                
                variance = self.score_calculator.collect_sharpness_variance(image, filename)
                variances.append(variance)
                images_data.append((filename, image, variance))
                
                progress = (i + 1) / len(image_files) * 0.3
                if progress_callback:
                    progress_callback(progress)
                    
            except Exception as e:
                print(f"Failed to load {filename}: {e}")
                continue
        
        duplicate_analysis = self.score_calculator.finalize_duplicate_analysis()
        
        results = []
        
        for i, (filename, image, variance) in enumerate(images_data):
            try:
                score_data = self.score_calculator.score_image_with_context(image, filename, variance)
                
                rank = i + 1
                
                image_result = ImageScore(
                    image_id=filename,
                    final_score=score_data["final_score"],
                    tags=score_data["tags"],
                    scores=score_data["scores"],
                    rank=rank,
                    debug_info=score_data.get("debug_info", {})
                )
                
                results.append(image_result)
                
                progress = 0.3 + (i + 1) / len(images_data) * 0.6
                if progress_callback:
                    progress_callback(progress)
                
                self._save_partial_results(upload_id, results)
                
            except Exception as e:
                print(f"Failed to analyze {filename}: {e}")
                continue
        
        duplicate_report_data = self.score_calculator.get_duplicate_report()
        duplicate_report = self._create_duplicate_report(duplicate_report_data)
        
        results.sort(key=lambda x: x.final_score, reverse=True)
        for i, result in enumerate(results):
            result.rank = i + 1
        
        upload_metadata = {
            "total_images": len(results),
            "scoring_method": "percentile_based_with_duplicates",
            "calibration_note": "",
            "duplicate_summary": duplicate_analysis
        }
        
        final_results = ResultsResponse(
            upload_id=upload_id, 
            images=results,
            metadata=upload_metadata,
            duplicate_report=duplicate_report
        )
        self._save_results(upload_id, final_results)
        
        if progress_callback:
            progress_callback(1.0)
        
        return final_results
    
    def _create_duplicate_report(self, duplicate_data: dict) -> DuplicateReport:
        groups = []
        for group_data in duplicate_data.get("groups", []):
            group = DuplicateGroup(
                group_id=group_data["group_id"],
                images=group_data["images"],
                count=group_data["count"],
                recommended_keep=group_data.get("recommended_keep")
            )
            groups.append(group)
        
        return DuplicateReport(
            summary=duplicate_data.get("summary", {}),
            groups=groups,
            recommendations=duplicate_data.get("recommendations", [])
        )
    
    def load_results(self, upload_id: str) -> ResultsResponse:
        results_path = self.storage.get_results_path(upload_id)
        
        if not os.path.exists(results_path):
            raise FileNotFoundError(f"Results not found for upload {upload_id}")
        
        with open(results_path, 'r') as f:
            data = json.load(f)
        
        return ResultsResponse(**data)
    
    def _load_and_resize_image(self, image_path: str) -> np.ndarray:
        with Image.open(image_path) as pil_img:
            if pil_img.mode != 'RGB':
                pil_img = pil_img.convert('RGB')
            
            max_size = settings.ANALYSIS_MAX_SIZE
            if max(pil_img.size) > max_size:
                pil_img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            img_array = np.array(pil_img)
            
            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            return img_bgr
    
    def _save_partial_results(self, upload_id: str, results: list):
        results_data = {
            "upload_id": upload_id,
            "images": [result.dict() for result in results]
        }
        
        results_path = self.storage.get_results_path(upload_id)
        with open(results_path, 'w') as f:
            json.dump(results_data, f, indent=2)
    
    def _save_results(self, upload_id: str, results: ResultsResponse):
        results_path = self.storage.get_results_path(upload_id)
        with open(results_path, 'w') as f:
            json.dump(results.dict(), f, indent=2)