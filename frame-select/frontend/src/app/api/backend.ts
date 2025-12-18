const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface UploadResponse {
  upload_id: string;
  count: number;
}

export interface AnalyzeResponse {
  job_id: string;
  upload_id: string;
  status: string;
}

export interface JobStatus {
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  upload_id: string;
  error?: string;
}

export interface ImageScore {
  image_id: string;
  final_score: number;
  tags: string[];
  scores: {
    sharpness: number;
    composition: number;
    emotion: number;
    action: number;
    duplicate: number;
  };
  rank?: number;
  debug_info?: any;
}

export interface DuplicateGroup {
  group_id: number;
  images: string[];
  count: number;
  recommended_keep?: string;
}

export interface DuplicateReport {
  summary: {
    duplicate_groups: string[][];
    hash_groups: number;
    feature_groups: number;
    cluster_groups: number;
    total_duplicates: number;
    unique_images: number;
  };
  groups: DuplicateGroup[];
  recommendations: string[];
}

export interface ResultsResponse {
  upload_id: string;
  images: ImageScore[];
  metadata?: {
    total_images: number;
    scoring_method: string;
    calibration_note: string;
    duplicate_summary?: any;
  };
  duplicate_report?: DuplicateReport;
}

class BackendAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BACKEND_URL;
  }

  async uploadFiles(files: File[]): Promise<UploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async analyze(uploadId: string): Promise<AnalyzeResponse> {
    const response = await fetch(`${this.baseUrl}/analyze/${uploadId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}`);

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    return response.json();
  }

  async getResults(uploadId: string): Promise<ResultsResponse> {
    const response = await fetch(`${this.baseUrl}/results/${uploadId}`);

    if (!response.ok) {
      throw new Error(`Failed to get results: ${response.statusText}`);
    }

    return response.json();
  }

  async exportSelected(uploadId: string, imageIds: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/export/${uploadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(imageIds),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(errorData.detail || 'Failed to export images');
    }

    // Get the filename from response headers or generate one
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `frame_select_export_${imageIds.length}_images.zip`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    window.URL.revokeObjectURL(url);
  }

  getImageUrl(uploadId: string, filename: string): string {
    return `${this.baseUrl}/image/${uploadId}/${filename}`;
  }

  getThumbUrl(uploadId: string, filename: string): string {
    return `${this.baseUrl}/thumb/${uploadId}/${filename}`;
  }
}

export const api = new BackendAPI();