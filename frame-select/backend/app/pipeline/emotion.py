import cv2
import numpy as np
from core.models import ScoringResult

class EmotionScorer:
    def __init__(self):
        self.emotion_threshold = 0.6
        
        try:
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            self.face_detection_enabled = True
        except:
            self.face_detection_enabled = False
    
    def detect_faces_and_expressions(self, image: np.ndarray) -> float:
        if not self.face_detection_enabled:
            return 0.0
            
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        if len(faces) == 0:
            return 0.0
        
        total_emotion_score = 0.0
        
        for (x, y, w, h) in faces:
            face_roi = gray[y:y+h, x:x+w]
            
            emotion_score = self._analyze_face_emotion(face_roi)
            total_emotion_score += emotion_score
        
        avg_emotion = total_emotion_score / len(faces)
        return min(1.0, avg_emotion)
    
    def _analyze_face_emotion(self, face_roi: np.ndarray) -> float:
        if face_roi.size == 0:
            return 0.0
        
        face_resized = cv2.resize(face_roi, (64, 64))
        
        eye_region = face_resized[10:25, :]
        eye_variance = np.var(eye_region) / 1000.0
        
        mouth_region = face_resized[45:60, :]
        mouth_variance = np.var(mouth_region) / 1000.0
        
        face_contrast = np.std(face_resized) / 50.0
        
        edges = cv2.Canny(face_resized, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        emotion_score = min(1.0, (eye_variance * 0.3 + mouth_variance * 0.3 + 
                                face_contrast * 0.2 + edge_density * 0.2))
        
        return emotion_score
    
    def detect_crowd_energy(self, image: np.ndarray) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        h, w = gray.shape
        
        if self.face_detection_enabled:
            faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=3, minSize=(20, 20))
            face_density = len(faces) / ((w * h) / 10000)
        else:
            face_density = 0.0
        
        texture_energy = np.var(gray) / 5000.0
        
        edges = cv2.Canny(gray, 30, 100)
        edge_complexity = np.sum(edges > 0) / edges.size
        
        color_energy = 0.0
        if len(image.shape) == 3:
            color_vars = [np.var(image[:,:,i]) for i in range(3)]
            color_energy = np.mean(color_vars) / 5000.0
        
        crowd_score = min(1.0, (face_density * 0.4 + texture_energy * 0.3 + 
                               edge_complexity * 0.2 + color_energy * 0.1))
        
        return crowd_score
    
    def score(self, image: np.ndarray, filename: str) -> ScoringResult:
        face_emotion_score = self.detect_faces_and_expressions(image)
        
        crowd_energy_score = self.detect_crowd_energy(image)
        
        if face_emotion_score > 0:
            emotion_score = face_emotion_score * 0.8 + crowd_energy_score * 0.2
        else:
            emotion_score = crowd_energy_score
        
        final_score = max(0.0, min(1.0, emotion_score))
        
        tags = []
        
        if final_score > self.emotion_threshold:
            tags.append("high_emotion")
        
        return ScoringResult(score=final_score, tags=tags)