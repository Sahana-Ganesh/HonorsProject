'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import UploadDropzone from '@/components/UploadDropzone';
import { api, JobStatus } from '@/app/api/backend';

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError('');
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select some files first');
      return;
    }

    setUploading(true);
    setCurrentStep('Uploading files...');
    setError('');

    try {
      const uploadResponse = await api.uploadFiles(files);
      
      setUploading(false);
      setAnalyzing(true);
      setCurrentStep('Starting analysis...');

      const analyzeResponse = await api.analyze(uploadResponse.upload_id);
      
      const jobId = analyzeResponse.job_id;
      let jobStatus: JobStatus;
      
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        jobStatus = await api.getJobStatus(jobId);
        
        setProgress(jobStatus.progress * 100);
        
        if (jobStatus.status === 'running') {
          const processed = Math.floor(jobStatus.progress * uploadResponse.count);
          setCurrentStep(`Analyzing ${processed} of ${uploadResponse.count} images...`);
        }
        
      } while (jobStatus.status === 'queued' || jobStatus.status === 'running');

      if (jobStatus.status === 'completed') {
        router.push(`/results/${uploadResponse.upload_id}`);
      } else {
        setError(`Analysis failed: ${jobStatus.error || 'Unknown error'}`);
        setAnalyzing(false);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const isProcessing = uploading || analyzing;

  return (
    <div className="container">
      <header className="header">
        <Link href="/" className="back-link">← Back to Home</Link>
        <h1>Upload Photos</h1>
      </header>

      <main className="main">
        {!isProcessing && (
          <>
            <UploadDropzone onFilesSelected={handleFilesSelected} />
            
            {files.length > 0 && (
              <div className="upload-summary">
                <p>{files.length} files selected</p>
                <button 
                  className="button button-primary"
                  onClick={handleUpload}
                  disabled={isProcessing}
                >
                  Upload and Analyze
                </button>
              </div>
            )}
          </>
        )}

        {isProcessing && (
          <div className="progress-container">
            <div className="progress-info">
              <h3>{currentStep}</h3>
              {analyzing && (
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
              <p>{analyzing ? `${Math.round(progress)}% complete` : 'Please wait...'}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="error">
            <p>{error}</p>
            <button 
              className="button"
              onClick={() => {
                setError('');
                setFiles([]);
                setProgress(0);
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}