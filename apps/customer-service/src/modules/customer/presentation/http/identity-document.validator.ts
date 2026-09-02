import { createHash } from 'crypto';
import { Errors } from '../../../../common/application/errors/app-error';
import { IdentityDocument } from '../../domain/identity-document';

export interface UploadedIdentityPhoto {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const maxSizeBytes = 5 * 1024 * 1024;

export function validateIdentityDocument(file?: UploadedIdentityPhoto): IdentityDocument {
  if (!file) throw Errors.validation([{ field: 'identityPhoto', message: 'La foto del documento es obligatoria' }]);
  if (file.size === 0 || file.size > maxSizeBytes) throw Errors.validation([{ field: 'identityPhoto', message: 'La foto debe pesar como máximo 5 MB' }]);

  const mimeType = detectImageType(file.buffer);
  if (!mimeType || file.mimetype !== mimeType) {
    throw Errors.validation([{ field: 'identityPhoto', message: 'Solo se permiten archivos JPEG, PNG o WebP válidos' }]);
  }

  return { data: file.buffer, mimeType, checksum: createHash('sha256').update(file.buffer).digest('hex') };
}

function detectImageType(data: Buffer): IdentityDocument['mimeType'] | undefined {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return undefined;
}
