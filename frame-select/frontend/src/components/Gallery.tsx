'use client';

import { useState } from 'react';
import ImageCard from './ImageCard';
import ScoreBreakdown from './ScoreBreakdown';
import DetailDrawer from './DetailDrawer';
import { ImageScore } from '@/app/api/backend';

interface GalleryProps {
  images: ImageScore[];
  uploadId: string;
  onImageSelect: (image: ImageScore | null) => void;
  selectedImage: ImageScore | null;
  onKeepReject?: (imageId: string, action: 'keep' | 'reject') => void;
  selectedImages?: Set<string>;
  onToggleSelect?: (imageId: string) => void;
}

export default function Gallery({ 
  images, 
  uploadId, 
  onImageSelect, 
  selectedImage,
  onKeepReject,
  selectedImages = new Set(),
  onToggleSelect
}: GalleryProps) {
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  const handleImageClick = (image: ImageScore) => {
    onImageSelect(image);
    setShowDetailDrawer(true);
  };

  const handleCloseDrawer = () => {
    setShowDetailDrawer(false);
    onImageSelect(null);
  };

  return (
    <div className="gallery-container">
      <div className={`gallery-grid ${showDetailDrawer ? 'with-drawer' : ''}`}>
        {images.map((image) => (
          <ImageCard
            key={image.image_id}
            image={image}
            uploadId={uploadId}
            isSelected={selectedImages.has(image.image_id)}
            onClick={() => handleImageClick(image)}
            onKeepReject={onKeepReject}
            onToggleSelect={onToggleSelect}
            showRank={true}
          />
        ))}
      </div>
      
      {showDetailDrawer && selectedImage && (
        <DetailDrawer
          image={selectedImage}
          uploadId={uploadId}
          onClose={handleCloseDrawer}
        />
      )}
    </div>
  );
}