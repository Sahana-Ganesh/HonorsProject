'use client';

import Link from 'next/link';
import { api, ImageScore } from '@/app/api/backend';

interface ImageCardProps {
  image: ImageScore;
  uploadId: string;
  isSelected: boolean;
  onClick: () => void;
  onKeepReject?: (imageId: string, action: 'keep' | 'reject') => void;
  onToggleSelect?: (imageId: string) => void;
  showRank?: boolean;
  images?: ImageScore[];
}

export default function ImageCard({ 
  image, 
  uploadId, 
  isSelected, 
  onClick,
  onKeepReject,
  onToggleSelect,
  showRank = false,
  images = []
}: ImageCardProps) {
  const thumbUrl = api.getThumbUrl(uploadId, image.image_id);
  
  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(image.image_id);
  };

  const handleKeepClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onKeepReject?.(image.image_id, 'keep');
  };

  const handleRejectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onKeepReject?.(image.image_id, 'reject');
  };

  const handleAnalysisClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className={`image-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="image-wrapper">
        <img 
          src={thumbUrl} 
          alt={image.image_id}
          className="thumbnail"
          loading="lazy"
        />
        
        <div className="image-overlay">
          <div className="overlay-top">
            {showRank && (
              <div className="rank-badge">#{(images?.indexOf(image) || 0) + 1}</div>
            )}
            <div className="score-badge">
              {(image.final_score * 100).toFixed(0)}%
            </div>
          </div>

          {onToggleSelect && (
            <div className="selection-overlay">
              <button
                className={`selection-checkbox ${isSelected ? 'selected' : ''}`}
                onClick={handleSelectClick}
                title="Select for export"
              >
                {isSelected && <span className="checkmark">✓</span>}
              </button>
            </div>
          )}

          <div className="overlay-bottom">
            <div className="tags-compact">
              {image.tags.slice(0, 2).map((tag) => (
                <span key={tag} className={`tag-mini tag-${tag}`}>
                  {tag === 'good_composition' ? 'comp' : tag}
                </span>
              ))}
            </div>
            
            <div className="card-actions">
              {onKeepReject && (
                <>
                  <button
                    className="action-button keep-button"
                    onClick={handleKeepClick}
                    title="Keep (K)"
                  >
                    K
                  </button>
                  <button
                    className="action-button reject-button"
                    onClick={handleRejectClick}
                    title="Reject (R)"
                  >
                    R
                  </button>
                </>
              )}
              
              <Link 
                href={`/analysis/${uploadId}/${image.image_id}`}
                onClick={handleAnalysisClick}
                className="action-button analysis-button"
                title="Deep Analysis"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <circle cx="12" cy="1" r="1"/>
                  <circle cx="12" cy="23" r="1"/>
                  <circle cx="20.49" cy="8.51" r="1"/>
                  <circle cx="3.51" cy="15.49" r="1"/>
                  <circle cx="20.49" cy="15.49" r="1"/>
                  <circle cx="3.51" cy="8.51" r="1"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card-content-compact">
        <div className="filename-compact">{image.image_id}</div>
        
        <div className="scores-bars">
          <div className="score-bar-item">
            <span className="score-bar-label">Sharp</span>
            <div className="score-bar-mini">
              <div 
                className="score-bar-fill"
                style={{ width: `${image.scores.sharpness * 100}%` }}
              />
            </div>
            <span className="score-bar-value">{(image.scores.sharpness * 100).toFixed(0)}</span>
          </div>
          <div className="score-bar-item">
            <span className="score-bar-label">Comp</span>
            <div className="score-bar-mini">
              <div 
                className="score-bar-fill"
                style={{ width: `${image.scores.composition * 100}%` }}
              />
            </div>
            <span className="score-bar-value">{(image.scores.composition * 100).toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}