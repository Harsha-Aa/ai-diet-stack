/**
 * Custom Error Classes for AI Diet Meal Recommendation System
 * 
 * Provides standardized error handling with HTTP status codes and structured error responses.
 * All custom errors extend the base AppError class for consistent error handling.
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown (V8 only)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON format for API responses
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code || this.name,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Validation Error (400 Bad Request)
 * Thrown when request data fails validation
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication Error (401 Unauthorized)
 * Thrown when authentication fails or token is invalid
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: Record<string, any>) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Authorization Error (403 Forbidden)
 * Thrown when user lacks permission to access resource
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', details?: Record<string, any>) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Not Found Error (404 Not Found)
 * Thrown when requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: Record<string, any>) {
    super(`${resource} not found`, 404, 'NOT_FOUND', details);
  }
}

/**
 * Conflict Error (409 Conflict)
 * Thrown when request conflicts with existing data (e.g., duplicate email)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

/**
 * Usage Limit Error (429 Too Many Requests)
 * Thrown when user exceeds their usage limits (freemium enforcement)
 */
export class UsageLimitError extends AppError {
  public readonly feature: string;
  public readonly limit: number;
  public readonly used: number;
  public readonly resetDate?: string;

  constructor(
    feature: string,
    limit: number,
    used: number,
    resetDate?: string,
    message?: string
  ) {
    const defaultMessage = message || `Usage limit exceeded for ${feature}. Limit: ${limit}, Used: ${used}`;
    super(defaultMessage, 429, 'USAGE_LIMIT_EXCEEDED', {
      feature,
      limit,
      used,
      resetDate,
      upgradePrompt: 'Upgrade to premium for unlimited access',
    });
    this.feature = feature;
    this.limit = limit;
    this.used = used;
    this.resetDate = resetDate;
  }
}

/**
 * Rate Limit Error (429 Too Many Requests)
 * Thrown when API rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', {
      retryAfter,
      message: 'Too many requests. Please try again later.',
    });
  }
}

/**
 * External Service Error (502 Bad Gateway)
 * Thrown when external service (AWS, Bedrock, etc.) fails
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string, cause?: Error) {
    super(`${service} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', {
      service,
      cause: cause?.message,
    });
    this.service = service;
  }
}

/**
 * Bedrock Service Error (502 Bad Gateway)
 * Thrown when Amazon Bedrock API fails
 */
export class BedrockServiceError extends ExternalServiceError {
  constructor(message: string, cause?: Error) {
    super('Bedrock', message, cause);
    this.name = 'BedrockServiceError';
  }
}

/**
 * DynamoDB Error (502 Bad Gateway)
 * Thrown when DynamoDB operations fail
 */
export class DynamoDBError extends ExternalServiceError {
  constructor(message: string, cause?: Error) {
    super('DynamoDB', message, cause);
    this.name = 'DynamoDBError';
  }
}

/**
 * S3 Error (502 Bad Gateway)
 * Thrown when S3 operations fail
 */
export class S3Error extends ExternalServiceError {
  constructor(message: string, cause?: Error) {
    super('S3', message, cause);
    this.name = 'S3Error';
  }
}

/**
 * Cognito Error (502 Bad Gateway)
 * Thrown when Cognito operations fail
 */
export class CognitoError extends ExternalServiceError {
  constructor(message: string, cause?: Error) {
    super('Cognito', message, cause);
    this.name = 'CognitoError';
  }
}

/**
 * Internal Server Error (500 Internal Server Error)
 * Thrown for unexpected server errors
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details, false);
  }
}

/**
 * Service Unavailable Error (503 Service Unavailable)
 * Thrown when service is temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', retryAfter?: number) {
    super(message, 503, 'SERVICE_UNAVAILABLE', { retryAfter });
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: any): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}
