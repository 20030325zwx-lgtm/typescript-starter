import type { Readable } from 'node:stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface PutPrivateObjectInput {
  key: string;
  body: Readable;
  contentType: string;
  contentLength: number;
}

export interface ObjectStorageService {
  putPrivateObject(input: PutPrivateObjectInput): Promise<void>;
  deleteObject(key: string): Promise<void>;
  createPresignedGetUrl(key: string): Promise<string>;
}
