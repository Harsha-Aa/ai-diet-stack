/**
 * Unit Tests for Custom Error Classes
 */

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  UsageLimitError,
  RateLimitError,
  ExternalServiceError,
  BedrockServiceError,
  DynamoDBError,
  S3Error,
  CognitoError,
  InternalServerError,
  ServiceUnavailableError,
  isAppError,
  isOperationalError,
} from '../../src/shared/errors';

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR', { field: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    it('should default to 500 status code', () => {
      const error = new AppError('Test error');
      expect(error.statusCode).toBe(500);
    });

    it('should convert to JSON correctly', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR', { field: 'test' });
      const json = error.toJSON();
      
      expect(json).toEqual({
        error: 'Test error',
        code: 'TEST_ERROR',
        statusCode: 400,
        details: { field: 'test' },
      });
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with 401 status', () => {
      const error = new AuthenticationError('Invalid token');
      
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should use default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Authentication failed');
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error with 403 status', () => {
      const error = new AuthorizationError('Insufficient permissions');
      
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('should use default message', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Access denied');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should use default resource name', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with 409 status', () => {
      const error = new ConflictError('Email already exists');
      
      expect(error.message).toBe('Email already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
    });
  });

  describe('UsageLimitError', () => {
    it('should create usage limit error with correct properties', () => {
      const error = new UsageLimitError('food_analysis', 25, 26, '2024-02-01');
      
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('USAGE_LIMIT_EXCEEDED');
      expect(error.feature).toBe('food_analysis');
      expect(error.limit).toBe(25);
      expect(error.used).toBe(26);
      expect(error.resetDate).toBe('2024-02-01');
      expect(error.details?.upgradePrompt).toBeDefined();
    });

    it('should use default message', () => {
      const error = new UsageLimitError('test_feature', 10, 11);
      expect(error.message).toContain('Usage limit exceeded');
      expect(error.message).toContain('test_feature');
    });

    it('should use custom message', () => {
      const error = new UsageLimitError('test_feature', 10, 11, undefined, 'Custom message');
      expect(error.message).toBe('Custom message');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with 429 status', () => {
      const error = new RateLimitError('Too many requests', 60);
      
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.details?.retryAfter).toBe(60);
    });

    it('should use default message', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Rate limit exceeded');
    });
  });

  describe('ExternalServiceError', () => {
    it('should create external service error with 502 status', () => {
      const cause = new Error('Connection timeout');
      const error = new ExternalServiceError('AWS', 'Connection failed', cause);
      
      expect(error.message).toBe('AWS service error: Connection failed');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.service).toBe('AWS');
      expect(error.details?.cause).toBe('Connection timeout');
    });
  });

  describe('BedrockServiceError', () => {
    it('should create Bedrock service error', () => {
      const error = new BedrockServiceError('Model not available');
      
      expect(error.message).toBe('Bedrock service error: Model not available');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('Bedrock');
      expect(error.name).toBe('BedrockServiceError');
    });
  });

  describe('DynamoDBError', () => {
    it('should create DynamoDB error', () => {
      const error = new DynamoDBError('Table not found');
      
      expect(error.message).toBe('DynamoDB service error: Table not found');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('DynamoDB');
      expect(error.name).toBe('DynamoDBError');
    });
  });

  describe('S3Error', () => {
    it('should create S3 error', () => {
      const error = new S3Error('Bucket not accessible');
      
      expect(error.message).toBe('S3 service error: Bucket not accessible');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('S3');
      expect(error.name).toBe('S3Error');
    });
  });

  describe('CognitoError', () => {
    it('should create Cognito error', () => {
      const error = new CognitoError('User pool not found');
      
      expect(error.message).toBe('Cognito service error: User pool not found');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('Cognito');
      expect(error.name).toBe('CognitoError');
    });
  });

  describe('InternalServerError', () => {
    it('should create internal server error with 500 status', () => {
      const error = new InternalServerError('Unexpected error');
      
      expect(error.message).toBe('Unexpected error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.isOperational).toBe(false);
    });

    it('should use default message', () => {
      const error = new InternalServerError();
      expect(error.message).toBe('Internal server error');
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error with 503 status', () => {
      const error = new ServiceUnavailableError('Maintenance mode', 300);
      
      expect(error.message).toBe('Maintenance mode');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.details?.retryAfter).toBe(300);
    });

    it('should use default message', () => {
      const error = new ServiceUnavailableError();
      expect(error.message).toBe('Service temporarily unavailable');
    });
  });

  describe('Type Guards', () => {
    describe('isAppError', () => {
      it('should return true for AppError instances', () => {
        const error = new AppError('Test');
        expect(isAppError(error)).toBe(true);
      });

      it('should return true for AppError subclasses', () => {
        const error = new ValidationError('Test');
        expect(isAppError(error)).toBe(true);
      });

      it('should return false for regular Error', () => {
        const error = new Error('Test');
        expect(isAppError(error)).toBe(false);
      });

      it('should return false for non-error objects', () => {
        expect(isAppError({})).toBe(false);
        expect(isAppError(null)).toBe(false);
        expect(isAppError(undefined)).toBe(false);
      });
    });

    describe('isOperationalError', () => {
      it('should return true for operational errors', () => {
        const error = new ValidationError('Test');
        expect(isOperationalError(error)).toBe(true);
      });

      it('should return false for non-operational errors', () => {
        const error = new InternalServerError('Test');
        expect(isOperationalError(error)).toBe(false);
      });

      it('should return false for regular Error', () => {
        const error = new Error('Test');
        expect(isOperationalError(error)).toBe(false);
      });

      it('should return false for non-error objects', () => {
        expect(isOperationalError({})).toBe(false);
        expect(isOperationalError(null)).toBe(false);
      });
    });
  });

  describe('Error Inheritance', () => {
    it('should maintain instanceof relationships', () => {
      const error = new ValidationError('Test');
      
      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should maintain instanceof for service errors', () => {
      const error = new BedrockServiceError('Test');
      
      expect(error instanceof BedrockServiceError).toBe(true);
      expect(error instanceof ExternalServiceError).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });
});
