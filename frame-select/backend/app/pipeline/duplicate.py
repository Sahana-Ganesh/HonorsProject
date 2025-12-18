import cv2
import numpy as np
import imagehash
from PIL import Image
from typing import List, Dict, Tuple, Set
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity
from ultralytics import YOLO
import torch
from core.models import ScoringResult
from core.config import settings
import logging

logger = logging.getLogger(__name__)

class DuplicateDetector:
    def __init__(self):
        self.model = YOLO('yolov8n.pt')
        self.config = settings.DUPLICATE_DETECTION
        self.image_features = {}
        self.image_hashes = {}
        self.duplicate_groups = []
        self.processed_images = set()
        
    def reset_for_upload(self):
        self.image_features.clear()
        self.image_hashes.clear()
        self.duplicate_groups.clear()
        self.processed_images.clear()
        
    def extract_yolo_features(self, image: np.ndarray) -> np.ndarray:
        try:
            results = self.model(image, verbose=False)
            
            if not results or len(results) == 0 or len(results[0].boxes) == 0:
                logger.info("No objects detected, using statistical features")
                return self._extract_statistical_features(image)
            
            detections = results[0]
            
            detection_features = []
            if detections.boxes is not None:
                boxes = detections.boxes.xyxy.cpu().numpy()
                confidences = detections.boxes.conf.cpu().numpy()
                classes = detections.boxes.cls.cpu().numpy()
                
                top_indices = np.argsort(confidences)[-5:]
                
                for idx in top_indices:
                    box = boxes[idx] / [image.shape[1], image.shape[0], image.shape[1], image.shape[0]]
                    detection_features.extend([
                        box[0], box[1], box[2], box[3],
                        confidences[idx],
                        classes[idx],
                        (box[2] - box[0]) * (box[3] - box[1]),
                        (box[0] + box[2]) / 2,
                        (box[1] + box[3]) / 2,
                        (box[2] - box[0]) / (box[3] - box[1]) if (box[3] - box[1]) > 0 else 0
                    ])
                
                while len(detection_features) < 50:
                    detection_features.append(0.0)
            
            stat_features = self._extract_enhanced_statistical_features(image)
            combined_features = np.concatenate([detection_features[:50], stat_features])
            
            return combined_features
                
        except Exception as e:
            logger.warning(f"YOLO feature extraction failed: {e}")
            return self._extract_enhanced_statistical_features(image)
    
    def _extract_enhanced_statistical_features(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        features = []
        features.extend([
            np.mean(gray), np.std(gray), np.min(gray), np.max(gray),
            np.median(gray), np.percentile(gray, 25), np.percentile(gray, 75),
            np.var(gray), len(np.unique(gray))
        ])
        
        for i in range(3):
            hist = cv2.calcHist([image], [i], None, [16], [0, 256])
            features.extend(hist.flatten().tolist())
        
        edges = cv2.Canny(gray, 50, 150)
        features.extend([
            np.sum(edges), np.mean(edges), np.std(edges),
            cv2.Laplacian(gray, cv2.CV_64F).var()
        ])
        
        h, w = gray.shape
        for i in range(2):
            for j in range(2):
                region = gray[i*h//2:(i+1)*h//2, j*w//2:(j+1)*w//2]
                features.append(np.mean(region))
                features.append(np.std(region))
        
        return np.array(features)
    
    def _extract_statistical_features(self, image: np.ndarray) -> np.ndarray:
        return self._extract_enhanced_statistical_features(image)
    
    def calculate_perceptual_hash(self, image: np.ndarray) -> str:
        try:
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_image)
            
            dhash = imagehash.dhash(pil_image)
            phash = imagehash.phash(pil_image)
            ahash = imagehash.average_hash(pil_image)
            
            combined_hash = str(dhash) + str(phash) + str(ahash)
            return combined_hash
            
        except Exception as e:
            logger.warning(f"Hash calculation failed: {e}")
            return ""
    
    def hash_distance(self, hash1: str, hash2: str) -> int:
        if len(hash1) != len(hash2):
            return float('inf')
        
        return sum(c1 != c2 for c1, c2 in zip(hash1, hash2))
    
    def process_image(self, image: np.ndarray, filename: str) -> None:
        if filename in self.processed_images:
            return
            
        try:
            features = self.extract_yolo_features(image)
            self.image_features[filename] = features
            
            img_hash = self.calculate_perceptual_hash(image)
            self.image_hashes[filename] = img_hash
            
            self.processed_images.add(filename)
            
        except Exception as e:
            logger.error(f"Error processing image {filename}: {e}")
    
    def find_duplicates_by_hash(self) -> List[List[str]]:
        if not self.config["enable_hash_comparison"]:
            return []
            
        duplicate_groups = []
        processed = set()
        
        filenames = list(self.image_hashes.keys())
        
        for i, filename1 in enumerate(filenames):
            if filename1 in processed:
                continue
                
            group = [filename1]
            hash1 = self.image_hashes[filename1]
            
            for filename2 in filenames[i+1:]:
                if filename2 in processed:
                    continue
                    
                hash2 = self.image_hashes[filename2]
                distance = self.hash_distance(hash1, hash2)
                
                if distance <= self.config["hash_threshold"]:
                    group.append(filename2)
                    processed.add(filename2)
            
            if len(group) > 1:
                duplicate_groups.append(group)
                for filename in group:
                    processed.add(filename)
        
        return duplicate_groups
    
    def find_duplicates_by_features(self) -> List[List[str]]:
        if not self.config["enable_feature_comparison"]:
            return []
            
        if len(self.image_features) < 2:
            return []
        
        filenames = list(self.image_features.keys())
        features_matrix = np.array([self.image_features[f] for f in filenames])
        
        similarity_matrix = cosine_similarity(features_matrix)
        
        duplicate_groups = []
        processed = set()
        
        logger.info(f"Feature similarity analysis for {len(filenames)} images:")
        
        for i, filename1 in enumerate(filenames):
            if filename1 in processed:
                continue
                
            potential_group = [filename1]
            
            for j, filename2 in enumerate(filenames[i+1:], i+1):
                if filename2 in processed:
                    continue
                    
                similarity = similarity_matrix[i][j]
                
                logger.info(f"Similarity between {filename1} and {filename2}: {similarity:.3f}")
                
                threshold = self.config.get("min_duplicate_similarity", 0.99)
                if similarity >= threshold:
                    potential_group.append(filename2)
            
            if len(potential_group) > 1:
                valid_group = self._comprehensive_duplicate_validation(potential_group)
                if valid_group and len(valid_group) > 1:
                    duplicate_groups.append(valid_group)
                    for filename in valid_group:
                        processed.add(filename)
                    logger.info(f"Confirmed duplicate group: {valid_group}")
                else:
                    logger.info(f"Rejected potential duplicate group: {potential_group}")
        
        logger.info(f"Found {len(duplicate_groups)} feature-based duplicate groups")
        return duplicate_groups
    
    def _comprehensive_duplicate_validation(self, group: List[str]) -> List[str]:
        if len(group) < 2:
            return group
        
        group_features = [self.image_features[filename] for filename in group]
        
        similarities = []
        for i in range(len(group_features)):
            for j in range(i + 1, len(group_features)):
                sim = cosine_similarity([group_features[i]], [group_features[j]])[0][0]
                similarities.append(sim)
        
        min_similarity = min(similarities) if similarities else 0
        avg_similarity = np.mean(similarities) if similarities else 0
        
        if min_similarity < 0.99 or avg_similarity < 0.995:
            logger.info(f"Rejecting group - min_sim: {min_similarity:.3f}, avg_sim: {avg_similarity:.3f}")
            return []
        
        group_hashes = [self.image_hashes.get(filename, "") for filename in group]
        if all(group_hashes):
            hash_distances = []
            for i in range(len(group_hashes)):
                for j in range(i + 1, len(group_hashes)):
                    dist = self.hash_distance(group_hashes[i], group_hashes[j])
                    hash_distances.append(dist)
            
            if hash_distances:
                max_hash_distance = max(hash_distances)
                if max_hash_distance > 5:
                    logger.info(f"Rejecting group - max hash distance: {max_hash_distance}")
                    return []
        
        if len(group) > 4:
            logger.info(f"Rejecting group - too large: {len(group)} images")
            return []
        
        return group
    
    def find_duplicates_by_clustering(self) -> List[List[str]]:
        if not self.config["enable_clustering"] or len(self.image_features) < 2:
            return []
        
        filenames = list(self.image_features.keys())
        features_matrix = np.array([self.image_features[f] for f in filenames])
        
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        normalized_features = scaler.fit_transform(features_matrix)
        
        dbscan = DBSCAN(
            eps=self.config["clustering_eps"],
            min_samples=self.config["min_samples"],
            metric='cosine'
        )
        
        cluster_labels = dbscan.fit_predict(normalized_features)
        
        clusters = {}
        for filename, label in zip(filenames, cluster_labels):
            if label != -1:
                if label not in clusters:
                    clusters[label] = []
                clusters[label].append(filename)
        
        return [group for group in clusters.values() if len(group) > 1]
    
    def analyze_all_images(self) -> Dict:
        hash_groups = self.find_duplicates_by_hash()
        feature_groups = self.find_duplicates_by_features()
        cluster_groups = self.find_duplicates_by_clustering()
        
        all_groups = hash_groups + feature_groups + cluster_groups
        
        merged_groups = self._merge_overlapping_groups(all_groups)
        
        self.duplicate_groups = merged_groups
        
        return {
            "duplicate_groups": merged_groups,
            "hash_groups": len(hash_groups),
            "feature_groups": len(feature_groups),
            "cluster_groups": len(cluster_groups),
            "total_duplicates": sum(len(group) for group in merged_groups),
            "unique_images": len(self.processed_images) - sum(len(group) - 1 for group in merged_groups)
        }
    
    def _merge_overlapping_groups(self, groups: List[List[str]]) -> List[List[str]]:
        if not groups:
            return []
        
        merged = []
        used_images = set()
        
        for group in groups:
            if any(img in used_images for img in group):
                for i, existing_group in enumerate(merged):
                    if any(img in existing_group for img in group):
                        merged[i] = list(set(existing_group + group))
                        break
            else:
                merged.append(group)
                used_images.update(group)
        
        return merged
    
    def score_image(self, image: np.ndarray, filename: str) -> ScoringResult:
        self.process_image(image, filename)
        
        is_duplicate = False
        duplicate_score = 1.0
        tags = []
        
        for group in self.duplicate_groups:
            if filename in group:
                is_duplicate = True
                position = group.index(filename)
                duplicate_score = max(0.1, 1.0 - (position * 0.3))
                tags.append(f"duplicate_group_{len(group)}")
                if position == 0:
                    tags.append("duplicate_primary")
                else:
                    tags.append("duplicate_secondary")
                break
        
        if not is_duplicate:
            tags.append("unique")
            duplicate_score = 1.0
        
        return ScoringResult(score=duplicate_score, tags=tags)
    
    def get_duplicate_report(self) -> Dict:
        analysis = self.analyze_all_images()
        
        report = {
            "summary": analysis,
            "groups": [],
            "recommendations": []
        }
        
        for i, group in enumerate(self.duplicate_groups):
            group_info = {
                "group_id": i,
                "images": group,
                "count": len(group),
                "recommended_keep": group[0] if group else None
            }
            report["groups"].append(group_info)
        
        total_images = len(self.processed_images)
        duplicate_images = sum(len(group) - 1 for group in self.duplicate_groups)
        
        if duplicate_images > 0:
            report["recommendations"].append(
                f"Found {duplicate_images} duplicate images out of {total_images} total images."
            )
            report["recommendations"].append(
                f"Consider keeping only the primary image from each duplicate group to save {duplicate_images} images."
            )
        else:
            report["recommendations"].append("No duplicates found. All images appear to be unique.")
        
        return report

    def score(self, image: np.ndarray, filename: str) -> ScoringResult:
        return self.score_image(image, filename)