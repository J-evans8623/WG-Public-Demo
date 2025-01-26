import React, { useEffect, useState } from 'react';
import styles from '@/app/Library/components/CardDisplay/PictureCard.module.css'; // Import CSS Module
import Image from 'next/image';
import { FetchError, PictureResource, PictureResourceResult } from '../../Definitions/Definitions';


interface PictureCardProps {
  id: string;
  title: string;
  description?: string;
  pictureResult: PictureResourceResult;
  source: string;
  onOpenFullSize: () => void;
  onDismiss?: () => void;
}

const PictureCard: React.FC<PictureCardProps> = ({ 
  title, 
  description, 
  pictureResult, 
  source,
  onOpenFullSize, 
  onDismiss 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [picture, setPicture] = useState<PictureResource | null>(null);

  useEffect(() => {
    if (pictureResult.status === 'ready') {
      setPicture(pictureResult.data as PictureResource);
      setIsLoading(false);
      setError(null);
    } else if (pictureResult.status === 'pending') {
      setIsLoading(true);
      (pictureResult.data as Promise<PictureResource>)
        .then((resource) => {
          setPicture(resource);
          setIsLoading(false);
          setError(null);
        })
        .catch((err: FetchError) => {
          setError(err);
          setIsLoading(false);
        });
    } else if (pictureResult.status === 'error' && pictureResult.error) {
      setError(pictureResult.error);
      setIsLoading(false);
    }
  }, [pictureResult]);

  return (
    <div className={styles.pictureCard} onClick={!isLoading ? onOpenFullSize : undefined}>
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
      <div className={styles.imageContainer}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-sm text-gray-600">Fetching update...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500">Failed to load image</p>
            {error.retry && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLoading(true);
                  error.retry!()
                    .then((resource) => {
                      setPicture(resource);
                      setIsLoading(false);
                      setError(null);
                    })
                    .catch((err: FetchError) => {
                      setError(err);
                      setIsLoading(false);
                    });
                }}
                className="mt-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Retry
              </button>
            )}
          </div>
        ) : picture?.image ? (
          <Image
            src={URL.createObjectURL(picture.image)}
            alt={title}
            fill
            className={styles.imagePreview}
            title="Click to view image"
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