// utils/fileTypeMapping.ts
export const mapFileTypeToRenderer = (fileType: 'pdf' | 'txt' | 'doc' | 'docx'): 'pdf' | 'docx' | 'txt' => {
  switch (fileType) {
      case 'pdf':
          return 'pdf';
      case 'doc':
      case 'docx':
          return 'docx';
      case 'txt':
          return 'txt';
      default:
          return 'txt';
  }
};