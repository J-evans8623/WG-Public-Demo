// bloom-maps/Library/hooks/useImageAttachment.tsx

import { useState } from 'react';

const useImageAttachment = () => {
  const [image, setImage] = useState<File | null>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (file) {
      setImage(file);
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  return { image, handleImageChange, removeImage };
};

export default useImageAttachment;
