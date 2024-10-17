// pasteImageUtils.ts

export const handlePaste = (event: React.ClipboardEvent, validImageTypes: string[], handlePictureUpload: (file: File) => void) => {
    const clipboardData = event.clipboardData;
    const items = clipboardData.items;
  
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.includes('image')) {
        const file = items[i].getAsFile();
        if (file && validImageTypes.includes(file.type)) {
          handlePictureUpload(file);  // Use the upload handler to treat the pasted image like an uploaded file
          event.preventDefault();  // Prevent default paste behavior
          break;
        }
      }
    }
  };
  