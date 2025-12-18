'use client';

import { api, ImageScore } from '@/app/api/backend';

interface DetailDrawerProps {
  image: ImageScore;
  uploadId: string;
  onClose: () => void;
}

export default function DetailDrawer({ image, uploadId, onClose }: DetailDrawerProps) {
  const imageUrl = api.getImageUrl(uploadId, image.image_id);

  const getTagExplanation = (tag: string) => {
    const explanations: { [key: string]: string } = {
      'sharp': 'High edge contrast indicates good focus',
      'blurry': 'Low edge contrast suggests motion blur or focus issues',
      'sharp_subject': 'Main subject is in sharp focus',
      'blurry_subject': 'Main subject appears soft or motion blurred',
      'good_composition': 'Subject positioning follows rule of thirds',
      'good_bokeh': 'Sharp subject with beautifully blurred background',
      'background_focus': 'Background may be sharper than the main subject',
    };
    return explanations[tag] || tag.replace('_', ' ');
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return '#4caf50';
    if (score >= 0.4) return '#ff9800';
    return '#f44336';
  };

  const scoreItems = [
    { label: 'Sharpness', value: image.scores.sharpness, weight: '40%' },
    { label: 'Composition', value: image.scores.composition, weight: '35%' },
    { label: 'Emotion', value: image.scores.emotion, weight: '15%' },
    { label: 'Action', value: image.scores.action, weight: '10%' },
  ];

  return (
    <div className="detail-drawer">
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-content">
        <div className="drawer-header">
          <div className="image-title">
            <h3>{image.image_id}</h3>
            {image.rank && (
              <span className="rank-badge">#{image.rank}</span>
            )}
          </div>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="drawer-body">
          <div className="preview-image-container">
            <img 
              src={imageUrl}
              alt={image.image_id}
              className="preview-image"
            />
          </div>

          <div className="score-section">
            <div className="final-score-large">
              <div className="score-circle-large">
                <span className="score-text">{(image.final_score * 100).toFixed(0)}%</span>
              </div>
              <p className="calibration-note">Ranked within this upload set</p>
            </div>

            <div className="score-breakdown-detailed">
              <h4>Score Breakdown</h4>
              {scoreItems.map((item) => (
                <div key={item.label} className="score-detail-row">
                  <div className="score-detail-header">
                    <span className="score-detail-label">{item.label}</span>
                    <span className="score-detail-weight">({item.weight})</span>
                    <span className="score-detail-value">{(item.value * 100).toFixed(0)}%</span>
                  </div>
                  <div className="score-detail-bar">
                    <div 
                      className="score-detail-fill"
                      style={{ 
                        width: `${item.value * 100}%`,
                        backgroundColor: getScoreColor(item.value)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {image.tags.length > 0 && (
              <div className="tags-explanation">
                <h4>Analysis Tags</h4>
                <div className="explained-tags">
                  {image.tags.map((tag) => (
                    <div key={tag} className="explained-tag">
                      <span className={`tag tag-${tag}`}>{tag.replace('_', ' ')}</span>
                      <p className="tag-explanation">{getTagExplanation(tag)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {image.debug_info?.sharpness && (
              <div className="debug-section">
                <h4>Technical Details</h4>
                <div className="debug-info">
                  <div className="debug-item">
                    <span className="debug-label">Subject Variance:</span>
                    <span className="debug-value">{image.debug_info.sharpness.subject_variance || 'N/A'}</span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">Background Variance:</span>
                    <span className="debug-value">{image.debug_info.sharpness.background_variance || 'N/A'}</span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">Sharpness Ratio:</span>
                    <span className="debug-value">{image.debug_info.sharpness.sharpness_ratio || 'N/A'}</span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">Detection Method:</span>
                    <span className="debug-value">{image.debug_info.sharpness.detection_method || 'overall'}</span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">Subject Area:</span>
                    <span className="debug-value">{image.debug_info.sharpness.subject_area_percent || 'N/A'}%</span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">Percentile Rank:</span>
                    <span className="debug-value">{image.debug_info.sharpness.subject_percentile_rank || image.debug_info.sharpness.percentile_rank}</span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">Upload Context:</span>
                    <span className="debug-value">{image.debug_info.sharpness.upload_context}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}