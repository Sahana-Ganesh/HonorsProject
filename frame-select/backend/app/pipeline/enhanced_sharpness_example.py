import cv2
import numpy as np
from typing import List, Tuple, Optional
from core.models import ScoringResult

class EnhancedSharpnessScorer:
    def __init__(self):
        self.min_variance = 100
        self.max_variance = 2000
        self.upload_variances = []
    
    def detect_subject_regions(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        subjects = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        h, w = gray.shape
        center_region = (w//4, h//4, w//2, h//2)
        subjects.append(center_region)
        
        return subjects
    
    def calculate_subject_sharpness(self, image: np.ndarray, subject_boxes: List[Tuple[int, int, int, int]]) -> Tuple[float, float]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        h, w = gray.shape
        
        subject_mask = np.zeros((h, w), dtype=np.uint8)
        for x, y, box_w, box_h in subject_boxes:
            subject_mask[y:y+box_h, x:x+box_w] = 255
        
        background_mask = cv2.bitwise_not(subject_mask)
        
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        
        subject_laplacian = cv2.bitwise_and(laplacian, laplacian, mask=subject_mask)
        subject_variance = subject_laplacian.var() if np.any(subject_mask) else 0
        
        background_laplacian = cv2.bitwise_and(laplacian, laplacian, mask=background_mask)
        background_variance = background_laplacian.var() if np.any(background_mask) else 0
        
        return subject_variance, background_variance
    
    def score_with_subject_focus(self, image: np.ndarray, filename: str) -> ScoringResult:
        subject_boxes = self.detect_subject_regions(image)
        
        if not subject_boxes:
            return self.score(image, filename)
        
        subject_sharpness, background_sharpness = self.calculate_subject_sharpness(image, subject_boxes)
        
        self.upload_variances.append(subject_sharpness)
        
        subject_score = max(0.0, min(1.0, (subject_sharpness - self.min_variance) / (self.max_variance - self.min_variance)))
        background_score = max(0.0, min(1.0, (background_sharpness - self.min_variance) / (self.max_variance - self.min_variance)))
        
        tags = []
        
        if subject_score > 0.7:
            tags.append("sharp_subject")
        elif subject_score < 0.3:
            tags.append("blurry_subject")
            
        if subject_score > 0.6 and background_score < 0.4:
            tags.append("good_bokeh")
            
        final_score = subject_score
        
        if "good_bokeh" in tags:
            final_score = min(1.0, final_score * 1.1)
        
        return ScoringResult(score=final_score, tags=tags)