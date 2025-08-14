// userFiles/{docId}
export default interface FileMeta {
  fileId: string;
  ownerId: string;
  fileName: string;
  fileStoragePath: string;
  fileSize: number;
  contentType: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  updatedBy: string;
  publicView: boolean;
  publicEdit: boolean;
  editors: string[];         
  sharedWith: string[];     
}
