/**
 * Unit tests for S3 utility module
 */

import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import {
  getS3Client,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  uploadFile,
  downloadFile,
  deleteFile,
  fileExists,
  getFileMetadata,
  listFiles,
  resetClient,
  PRESIGNED_URL_EXPIRATION,
} from '../../src/shared/s3';

// Mock the presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const s3Mock = mockClient(S3Client);

describe('S3 Utility', () => {
  beforeEach(() => {
    s3Mock.reset();
    resetClient();
    jest.clearAllMocks();
  });

  describe('getS3Client', () => {
    it('should create a singleton S3 client', () => {
      const client1 = getS3Client();
      const client2 = getS3Client();
      
      expect(client1).toBe(client2);
      expect(client1).toBeInstanceOf(S3Client);
    });

    it('should create a new client after reset', () => {
      const client1 = getS3Client();
      resetClient();
      const client2 = getS3Client();
      
      expect(client1).not.toBe(client2);
    });
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate a pre-signed upload URL with default expiration', async () => {
      const mockUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      const url = await generatePresignedUploadUrl(
        'test-bucket',
        'test-key.jpg',
        'image/jpeg'
      );

      expect(url).toBe(mockUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(PutObjectCommand),
        { expiresIn: PRESIGNED_URL_EXPIRATION.UPLOAD }
      );
    });

    it('should generate a pre-signed upload URL with custom expiration', async () => {
      const mockUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      const url = await generatePresignedUploadUrl(
        'test-bucket',
        'test-key.jpg',
        'image/jpeg',
        { expiresIn: 600 }
      );

      expect(url).toBe(mockUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(PutObjectCommand),
        { expiresIn: 600 }
      );
    });

    it('should include metadata in the upload URL', async () => {
      const mockUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      await generatePresignedUploadUrl(
        'test-bucket',
        'test-key.jpg',
        'image/jpeg',
        { 
          metadata: { userId: '123', foodId: '456' },
          cacheControl: 'max-age=3600',
        }
      );

      const command = (getSignedUrl as jest.Mock).mock.calls[0][1] as PutObjectCommand;
      expect(command.input.Metadata).toEqual({ userId: '123', foodId: '456' });
      expect(command.input.CacheControl).toBe('max-age=3600');
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should generate a pre-signed download URL with default expiration', async () => {
      const mockUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      const url = await generatePresignedDownloadUrl(
        'test-bucket',
        'test-key.jpg'
      );

      expect(url).toBe(mockUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(GetObjectCommand),
        { expiresIn: PRESIGNED_URL_EXPIRATION.DOWNLOAD }
      );
    });

    it('should generate a pre-signed download URL with custom expiration', async () => {
      const mockUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      const url = await generatePresignedDownloadUrl(
        'test-bucket',
        'test-key.jpg',
        { expiresIn: 7200 }
      );

      expect(url).toBe(mockUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(GetObjectCommand),
        { expiresIn: 7200 }
      );
    });

    it('should include response headers in the download URL', async () => {
      const mockUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      await generatePresignedDownloadUrl(
        'test-bucket',
        'test-key.jpg',
        { 
          responseContentType: 'image/jpeg',
          responseContentDisposition: 'attachment; filename="food.jpg"',
        }
      );

      const command = (getSignedUrl as jest.Mock).mock.calls[0][1] as GetObjectCommand;
      expect(command.input.ResponseContentType).toBe('image/jpeg');
      expect(command.input.ResponseContentDisposition).toBe('attachment; filename="food.jpg"');
    });
  });

  describe('uploadFile', () => {
    it('should upload a file to S3', async () => {
      s3Mock.on(PutObjectCommand).resolves({
        ETag: '"abc123"',
      });

      const buffer = Buffer.from('test content');
      const etag = await uploadFile(
        'test-bucket',
        'test-key.txt',
        buffer,
        'text/plain'
      );

      expect(etag).toBe('"abc123"');
      expect(s3Mock.calls()).toHaveLength(1);
      expect(s3Mock.call(0).args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
        Body: buffer,
        ContentType: 'text/plain',
      });
    });

    it('should upload a file with metadata', async () => {
      s3Mock.on(PutObjectCommand).resolves({
        ETag: '"abc123"',
      });

      const buffer = Buffer.from('test content');
      await uploadFile(
        'test-bucket',
        'test-key.txt',
        buffer,
        'text/plain',
        {
          metadata: { userId: '123' },
          cacheControl: 'max-age=3600',
          serverSideEncryption: 'AES256',
        }
      );

      expect(s3Mock.call(0).args[0].input).toMatchObject({
        Metadata: { userId: '123' },
        CacheControl: 'max-age=3600',
        ServerSideEncryption: 'AES256',
      });
    });
  });

  describe('downloadFile', () => {
    it('should download a file from S3', async () => {
      const content = 'test content';
      const stream = Readable.from([Buffer.from(content)]);
      
      s3Mock.on(GetObjectCommand).resolves({
        Body: stream as any,
      });

      const buffer = await downloadFile('test-bucket', 'test-key.txt');

      expect(buffer.toString()).toBe(content);
      expect(s3Mock.calls()).toHaveLength(1);
      expect(s3Mock.call(0).args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
    });

    it('should throw error if file not found', async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: undefined,
      });

      await expect(
        downloadFile('test-bucket', 'test-key.txt')
      ).rejects.toThrow('File not found: test-bucket/test-key.txt');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file from S3', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});

      const result = await deleteFile('test-bucket', 'test-key.txt');

      expect(result).toBe(true);
      expect(s3Mock.calls()).toHaveLength(1);
      expect(s3Mock.call(0).args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 1024,
      });

      const exists = await fileExists('test-bucket', 'test-key.txt');

      expect(exists).toBe(true);
      expect(s3Mock.calls()).toHaveLength(1);
    });

    it('should return false if file does not exist (NotFound error)', async () => {
      s3Mock.on(HeadObjectCommand).rejects({
        name: 'NotFound',
      });

      const exists = await fileExists('test-bucket', 'test-key.txt');

      expect(exists).toBe(false);
    });

    it('should return false if file does not exist (404 status)', async () => {
      s3Mock.on(HeadObjectCommand).rejects({
        $metadata: { httpStatusCode: 404 },
      });

      const exists = await fileExists('test-bucket', 'test-key.txt');

      expect(exists).toBe(false);
    });

    it('should throw error for other errors', async () => {
      s3Mock.on(HeadObjectCommand).rejects(new Error('Access denied'));

      await expect(
        fileExists('test-bucket', 'test-key.txt')
      ).rejects.toThrow('Access denied');
    });
  });

  describe('getFileMetadata', () => {
    it('should get file metadata from S3', async () => {
      const lastModified = new Date('2024-01-01');
      
      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 1024,
        ContentType: 'image/jpeg',
        LastModified: lastModified,
        ETag: '"abc123"',
        Metadata: { userId: '123' },
      });

      const metadata = await getFileMetadata('test-bucket', 'test-key.jpg');

      expect(metadata).toEqual({
        ContentLength: 1024,
        ContentType: 'image/jpeg',
        LastModified: lastModified,
        ETag: '"abc123"',
        Metadata: { userId: '123' },
      });
    });
  });

  describe('listFiles', () => {
    it('should list files in a bucket', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'file1.txt' },
          { Key: 'file2.txt' },
          { Key: 'file3.txt' },
        ],
      });

      const files = await listFiles('test-bucket');

      expect(files).toEqual(['file1.txt', 'file2.txt', 'file3.txt']);
      expect(s3Mock.calls()).toHaveLength(1);
    });

    it('should list files with a prefix', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'users/123/file1.txt' },
          { Key: 'users/123/file2.txt' },
        ],
      });

      const files = await listFiles('test-bucket', 'users/123/');

      expect(files).toEqual(['users/123/file1.txt', 'users/123/file2.txt']);
      expect(s3Mock.call(0).args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Prefix: 'users/123/',
      });
    });

    it('should handle empty results', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      const files = await listFiles('test-bucket');

      expect(files).toEqual([]);
    });

    it('should filter out empty keys', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'file1.txt' },
          { Key: '' },
          { Key: 'file2.txt' },
          {},
        ],
      });

      const files = await listFiles('test-bucket');

      expect(files).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should respect maxKeys parameter', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: 'file1.txt' }],
      });

      await listFiles('test-bucket', undefined, 500);

      expect(s3Mock.call(0).args[0].input).toMatchObject({
        MaxKeys: 500,
      });
    });
  });

  describe('PRESIGNED_URL_EXPIRATION constants', () => {
    it('should have correct expiration values', () => {
      expect(PRESIGNED_URL_EXPIRATION.UPLOAD).toBe(300); // 5 minutes
      expect(PRESIGNED_URL_EXPIRATION.DOWNLOAD).toBe(3600); // 1 hour
      expect(PRESIGNED_URL_EXPIRATION.SHORT).toBe(60); // 1 minute
      expect(PRESIGNED_URL_EXPIRATION.LONG).toBe(86400); // 24 hours
    });
  });
});
