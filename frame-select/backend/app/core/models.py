from typing import List, Dict, Optional
from pydantic import BaseModel

class UploadResponse(BaseModel):
    upload_id: str
    count: int

class AnalyzeResponse(BaseModel):
    job_id: str
    upload_id: str
    status: str

class JobStatus(BaseModel):
    status: str
    progress: float
    upload_id: str
    error: Optional[str] = None

class ImageScore(BaseModel):
    image_id: str
    final_score: float
    tags: List[str]
    scores: Dict[str, float]
    rank: Optional[int] = None
    debug_info: Optional[Dict] = None

class DuplicateGroup(BaseModel):
    group_id: int
    images: List[str]
    count: int
    recommended_keep: Optional[str] = None

class DuplicateReport(BaseModel):
    summary: Dict
    groups: List[DuplicateGroup]
    recommendations: List[str]

class ResultsResponse(BaseModel):
    upload_id: str
    images: List[ImageScore]
    metadata: Optional[Dict] = None
    duplicate_report: Optional[DuplicateReport] = None

class ScoringResult(BaseModel):
    score: float
    tags: List[str]