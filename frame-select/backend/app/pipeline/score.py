import numpy as np
from typing import Dict, List
from core.models import ScoringResult
from core.config import settings
from pipeline.sharpness import SharpnessScorer
from pipeline.composition import CompositionScorer
from pipeline.emotion import EmotionScorer
from pipeline.action import ActionScorer
from pipeline.duplicate import DuplicateDetector

class ScoreCalculator:
    def __init__(self):
        self.scorers = {
            "sharpness": SharpnessScorer(),
            "composition": CompositionScorer(),
            "emotion": EmotionScorer(),
            "action": ActionScorer(),
            "duplicate": DuplicateDetector()
        }
        self.weights = settings.SCORING_WEIGHTS
    
    def reset_for_upload(self):
        self.scorers["sharpness"].reset_for_upload()
        self.scorers["duplicate"].reset_for_upload()
    
    def collect_sharpness_variance(self, image: np.ndarray, filename: str) -> float:
        return self.scorers["sharpness"].collect_variance(image, filename)
    
    def score_image_with_context(self, image: np.ndarray, filename: str, variance: float) -> Dict:
        scores = {}
        all_tags = []
        debug_info = {}
        
        sharpness_result = self.scorers["sharpness"].score(image, filename, variance)
        scores["sharpness"] = sharpness_result.score
        all_tags.extend(sharpness_result.tags)
        debug_info["sharpness"] = self.scorers["sharpness"].get_debug_info(variance, image)
        
        for score_type, scorer in self.scorers.items():
            if score_type != "sharpness":
                result = scorer.score(image, filename)
                scores[score_type] = result.score
                all_tags.extend(result.tags)
        
        final_score = sum(
            scores[score_type] * self.weights[score_type]
            for score_type in scores
        )
        
        unique_tags = list(set(all_tags))
        
        return {
            "final_score": final_score,
            "scores": scores,
            "tags": unique_tags,
            "debug_info": debug_info
        }
    
    def score_image(self, image: np.ndarray, filename: str) -> Dict:
        scores = {}
        all_tags = []
        
        for score_type, scorer in self.scorers.items():
            result = scorer.score(image, filename)
            scores[score_type] = result.score
            all_tags.extend(result.tags)
        
        final_score = sum(
            scores[score_type] * self.weights[score_type]
            for score_type in scores
        )
        
        unique_tags = list(set(all_tags))
        
        return {
            "final_score": final_score,
            "scores": scores,
            "tags": unique_tags
        }
    
    def finalize_duplicate_analysis(self) -> Dict:
        """Finalize duplicate detection after all images are processed."""
        return self.scorers["duplicate"].analyze_all_images()
    
    def get_duplicate_report(self) -> Dict:
        """Get comprehensive duplicate detection report."""
        return self.scorers["duplicate"].get_duplicate_report()