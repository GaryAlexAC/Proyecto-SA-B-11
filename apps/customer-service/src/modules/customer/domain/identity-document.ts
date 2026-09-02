export interface IdentityDocument {
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  checksum: string;
}
