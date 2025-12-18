'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Gallery from '@/components/Gallery';
import { api, ResultsResponse, ImageScore } from '@/app/api/backend';

export default function ResultsPage() {
  const params = useParams();
  const uploadId = params.uploadId as string;
  
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'final_score' | 'sharpness' | 'composition'>('final_score');
  const [selectedImage, setSelectedImage] = useState<ImageScore | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [keptImages, setKeptImages] = useState<Set<string>>(new Set());
  const [rejectedImages, setRejectedImages] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [scoreFilter, setScoreFilter] = useState<number>(0);
  const [quickFilter, setQuickFilter] = useState<'all' | 'top10' | 'top25' | 'threshold' | 'duplicates' | 'unique'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [showDuplicateReport, setShowDuplicateReport] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [uploadId]);

  const fetchResults = async () => {
    try {
      const data = await api.getResults(uploadId);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handleKeepReject = (imageId: string, action: 'keep' | 'reject') => {
    if (action === 'keep') {
      setKeptImages(prev => new Set(prev).add(imageId));
      setRejectedImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
    } else {
      setRejectedImages(prev => new Set(prev).add(imageId));
      setKeptImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
      setSelectedImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
    }
  };

  const handleToggleSelect = (imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const handleSelectTopPicks = (count: number) => {
    if (!results) return;
    const sortedImages = getSortedAndFilteredImages();
    const topImages = sortedImages.slice(0, count).map(img => img.image_id);
    setSelectedImages(new Set(topImages));
  };

  const handleExportSelected = async () => {
    if (selectedImages.size === 0) {
      alert('Please select some images first');
      return;
    }
    
    setIsExporting(true);
    
    try {
      const imageIds = Array.from(selectedImages);
      await api.exportSelected(uploadId, imageIds);
      
      alert(`Successfully exported ${imageIds.length} images as ZIP file!`);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
    if (tagFilter) setTagFilter('');
  };

  const handleClearAllTagFilters = () => {
    setSelectedTags(new Set());
    setTagFilter('');
  };

  const getTagCount = (tag: string) => {
    if (!results) return 0;
    return results.images.filter(img => img.tags.includes(tag)).length;
  };

  const getSortedAndFilteredImages = () => {
    if (!results) return [];
    
    let filteredImages = results.images.filter(img => {
      if (rejectedImages.has(img.image_id)) return false;
      
      if (tagFilter && !img.tags.includes(tagFilter)) return false;
      
      if (selectedTags.size > 0) {
        const hasAllSelectedTags = Array.from(selectedTags).every(tag => img.tags.includes(tag));
        if (!hasAllSelectedTags) return false;
      }
      
      if (img.final_score < scoreFilter / 100) return false;
      
      return true;
    });

    filteredImages.sort((a, b) => {
      switch (sortBy) {
        case 'sharpness':
          return b.scores.sharpness - a.scores.sharpness;
        case 'composition':
          return b.scores.composition - a.scores.composition;
        default:
          return b.final_score - a.final_score;
      }
    });

    switch (quickFilter) {
      case 'top10':
        return filteredImages.slice(0, 10);
      case 'top25':
        return filteredImages.slice(0, 25);
      case 'threshold':
        return filteredImages.filter(img => img.final_score >= 0.7);
      case 'duplicates':
        return filteredImages.filter(img => 
          img.tags.some(tag => tag.includes('duplicate_') || tag === 'duplicate_primary' || tag === 'duplicate_secondary')
        );
      case 'unique':
        return filteredImages.filter(img => img.tags.includes('unique'));
      default:
        return filteredImages;
    }
  };

  const getAvailableTags = () => {
    if (!results) return [];
    const allTags = results.images.flatMap(img => img.tags);
    return Array.from(new Set(allTags));
  };

  const handleAutoRemoveDuplicates = () => {
    if (!results?.duplicate_report) return;
    
    const duplicatesToRemove = new Set<string>();
    
    results.duplicate_report.groups.forEach(group => {
      group.images.slice(1).forEach(imageId => {
        duplicatesToRemove.add(imageId);
      });
    });
    
    setRejectedImages(prev => {
      const newSet = new Set(prev);
      duplicatesToRemove.forEach(id => newSet.add(id));
      return newSet;
    });
    
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      duplicatesToRemove.forEach(id => newSet.delete(id));
      return newSet;
    });
    
    alert(`Automatically rejected ${duplicatesToRemove.size} duplicate images. Primary images from each group were kept.`);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading results...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <header className="header">
          <Link href="/upload" className="back-link">← Back to Upload</Link>
          <h1>Results</h1>
        </header>
        
        <div className="error">
          <p>{error}</p>
          <Link href="/upload" className="button">Upload New Photos</Link>
        </div>
      </div>
    );
  }

  const filteredImages = getSortedAndFilteredImages();
  const availableTags = getAvailableTags();
  const hasDuplicates = results?.duplicate_report?.groups && results.duplicate_report.groups.length > 0;

  return (
    <div className="container">
      <header className="header">
        <Link href="/upload" className="back-link">← Back to Upload</Link>
        <h1>Analysis Results</h1>
        <div className="results-summary">
          <span>{results?.images.length} images analyzed</span>
          {hasDuplicates && (
            <span className="duplicate-alert">
              • {results?.duplicate_report?.summary.total_duplicates} duplicates found
            </span>
          )}
          {results?.metadata?.calibration_note && (
            <span className="calibration-note">• {results.metadata.calibration_note}</span>
          )}
        </div>
      </header>

      {hasDuplicates && (
        <div className="duplicate-report-section">
          <div className="duplicate-summary">
            <h3>Duplicate Detection Results</h3>
            <div className="duplicate-stats">
              <div className="stat">
                <strong>{results?.duplicate_report?.groups.length}</strong>
                <span>Duplicate Groups</span>
              </div>
              <div className="stat">
                <strong>{results?.duplicate_report?.summary.total_duplicates}</strong>
                <span>Total Duplicates</span>
              </div>
              <div className="stat">
                <strong>{results?.duplicate_report?.summary.unique_images}</strong>
                <span>Unique Images</span>
              </div>
            </div>
            <div className="duplicate-actions">
              <button 
                className="button"
                onClick={() => setShowDuplicateReport(!showDuplicateReport)}
              >
                {showDuplicateReport ? 'Hide' : 'Show'} Duplicate Details
              </button>
              <button 
                className="button button-warning"
                onClick={handleAutoRemoveDuplicates}
              >
                Auto-Remove Duplicates
              </button>
            </div>
          </div>

          {showDuplicateReport && (
            <div className="duplicate-details">
              <h4>Duplicate Groups:</h4>
              {results?.duplicate_report?.groups.map((group, index) => (
                <div key={index} className="duplicate-group">
                  <h5>Group {index + 1} ({group.count} images)</h5>
                  <div className="duplicate-images">
                    {group.images.map((imageId, imgIndex) => (
                      <div key={imageId} className={`duplicate-image ${imgIndex === 0 ? 'primary' : 'secondary'}`}>
                        <span className="image-name">{imageId}</span>
                        <span className="image-status">
                          {imgIndex === 0 ? 'Primary (Keep)' : 'Duplicate'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="controls-panel">
        <div className="controls-row">
          <div className="control-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="final_score">Final Score</option>
              <option value="sharpness">Sharpness</option>
              <option value="composition">Composition</option>
            </select>
          </div>

          <div className="control-group">
            <label>Quick filter:</label>
            <select value={quickFilter} onChange={(e) => setQuickFilter(e.target.value as any)}>
              <option value="all">All Images</option>
              <option value="top10">Top 10</option>
              <option value="top25">Top 25</option>
              <option value="threshold">Above 70%</option>
              {hasDuplicates && <option value="duplicates">Duplicates Only</option>}
              {hasDuplicates && <option value="unique">Unique Only</option>}
            </select>
          </div>

          <div className="control-group">
            <label>Tag filter:</label>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">All tags</option>
              {availableTags.map(tag => (
                <option key={tag} value={tag}>{tag.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Min score: {scoreFilter}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={scoreFilter}
              onChange={(e) => setScoreFilter(Number(e.target.value))}
              className="score-slider"
            />
          </div>
        </div>

        <div className="control-group">
          <label>Filter by Tags:</label>
          <div className="tag-dropdown-container">
            <button 
              className="tag-dropdown-button"
              onClick={() => setShowTagDropdown(!showTagDropdown)}
            >
              <span className="dropdown-label">
                {selectedTags.size === 0 
                  ? 'Select tags...' 
                  : `${selectedTags.size} tag${selectedTags.size > 1 ? 's' : ''} selected`
                }
              </span>
              <svg 
                className={`dropdown-arrow ${showTagDropdown ? 'open' : ''}`}
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {showTagDropdown && (
              <div className="tag-dropdown-menu">
                <div className="dropdown-header">
                  <span>Available Tags</span>
                  {selectedTags.size > 0 && (
                    <button 
                      className="clear-tags-btn"
                      onClick={handleClearAllTagFilters}
                    >
                      Clear All
                    </button>
                  )}
                </div>
                
                <div className="tag-options">
                  {availableTags.map(tag => {
                    const count = getTagCount(tag);
                    const isSelected = selectedTags.has(tag);
                    
                    return (
                      <label 
                        key={tag}
                        className={`tag-option ${isSelected ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleTag(tag)}
                          className="tag-checkbox"
                        />
                        <span className="tag-option-content">
                          <span className="tag-option-name">{tag.replace('_', ' ')}</span>
                          <span className="tag-option-count">({count})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="actions-row">
          <div className="selection-actions">
            <button 
              className="button"
              onClick={() => handleSelectTopPicks(10)}
            >
              Select Top 10
            </button>
            <button 
              className="button"
              onClick={() => handleSelectTopPicks(25)}
            >
              Select Top 25
            </button>
            <button 
              className="button"
              onClick={() => setSelectedImages(new Set())}
            >
              Clear Selection
            </button>
          </div>

          <div className="export-actions">
            <span className="selection-count">
              {selectedImages.size} selected
            </span>
            <button 
              className="button button-primary"
              onClick={handleExportSelected}
              disabled={selectedImages.size === 0 || isExporting}
            >
              {isExporting ? 'Creating ZIP...' : 'Export Selected'}
            </button>
          </div>
        </div>

        <div className="status-summary">
          <span>Showing: {filteredImages.length} images</span>
          <span>Kept: {keptImages.size}</span>
          <span>Rejected: {rejectedImages.size}</span>
        </div>
      </div>

      <main className="main">
        <Gallery
          images={filteredImages}
          uploadId={uploadId}
          onImageSelect={setSelectedImage}
          selectedImage={selectedImage}
          onKeepReject={handleKeepReject}
          selectedImages={selectedImages}
          onToggleSelect={handleToggleSelect}
        />
      </main>

      <style jsx>{`
        .duplicate-report-section {
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          margin: 20px 0;
          padding: 20px;
        }

        .duplicate-summary h3 {
          margin: 0 0 15px 0;
          color: #495057;
          font-size: 1.2em;
        }

        .duplicate-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px;
          background: white;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }

        .stat strong {
          font-size: 1.5em;
          color: #007bff;
        }

        .stat span {
          font-size: 0.85em;
          color: #6c757d;
        }

        .duplicate-actions {
          display: flex;
          gap: 10px;
        }

        .button-warning {
          background: #ffc107;
          color: #212529;
        }

        .button-warning:hover {
          background: #e0a800;
        }

        .duplicate-details {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
        }

        .duplicate-group {
          margin-bottom: 20px;
          padding: 15px;
          background: white;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }

        .duplicate-group h5 {
          margin: 0 0 10px 0;
          color: #495057;
        }

        .duplicate-images {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .duplicate-image {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 4px;
          font-family: monospace;
        }

        .duplicate-image.primary {
          background: #d4edda;
          border: 1px solid #c3e6cb;
        }

        .duplicate-image.secondary {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
        }

        .image-status {
          font-size: 0.85em;
          font-weight: bold;
        }

        .duplicate-alert {
          color: #dc3545;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}