/**
 * Centralized Error Handler Middleware
 * 
 * Provides consistent error handling across all Lambda functions with:
 * - Structured error responses
 * - Proper HTTP status codes
 * - Error logging
 * - Security (no stack traces in production)
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { AppError, isAppError, isOperationalError } from '../errors';
import { Logger, createLogger } from '../logger';
import { ZodError } from 'zod';

const logger = createLogger({ component: 'ErrorMiddleware' });

/**
 * Format error response for API Gateway
 */
export function formatErrorResponse(error: Error, includeStack: boolean = false): APIGatewayProxyResult {
  // Handle AppError instances
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(error.toJSON()),
    };
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: {
          errors: validationErrors,
        },
      }),
    };
  }

  // Handle unknown errors (don't expose internal details in production)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = 500;

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: isDevelopment ? error.message : 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      statusCode,
      ...(isDevelopment && includeStack && { stack: error.stack }),
    }),
  };
}

/**
 * Error handler middleware wrapper
 * Wraps Lambda handlers to catch and format errors
 */
export function withErrorHandler<TEvent = any, TResult = any>(
  handler: (event: TEvent) => Promise<TResult>
): (event: TEvent) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent): Promise<APIGatewayProxyResult> => {
    try {
      const result = await handler(event);
      
      // If result is already an APIGatewayProxyResult, return it
      if (
        typeof result === 'object' &&
        result !== null &&
        'statusCode' in result &&
        'body' in result
      ) {
        return result as unknown as APIGatewayProxyResult;
      }

      // Otherwise, wrap in success response
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          data: result,
        }),
      };
    } catch (error) {
      // Log the error
      if (error instanceof Error) {
        if (isOperationalError(error)) {
          // Operational errors (expected) - log as warning
          logger.warn('Operational error occurred', {
            error: error.message,
            code: (error as any).code,
            statusCode: (error as any).statusCode,
          });
        } else {
          // Programming errors (unexpected) - log as error with full details
          logger.error('Unexpected error occurred', error, {
            event: JSON.stringify(event),
          });
        }
      } else {
        // Non-Error objects
        logger.error('Unknown error occurred', undefined, {
          error: String(error),
          event: JSON.stringify(event),
        });
      }

      // Format and return error response
      const isDevelopment = process.env.NODE_ENV === 'development';
      return formatErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        isDevelopment
      );
    }
  };
}

/**
 * Async error handler for non-API Gateway Lambda functions
 */
export async function handleError(error: unknown, context?: Record<string, any>): Promise<void> {
  if (error instanceof Error) {
    if (isOperationalError(error)) {
      logger.warn('Operational error occurred', {
        error: error.message,
        code: (error as any).code,
        ...context,
      });
    } else {
      logger.error('Unexpected error occurred', error, context);
    }
  } else {
    logger.error('Unknown error occurred', undefined, {
      error: String(error),
      ...context,
    });
  }
}

/**
 * Create a safe error message for external display
 * Removes sensitive information and stack traces
 */
export function sanitizeErrorMessage(error: Error): string {
  if (isAppError(error)) {
    return error.message;
  }

  // For unknown errors, return generic message in production
  if (process.env.NODE_ENV === 'production') {
    return 'An unexpected error occurred';
  }

  return error.message;
}

/**
 * Extract error details for logging
 */
export function extractErrorDetails(error: unknown): Record<string, any> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(isAppError(error) && {
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        details: error.details,
      }),
    };
  }

  return {
    error: String(error),
  };
}
