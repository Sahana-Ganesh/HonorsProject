import cv2
import numpy as np
from typing import List, Tuple, Optional
from core.models import ScoringResult

class SharpnessScorer:
    def __init__(self):
        self.min_variance = 100
        self.max_variance = 2000
        self.upload_variances = []
        self.subject_variances = []
        
        try:
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            self.profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
            self.face_detection_enabled = True
        except:
            self.face_detection_enabled = False
            print("Face detection not available, using center-weighted analysis")

    def reset_for_upload(self):
        self.upload_variances = []
        self.subject_variances = []

    def detect_subject_regions(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        subjects = []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        h, w = gray.shape
        
        if self.face_detection_enabled:
            try:
                faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
                for (x, y, fw, fh) in faces:
                    expanded_w = int(fw * 2.5)
                    expanded_h = int(fh * 3.0)
                    expanded_x = max(0, x - fw // 4)
                    expanded_y = max(0, y - fh // 4)
                    expanded_x2 = min(w, expanded_x + expanded_w)
                    expanded_y2 = min(h, expanded_y + expanded_h)
                    subjects.append((expanded_x, expanded_y, expanded_x2 - expanded_x, expanded_y2 - expanded_y))
                
                if not subjects:
                    profiles = self.profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
                    for (x, y, pw, ph) in profiles:
                        expanded_w = int(pw * 2.5)
                        expanded_h = int(ph * 3.0)
                        expanded_x = max(0, x - pw // 4)
                        expanded_y = max(0, y - ph // 4)
                        expanded_x2 = min(w, expanded_x + expanded_w)
                        expanded_y2 = min(h, expanded_y + expanded_h)
                        subjects.append((expanded_x, expanded_y, expanded_x2 - expanded_x, expanded_y2 - expanded_y))
            except:
                pass
        
        if not subjects:
            center_w = w // 2
            center_h = int(h * 0.6)
            center_x = w // 4
            center_y = int(h * 0.15)
            subjects.append((center_x, center_y, center_w, center_h))
        
        return subjects

    def calculate_subject_background_sharpness(self, image: np.ndarray, subject_boxes: List[Tuple[int, int, int, int]]) -> Tuple[float, float, dict]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        h, w = gray.shape
        
        subject_mask = np.zeros((h, w), dtype=np.uint8)
        for x, y, box_w, box_h in subject_boxes:
            x1, y1 = max(0, x), max(0, y)
            x2, y2 = min(w, x + box_w), min(h, y + box_h)
            if x2 > x1 and y2 > y1:
                subject_mask[y1:y2, x1:x2] = 255
        
        background_mask = cv2.bitwise_not(subject_mask)
        
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        
        subject_pixels = gray[subject_mask > 0]
        subject_laplacian_pixels = laplacian[subject_mask > 0]
        subject_variance = subject_laplacian_pixels.var() if len(subject_laplacian_pixels) > 0 else 0
        
        background_pixels = gray[background_mask > 0]
        background_laplacian_pixels = laplacian[background_mask > 0]
        background_variance = background_laplacian_pixels.var() if len(background_laplacian_pixels) > 0 else 0
        
        overall_variance = laplacian.var()
        
        debug_info = {
            "subject_regions": len(subject_boxes),
            "subject_area_percent": round((np.sum(subject_mask > 0) / (w * h)) * 100, 1),
            "detection_method": "face_detection" if self.face_detection_enabled and len(subject_boxes) > 0 else "center_weighted"
        }
        
        return subject_variance, background_variance, debug_info

    def collect_variance(self, image: np.ndarray, filename: str) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        subject_boxes = self.detect_subject_regions(image)
        
        subject_variance, background_variance, _ = self.calculate_subject_background_sharpness(image, subject_boxes)
        
        overall_laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        overall_variance = overall_laplacian.var()
        
        self.upload_variances.append(overall_variance)
        self.subject_variances.append(subject_variance)
        
        return subject_variance if subject_variance > 0 else overall_variance

    def score(self, image: np.ndarray, filename: str, variance: float = None) -> ScoringResult:
        subject_boxes = self.detect_subject_regions(image)
        
        subject_variance, background_variance, detection_debug = self.calculate_subject_background_sharpness(image, subject_boxes)
        
        primary_variance = subject_variance if subject_variance > 0 else variance
        if primary_variance is None:
            primary_variance = self.collect_variance(image, filename)
        
        absolute_score = max(0.0, min(1.0, (primary_variance - self.min_variance) / (self.max_variance - self.min_variance)))
        
        relative_score = absolute_score
        tags = []
        
        if len(self.subject_variances) > 1:
            variances_to_use = [v for v in self.subject_variances if v > 0]
            if len(variances_to_use) > 1:
                percentile = np.percentile(variances_to_use, [15, 50, 85])
                
                if primary_variance >= percentile[2]:
                    relative_score = 0.85 + (primary_variance - percentile[2]) / (max(variances_to_use) - percentile[2]) * 0.15
                    tags.append("sharp")
        
        if subject_variance > 0 and background_variance > 0:
            sharpness_ratio = subject_variance / background_variance
            
            if subject_variance > self.min_variance * 2 and sharpness_ratio > 2.5:
                tags.append("high_bokeh")
                relative_score = min(1.0, relative_score * 1.05)
        
        return ScoringResult(score=relative_score, tags=tags)

    def get_debug_info(self, variance: float, image: np.ndarray = None) -> dict:
        absolute_score = max(0.0, min(1.0, (variance - self.min_variance) / (self.max_variance - self.min_variance)))
        
        debug_info = {
            "laplacian_variance": round(variance, 2),
            "absolute_score": round(absolute_score, 3),
            "upload_context": f"{len(self.upload_variances)} images" if self.upload_variances else "No context"
        }
        
        if len(self.subject_variances) > 1:
            valid_variances = [v for v in self.subject_variances if v > 0]
            if valid_variances:
                percentile_rank = (np.sum(np.array(valid_variances) <= variance) / len(valid_variances)) * 100
                debug_info["subject_percentile_rank"] = f"{round(percentile_rank, 1)}%"
        
        if image is not None:
            subject_boxes = self.detect_subject_regions(image)
            subject_var, bg_var, detection_debug = self.calculate_subject_background_sharpness(image, subject_boxes)
            
            debug_info.update({
                "subject_variance": round(subject_var, 2),
                "background_variance": round(bg_var, 2),
                "sharpness_ratio": round(subject_var / bg_var, 2) if bg_var > 0 else "N/A",
                **detection_debug
            })
        
        return debug_info