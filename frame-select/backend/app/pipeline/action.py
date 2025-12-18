import cv2
import numpy as np
from core.models import ScoringResult

class ActionScorer:
    def __init__(self):
        self.motion_threshold = 0.15
        
    def detect_motion_blur(self, image: np.ndarray) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
        
        kernel_h = np.array([[-1, -1, -1], [2, 2, 2], [-1, -1, -1]])
        kernel_v = np.array([[-1, 2, -1], [-1, 2, -1], [-1, 2, -1]])
        
        motion_h = cv2.filter2D(gray.astype(np.float32), -1, kernel_h)
        motion_v = cv2.filter2D(gray.astype(np.float32), -1, kernel_v)
        
        motion_energy = np.sqrt(motion_h**2 + motion_v**2)
        motion_score = np.mean(motion_energy) / 255.0
        
        gradient_variance = np.var(gradient_magnitude) / 10000.0
        
        action_intensity = min(1.0, (motion_score * 0.6 + gradient_variance * 0.4))
        
        return action_intensity
    
    def detect_dynamic_elements(self, image: np.ndarray) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        texture_variance = np.var(gray) / 10000.0
        
        dynamic_score = min(1.0, (edge_density * 2.0 + texture_variance))
        
        return dynamic_score
    
    def score(self, image: np.ndarray, filename: str) -> ScoringResult:
        motion_intensity = self.detect_motion_blur(image)
        
        dynamic_score = self.detect_dynamic_elements(image)
        
        action_score = (motion_intensity * 0.7 + dynamic_score * 0.3)
        
        final_score = max(0.0, min(1.0, action_score))
        
        tags = []
        
        if final_score > self.motion_threshold:
            tags.append("high_action")
        
        return ScoringResult(score=final_score, tags=tags)