import React from 'react';

interface PictureCardProps {
  id: string;
  title: string;
  description?: string;
  image: File | null;
  onOpenFullSize: () => void; // Callback to handle opening full-size view
  onDismiss?: () => void; // Optional callback to handle dismissal
}

const PictureCard: React.FC<PictureCardProps> = ({ title, description, image, onOpenFullSize, onDismiss }) => {
  return (
    <div className="bg-gray-200 p-4 border rounded shadow-sm cursor-pointer" onClick={onOpenFullSize}>
      <div className="flex justify-between">
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
      {/* Check if image is a valid File before trying to render it */}
      {image && image instanceof File ? (
        <img src={URL.createObjectURL(image)} alt={title} className="w-full h-auto mt-2" />
      ) : (
        <p className="text-gray-500 mt-2">No image available</p>
      )}
      {description && <p className="text-gray-500 mt-2">{description}</p>}
    </div>
  );
};

export default PictureCard;
