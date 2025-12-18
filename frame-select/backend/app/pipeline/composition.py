import cv2
import numpy as np
from core.models import ScoringResult

class CompositionScorer:
    def __init__(self):
        self.b_roll_threshold = 0.4
        
        try:
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            self.face_detection_enabled = True
        except:
            self.face_detection_enabled = False
    
    def detect_crowd_and_audience(self, image: np.ndarray) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        h, w = gray.shape
        
        crowd_indicators = 0.0
        
        if self.face_detection_enabled:
            faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=2, minSize=(15, 15))
            face_density = len(faces) / ((w * h) / 10000)
            
            if len(faces) >= 3:
                crowd_indicators += min(1.0, face_density * 0.3)
        
        horizontal_kernel = np.array([[-1, -1, -1], [2, 2, 2], [-1, -1, -1]])
        horizontal_response = cv2.filter2D(gray.astype(np.float32), -1, horizontal_kernel)
        horizontal_energy = np.mean(np.abs(horizontal_response)) / 100.0
        
        crowd_indicators += min(0.3, horizontal_energy)
        
        return min(1.0, crowd_indicators)
    
    def detect_non_game_elements(self, image: np.ndarray) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        h, w = gray.shape
        
        non_game_score = 0.0
        
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < 500:
            non_game_score += 0.3
        
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        if 0.05 < edge_density < 0.15:
            non_game_score += 0.2
        
        kernel = np.ones((20, 20), np.float32) / 400
        local_mean = cv2.filter2D(gray.astype(np.float32), -1, kernel)
        local_variance = cv2.filter2D((gray.astype(np.float32) - local_mean)**2, -1, kernel)
        uniform_areas = np.sum(local_variance < 100) / (h * w)
        
        if uniform_areas > 0.4:
            non_game_score += 0.3
        
        return min(1.0, non_game_score)
    
    def detect_equipment_and_facilities(self, image: np.ndarray) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        contours, _ = cv2.findContours(cv2.Canny(gray, 50, 150), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        rectangular_objects = 0
        for contour in contours:
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            if len(approx) == 4:
                area = cv2.contourArea(contour)
                if 1000 < area < 50000:
                    rectangular_objects += 1
        
        equipment_score = min(0.5, rectangular_objects * 0.1)
        
        return equipment_score
    
    def score(self, image: np.ndarray, filename: str) -> ScoringResult:
        crowd_score = self.detect_crowd_and_audience(image)
        
        non_game_score = self.detect_non_game_elements(image)
        
        equipment_score = self.detect_equipment_and_facilities(image)
        
        b_roll_score = min(1.0, (crowd_score * 0.5 + non_game_score * 0.3 + equipment_score * 0.2))
        
        final_score = max(0.0, min(1.0, b_roll_score))
        
        tags = []
        
        if final_score > self.b_roll_threshold:
            tags.append("B_roll")
        
        return ScoringResult(score=final_score, tags=tags)