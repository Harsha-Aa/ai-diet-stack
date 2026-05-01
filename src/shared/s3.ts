/**
 * S3 Client Utility with Pre-signed URLs
 * 
 * This module provides a singleton S3 Client instance with helper functions
 * for common S3 operations including pre-signed URL generation for secure
 * uploads and downloads. Follows AWS best practices for Lambda + S3.
 * 
 * Features:
 * - Singleton pattern for connection reuse across Lambda invocations
 * - Pre-signed URL generation for secure uploads/downloads
 * - Helper functions for upload, download, delete operations
 * - TypeScript type safety
 * - Configurable expiration times
 * 
 * Usage:
 * ```typescript
 * import { 
 *   generatePresignedUploadUrl, 
 *   generatePresignedDownloadUrl,
 *   uploadFile,
 *   downloadFile,
 *   deleteFile
 * } from './shared/s3';
 * 
 * // Generate pre-signed URL for mobile app upload
 * const uploadUrl = await generatePresignedUploadUrl(
 *   'my-bucket',
 *   'images/food-123.jpg',
 *   'image/jpeg',
 *   300 // 5 minutes
 * );
 * 
 * // Generate pre-signed URL for download
 * const downloadUrl = await generatePresignedDownloadUrl(
 *   'my-bucket',
 *   'images/food-123.jpg',
 *   3600 // 1 hour
 * );
 * 
 * // Upload file directly from Lambda
 * await uploadFile('my-bucket', 'reports/report-123.pdf', pdfBuffer, 'application/pdf');
 * 
 * // Download file
 * const fileBuffer = await downloadFile('my-bucket', 'images/food-123.jpg');
 * 
 * // Delete file
 * await deleteFile('my-bucket', 'images/food-123.jpg');
 * ```
 */

import {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
  GetObjectCommandInput,
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  HeadObjectCommand,
  HeadObjectCommandInput,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { envLog } from './environment';

/**
 * S3 Client Configuration
 * Optimized for Lambda execution
 */
const clientConfig: S3ClientConfig = {
  maxAttempts: 3, // Retry failed requests up to 3 times
  requestHandler: {
    connectionTimeout: 3000, // 3 seconds
    requestTimeout: 30000, // 30 seconds (longer for file operations)
  },
  retryMode: 'adaptive',
};

/**
 * Singleton S3 Client instance
 * Reused across Lambda invocations for connection pooling
 */
let s3Client: S3Client | null = null;

/**
 * Get or create the singleton S3 Client
 * 
 * This function implements the singleton pattern to ensure only one
 * client instance is created and reused across Lambda invocations.
 * 
 * @returns S3 Client instance
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    envLog('Creating new S3 Client instance');
    s3Client = new S3Client(clientConfig);
  }
  
  return s3Client;
}

/**
 * Export the singleton client for direct use
 */
export const s3 = getS3Client();

/**
 * Default expiration times for pre-signed URLs (in seconds)
 */
export const PRESIGNED_URL_EXPIRATION = {
  UPLOAD: 300, // 5 minutes for uploads
  DOWNLOAD: 3600, // 1 hour for downloads
  SHORT: 60, // 1 minute for temporary access
  LONG: 86400, // 24 hours for extended access
} as const;

/**
 * S3 Upload Options
 */
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  contentDisposition?: string;
  serverSideEncryption?: 'AES256' | 'aws:kms';
  sseKmsKeyId?: string;
}

/**
 * Pre-signed Upload URL Options
 */
export interface PresignedUploadOptions extends UploadOptions {
  expiresIn?: number; // Expiration time in seconds
}

/**
 * Pre-signed Download URL Options
 */
export interface PresignedDownloadOptions {
  expiresIn?: number; // Expiration time in seconds
  responseContentType?: string;
  responseContentDisposition?: string;
}

