import React from 'react';
import styles from '@/app/Library/components/CardDisplay/PictureCard.module.css'; // Import CSS Module
import Image from 'next/image';

interface PictureCardProps {
  id: string;
  title: string;
  description?: string;
  image: File | null;
  source: string;
  onOpenFullSize: () => void; // Callback to handle opening full-size view
  onDismiss?: () => void; // Optional callback to handle dismissal
}

const PictureCard: React.FC<PictureCardProps> = ({ title, description, image, source,onOpenFullSize, onDismiss }) => {
  return (
    <div className={styles.pictureCard} onClick={onOpenFullSize}>
      <div className={styles.header}>
        <p className="font-bold text-lg">{title}</p>
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-gray-600 hover:text-gray-800"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>
      {/* Image container with fixed aspect ratio */}
      <div className={styles.imageContainer}>
        {image && image instanceof File ? (
          <Image
            src={URL.createObjectURL(image)}
            alt={title}
            fill // Use fill to make the image cover the container
            className={styles.imagePreview}
            title='Click to view image'
          />
        ) : (
          <p className="text-gray-500 mt-2">No image available</p>
        )}
      </div>
      {description && <p className={styles.description}>{description}</p>}
      {source && (
                <div className="text-xs text-gray-500 mt-4">
                    <span>Source: {source}</span>
                </div>
            )}
    </div>
  );
};

export default PictureCard;
