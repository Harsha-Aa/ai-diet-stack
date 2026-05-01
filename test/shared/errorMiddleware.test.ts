/**
 * Unit Tests for Error Middleware
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import {
  formatErrorResponse,
  withErrorHandler,
  sanitizeErrorMessage,
  extractErrorDetails,
} from '../../src/shared/middleware/errorMiddleware';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  InternalServerError,
} from '../../src/shared/errors';
import { ZodError, z } from 'zod';

describe('Error Middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('formatErrorResponse', () => {
    it('should format AppError correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const response = formatErrorResponse(error);

      expect(response.statusCode).toBe(400);
      expect(response.headers?.['Content-Type']).toBe('application/json');
      expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid input');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.statusCode).toBe(400);
      expect(body.details).toEqual({ field: 'email' });
    });

    it('should format ZodError correctly', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(1),
      });

      try {
        schema.parse({ email: 'invalid', age: -1 });
      } catch (error) {
        const response = formatErrorResponse(error as Error);

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Validation failed');
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.details.errors).toHaveLength(2);
      }
    });

    it('should format unknown errors in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Unknown error');
      const response = formatErrorResponse(error, true);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unknown error');
      expect(body.code).toBe('INTERNAL_SERVER_ERROR');
      expect(body.stack).toBeDefined();
    });

    it('should hide error details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive error message');
      const response = formatErrorResponse(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
      expect(body.stack).toBeUndefined();
    });

    it('should not include stack trace when includeStack is false', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      const response = formatErrorResponse(error, false);

      const body = JSON.parse(response.body);
      expect(body.stack).toBeUndefined();
    });
  });

  describe('withErrorHandler', () => {
    it('should return successful response for successful handler', async () => {
      const handler = async () => ({ message: 'Success' });
      const wrappedHandler = withErrorHandler(handler);

      const result = await wrappedHandler({} as any);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ message: 'Success' });
    });

    it('should return APIGatewayProxyResult as-is', async () => {
      const handler = async () => ({
        statusCode: 201,
        body: JSON.stringify({ created: true }),
        headers: { 'Content-Type': 'application/json' },
      });
      const wrappedHandler = withErrorHandler(handler);

      const result = await wrappedHandler({} as any);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.created).toBe(true);
    });

    it('should catch and format ValidationError', async () => {
      const handler = async () => {
        throw new ValidationError('Invalid email');
      };
      const wrappedHandler = withErrorHandler(handler);

      const result = await wrappedHandler({} as any);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid email');
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should catch and format AuthenticationError', async () => {
      const handler = async () => {
        throw new AuthenticationError('Invalid token');
      };
      const wrappedHandler = withErrorHandler(handler);

      const result = await wrappedHandler({} as any);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid token');
      expect(body.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should catch and format unknown errors', async () => {
      process.env.NODE_ENV = 'production';
      const handler = async () => {
        throw new Error('Unexpected error');
      };
      const wrappedHandler = withErrorHandler(handler);

      const result = await wrappedHandler({} as any);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should catch non-Error throws', async () => {
      const handler = async () => {
        throw 'String error';
      };
      const wrappedHandler = withErrorHandler(handler);

      const result = await wrappedHandler({} as any);

      expect(result.statusCode).toBe(500);
    });

    it('should handle async errors', async () => {
      const handler = async () => {
        await Promise.resolve();
        throw new ValidationError('Async error');
      };
      const wrappedHandler = withErrorHandler(handler);

      const result = await wrappedHandler({} as any);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Async error');
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should return AppError message as-is', () => {
      const error = new ValidationError('Invalid input');
      const message = sanitizeErrorMessage(error);
      expect(message).toBe('Invalid input');
    });

    it('should return generic message for unknown errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive information');
      const message = sanitizeErrorMessage(error);
      expect(message).toBe('An unexpected error occurred');
    });

    it('should return actual message for unknown errors in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Debug information');
      const message = sanitizeErrorMessage(error);
      expect(message).toBe('Debug information');
    });
  });

  describe('extractErrorDetails', () => {
    it('should extract details from AppError', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const details = extractErrorDetails(error);

      expect(details.name).toBe('ValidationError');
      expect(details.message).toBe('Invalid input');
      expect(details.code).toBe('VALIDATION_ERROR');
      expect(details.statusCode).toBe(400);
      expect(details.isOperational).toBe(true);
      expect(details.details).toEqual({ field: 'email' });
      expect(details.stack).toBeDefined();
    });

    it('should extract details from regular Error', () => {
      const error = new Error('Test error');
      const details = extractErrorDetails(error);

      expect(details.name).toBe('Error');
      expect(details.message).toBe('Test error');
      expect(details.stack).toBeDefined();
      expect(details.code).toBeUndefined();
    });

    it('should handle non-Error objects', () => {
      const details = extractErrorDetails('String error');
      expect(details.error).toBe('String error');
    });

    it('should handle null and undefined', () => {
      const nullDetails = extractErrorDetails(null);
      expect(nullDetails.error).toBe('null');

      const undefinedDetails = extractErrorDetails(undefined);
      expect(undefinedDetails.error).toBe('undefined');
    });
  });

  describe('Error Response Headers', () => {
    it('should include CORS headers', () => {
      const error = new ValidationError('Test');
      const response = formatErrorResponse(error);

      expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should include Content-Type header', () => {
      const error = new ValidationError('Test');
      const response = formatErrorResponse(error);

      expect(response.headers?.['Content-Type']).toBe('application/json');
    });
  });

  describe('Error Response Body', () => {
    it('should be valid JSON', () => {
      const error = new ValidationError('Test');
      const response = formatErrorResponse(error);

      expect(() => JSON.parse(response.body)).not.toThrow();
    });

    it('should include required fields', () => {
      const error = new ValidationError('Test');
      const response = formatErrorResponse(error);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('statusCode');
    });
  });
});