/**
 * Generate a pre-signed URL for uploading a file to S3
 * 
 * This allows mobile apps or web clients to upload files directly to S3
 * without going through the Lambda function, reducing costs and latency.
 * 
 * @param bucket - S3 bucket name
 * @param key - Object key (file path in S3)
 * @param contentType - MIME type of the file (e.g., 'image/jpeg')
 * @param options - Additional upload options
 * @returns Pre-signed URL for PUT request
 * 
 * @example
 * // Generate URL for mobile app to upload food image
 * const uploadUrl = await generatePresignedUploadUrl(
 *   process.env.FOOD_IMAGES_BUCKET!,
 *   `users/${userId}/foods/${foodId}.jpg`,
 *   'image/jpeg',
 *   { expiresIn: 300, metadata: { userId, foodId } }
 * );
 * 
 * // Client can then PUT the file to this URL
 * // fetch(uploadUrl, { method: 'PUT', body: fileBlob, headers: { 'Content-Type': 'image/jpeg' } })
 */
export async function generatePresignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  options?: PresignedUploadOptions
): Promise<string> {
  const client = getS3Client();
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Metadata: options?.metadata,
    CacheControl: options?.cacheControl,
    ContentDisposition: options?.contentDisposition,
    ServerSideEncryption: options?.serverSideEncryption,
    SSEKMSKeyId: options?.sseKmsKeyId,
  });
  
  const expiresIn = options?.expiresIn || PRESIGNED_URL_EXPIRATION.UPLOAD;
  
  const url = await getSignedUrl(client, command, { expiresIn });
  
  envLog(`Generated pre-signed upload URL for ${bucket}/${key} (expires in ${expiresIn}s)`);
  
  return url;
}

/**
 * Generate a pre-signed URL for downloading a file from S3
 * 
 * This allows clients to download files directly from S3 without
 * going through the Lambda function.
 * 
 * @param bucket - S3 bucket name
 * @param key - Object key (file path in S3)
 * @param options - Download options
 * @returns Pre-signed URL for GET request
 * 
 * @example
 * // Generate URL for client to download food image
 * const downloadUrl = await generatePresignedDownloadUrl(
 *   process.env.FOOD_IMAGES_BUCKET!,
 *   `users/${userId}/foods/${foodId}.jpg`,
 *   { expiresIn: 3600 }
 * );
 * 
 * // Client can then GET the file from this URL
 * // fetch(downloadUrl).then(res => res.blob())
 */
export async function generatePresignedDownloadUrl(
  bucket: string,
  key: string,
  options?: PresignedDownloadOptions
): Promise<string> {
  const client = getS3Client();
  
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: options?.responseContentType,
    ResponseContentDisposition: options?.responseContentDisposition,
  });
  
  const expiresIn = options?.expiresIn || PRESIGNED_URL_EXPIRATION.DOWNLOAD;
  
  const url = await getSignedUrl(client, command, { expiresIn });
  
  envLog(`Generated pre-signed download URL for ${bucket}/${key} (expires in ${expiresIn}s)`);
  
  return url;
}

/**
 * Upload a file to S3
 * 
 * Use this when uploading files directly from Lambda (e.g., generated reports).
 * For client uploads, use generatePresignedUploadUrl instead.
 * 
 * @param bucket - S3 bucket name
 * @param key - Object key (file path in S3)
 * @param body - File content (Buffer, string, or stream)
 * @param contentType - MIME type of the file
 * @param options - Additional upload options
 * @returns S3 ETag of the uploaded object
 * 
 * @example
 * // Upload generated report from Lambda
 * await uploadFile(
 *   process.env.REPORTS_BUCKET!,
 *   `users/${userId}/reports/${reportId}.pdf`,
 *   pdfBuffer,
 *   'application/pdf',
 *   { metadata: { userId, reportId, generatedAt: new Date().toISOString() } }
 * );
 */
export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer | string | Uint8Array,
  contentType: string,
  options?: UploadOptions
): Promise<string> {
  const client = getS3Client();
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: options?.metadata,
    CacheControl: options?.cacheControl,
    ContentDisposition: options?.contentDisposition,
    ServerSideEncryption: options?.serverSideEncryption,
    SSEKMSKeyId: options?.sseKmsKeyId,
  });
  
  const response = await client.send(command);
  
  envLog(`Uploaded file to ${bucket}/${key}`);
  
  return response.ETag || '';
}

