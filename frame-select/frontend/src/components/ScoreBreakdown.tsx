'use client';

import { ImageScore } from '@/app/api/backend';

interface ScoreBreakdownProps {
  image: ImageScore;
}

export default function ScoreBreakdown({ image }: ScoreBreakdownProps) {
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
    <div className="score-breakdown">
      <div className="final-score">
        <h4>Final Score</h4>
        <div 
          className="final-score-circle"
          style={{ 
            background: `conic-gradient(${getScoreColor(image.final_score)} ${image.final_score * 360}deg, #e0e0e0 0deg)` 
          }}
        >
          <span>{(image.final_score * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="score-details">
        <h4>Score Breakdown</h4>
        {scoreItems.map((item) => (
          <div key={item.label} className="score-row">
            <div className="score-info">
              <span className="score-label">{item.label}</span>
              <span className="score-weight">({item.weight})</span>
            </div>
            <div className="score-bar">
              <div 
                className="score-fill"
                style={{ 
                  width: `${item.value * 100}%`,
                  backgroundColor: getScoreColor(item.value)
                }}
              />
            </div>
            <span className="score-percent">{(item.value * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>

      {image.tags.length > 0 && (
        <div className="tags-section">
          <h4>Tags</h4>
          <div className="tags">
            {image.tags.map((tag) => (
              <span key={tag} className={`tag tag-${tag}`}>
                {tag.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}