/**
 * Download a file from S3
 * 
 * @param bucket - S3 bucket name
 * @param key - Object key (file path in S3)
 * @returns File content as Buffer
 * 
 * @example
 * // Download food image for processing
 * const imageBuffer = await downloadFile(
 *   process.env.FOOD_IMAGES_BUCKET!,
 *   `users/${userId}/foods/${foodId}.jpg`
 * );
 * 
 * // Process the image...
 * const processedImage = await processImage(imageBuffer);
 */
export async function downloadFile(
  bucket: string,
  key: string
): Promise<Buffer> {
  const client = getS3Client();
  
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  const response = await client.send(command);
  
  if (!response.Body) {
    throw new Error(`File not found: ${bucket}/${key}`);
  }
  
  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  
  envLog(`Downloaded file from ${bucket}/${key} (${buffer.length} bytes)`);
  
  return buffer;
}

/**
 * Delete a file from S3
 * 
 * @param bucket - S3 bucket name
 * @param key - Object key (file path in S3)
 * @returns True if deleted successfully
 * 
 * @example
 * // Delete old food image
 * await deleteFile(
 *   process.env.FOOD_IMAGES_BUCKET!,
 *   `users/${userId}/foods/${oldFoodId}.jpg`
 * );
 */
export async function deleteFile(
  bucket: string,
  key: string
): Promise<boolean> {
  const client = getS3Client();
  
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  await client.send(command);
  
  envLog(`Deleted file from ${bucket}/${key}`);
  
  return true;
}

/**
 * Check if a file exists in S3
 * 
 * @param bucket - S3 bucket name
 * @param key - Object key (file path in S3)
 * @returns True if file exists, false otherwise
 * 
 * @example
 * const exists = await fileExists(
 *   process.env.FOOD_IMAGES_BUCKET!,
 *   `users/${userId}/foods/${foodId}.jpg`
 * );
 */
export async function fileExists(
  bucket: string,
  key: string
): Promise<boolean> {
  const client = getS3Client();
  
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    
    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get file metadata from S3
 * 
 * @param bucket - S3 bucket name
 * @param key - Object key (file path in S3)
 * @returns File metadata (size, content type, last modified, etc.)
 * 
 * @example
 * const metadata = await getFileMetadata(
 *   process.env.FOOD_IMAGES_BUCKET!,
 *   `users/${userId}/foods/${foodId}.jpg`
 * );
 * console.log(`File size: ${metadata.ContentLength} bytes`);
 * console.log(`Last modified: ${metadata.LastModified}`);
 */
export async function getFileMetadata(
  bucket: string,
  key: string
): Promise<{
  ContentLength?: number;
  ContentType?: string;
  LastModified?: Date;
  ETag?: string;
  Metadata?: Record<string, string>;
}> {
  const client = getS3Client();
  
  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  const response = await client.send(command);
  
  return {
    ContentLength: response.ContentLength,
    ContentType: response.ContentType,
    LastModified: response.LastModified,
    ETag: response.ETag,
    Metadata: response.Metadata,
  };
}

/**
 * List files in an S3 bucket with a given prefix
 * 
 * @param bucket - S3 bucket name
 * @param prefix - Key prefix to filter by (e.g., 'users/123/')
 * @param maxKeys - Maximum number of keys to return (default: 1000)
 * @returns Array of object keys
 * 
 * @example
 * // List all food images for a user
 * const foodImages = await listFiles(
 *   process.env.FOOD_IMAGES_BUCKET!,
 *   `users/${userId}/foods/`
 * );
 */
export async function listFiles(
  bucket: string,
  prefix?: string,
  maxKeys: number = 1000
): Promise<string[]> {
  const client = getS3Client();
  
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });
  
  const response = await client.send(command);
  
  const keys = (response.Contents || []).map((obj) => obj.Key || '').filter(Boolean);
  
  envLog(`Listed ${keys.length} files in ${bucket}${prefix ? `/${prefix}` : ''}`);
  
  return keys;
}

/**
 * Reset the singleton client (useful for testing)
 * 
 * @internal
 */
export function resetClient(): void {
  s3Client = null;
}
