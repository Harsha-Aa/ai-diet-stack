# Authentication Middleware

JWT token validation middleware for Lambda functions behind API Gateway with Lambda Authorizer.

## Overview

The `authMiddleware` extracts and validates user context from API Gateway's authorizer context. The Lambda Authorizer (Task 2.4) validates JWT tokens from Cognito and passes user information through API Gateway's `requestContext.authorizer` object. This middleware provides type-safe access to that authenticated user information.

## Features

- ✅ Extract user context from API Gateway authorizer
- ✅ Type-safe `AuthenticatedUser` interface
- ✅ Middleware wrapper function for Lambda handlers
- ✅ Graceful error handling for missing authentication
- ✅ Helper functions for common checks (premium user, Type 1 diabetic, token expiry)
- ✅ Comprehensive unit tests

## Architecture

```
┌─────────────────┐
│  Mobile Client  │
└────────┬────────┘
         │ JWT Token in Authorization header
         ▼
┌─────────────────┐
│  API Gateway    │
└────────┬────────┘
         │ Invokes Lambda Authorizer
         ▼
┌─────────────────┐
│ Lambda          │  Validates JWT token
│ Authorizer      │  Extracts user claims
│ (Task 2.4)      │  Returns IAM policy + context
└────────┬────────┘
         │ User context in requestContext.authorizer
         ▼
┌─────────────────┐
│ Lambda Function │  withAuth() middleware
│ (Your Handler)  │  Extracts & validates context
└─────────────────┘
```

## Usage

### Basic Usage

```typescript
import { withAuth } from './shared/middleware/authMiddleware';

export const handler = withAuth(async (event, user) => {
  // user is typed as AuthenticatedUser
  console.log(`Request from user: ${user.userId}`);
  console.log(`Email: ${user.email}`);
  console.log(`Subscription: ${user.subscriptionTier}`);
  console.log(`Diabetes type: ${user.diabetesType}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Success',
      userId: user.userId,
    }),
  };
});
```

### Using Helper Functions

```typescript
import {
  withAuth,
  isPremiumUser,
  isType1Diabetic,
  getTokenRemainingSeconds,
  isTokenExpiringSoon,
} from './shared/middleware/authMiddleware';

export const handler = withAuth(async (event, user) => {
  // Check subscription tier
  if (!isPremiumUser(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Premium subscription required',
        upgradeUrl: '/subscription/upgrade',
      }),
    };
  }

  // Check diabetes type for Type 1 specific features
  if (isType1Diabetic(user)) {
    // Provide insulin dose calculator
    console.log('User has Type 1 diabetes - enabling insulin features');
  }

  // Check token expiry
  if (isTokenExpiringSoon(user)) {
    console.warn('Token expiring soon - user may need to refresh');
  }

  const remainingSeconds = getTokenRemainingSeconds(user);
  console.log(`Token valid for ${remainingSeconds} more seconds`);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
});
```

### Composing with Other Middleware

```typescript
import { withAuth } from './shared/middleware/authMiddleware';
import { withErrorHandler } from './shared/middleware/errorHandler';
import { withUsageLimit } from './shared/middleware/usageLimiter';

// Compose middleware (right to left execution)
export const handler = withErrorHandler(
  withAuth(
    withUsageLimit('food_recognition')(
      async (event, user) => {
        // Business logic here
        // - Error handling from withErrorHandler
        // - Authentication from withAuth
        // - Usage limiting from withUsageLimit

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true }),
        };
      }
    )
  )
);
```

### Manual Context Extraction

If you need to extract user context without using the middleware wrapper:

```typescript
import { extractUserContext, AuthenticationError } from './shared/middleware/authMiddleware';
import { APIGatewayProxyEvent } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const user = extractUserContext(event);
    
    // Use user context
    console.log(`User ID: ${user.userId}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ userId: user.userId }),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({
          error: 'Unauthorized',
          message: error.message,
        }),
      };
    }
    throw error;
  }
};
```

## AuthenticatedUser Interface

```typescript
interface AuthenticatedUser {
  userId: string;                                    // Cognito sub (user ID)
  email: string;                                     // User email
  subscriptionTier: 'free' | 'premium';              // Subscription tier
  diabetesType: 'pre-diabetes' | 'type1' | 'type2' | 'unknown'; // Diabetes type
  tokenIssuedAt: number;                             // Unix timestamp (seconds)
  tokenExpiresAt: number;                            // Unix timestamp (seconds)
}
```

## Helper Functions

### `isPremiumUser(user: AuthenticatedUser): boolean`

Check if user has premium subscription.

```typescript
if (isPremiumUser(user)) {
  // Unlimited AI features
} else {
  // Check usage limits
}
```

### `isType1Diabetic(user: AuthenticatedUser): boolean`

Check if user has Type 1 diabetes.

```typescript
if (isType1Diabetic(user)) {
  // Show insulin dose calculator
}
```

### `getTokenRemainingSeconds(user: AuthenticatedUser): number`

Get remaining token validity in seconds.

```typescript
const remaining = getTokenRemainingSeconds(user);
console.log(`Token expires in ${remaining} seconds`);
```

### `isTokenExpiringSoon(user: AuthenticatedUser): boolean`

Check if token expires within 5 minutes.

```typescript
if (isTokenExpiringSoon(user)) {
  // Warn user to refresh token
  console.warn('Token expiring soon');
}
```

## Error Handling

The middleware handles authentication errors gracefully:

```typescript
// Missing authentication context
{
  statusCode: 401,
  body: {
    error: "Unauthorized",
    message: "Missing authentication context. Request must be authenticated through API Gateway authorizer."
  }
}

// Invalid userId
{
  statusCode: 401,
  body: {
    error: "Unauthorized",
    message: "Invalid authentication context: missing or invalid userId"
  }
}

// Invalid subscriptionTier
{
  statusCode: 401,
  body: {
    error: "Unauthorized",
    message: "Invalid authentication context: missing or invalid subscriptionTier"
  }
}
```

## Testing

The middleware includes comprehensive unit tests covering:

- ✅ Valid user context extraction
- ✅ Premium and free tier users
- ✅ All diabetes type variations (pre-diabetes, type1, type2, unknown)
- ✅ Missing authentication context
- ✅ Invalid or missing fields
- ✅ Token timestamp parsing
- ✅ Helper function behavior
- ✅ Error handling and logging

Run tests:

```bash
npm test -- test/middleware/authMiddleware.test.ts
```

## Integration with Lambda Authorizer

The middleware expects the Lambda Authorizer (Task 2.4) to pass the following context:

```typescript
// Lambda Authorizer returns this in the IAM policy context
{
  userId: string;              // From JWT 'sub' claim
  email: string;               // From JWT 'username' or 'email' claim
  subscriptionTier: string;    // From JWT 'custom:subscription_tier' claim
  diabetesType: string;        // From JWT 'custom:diabetes_type' claim
  tokenIssuedAt: string;       // From JWT 'iat' claim (as string)
  tokenExpiresAt: string;      // From JWT 'exp' claim (as string)
}
```

API Gateway passes this context to Lambda functions in `event.requestContext.authorizer`.

## Security Considerations

1. **Authentication is Required**: The middleware throws an error if authentication context is missing. This ensures all protected endpoints require valid JWT tokens.

2. **Token Validation**: JWT validation is performed by the Lambda Authorizer (Task 2.4) before the request reaches your Lambda function. The middleware only extracts and validates the context structure.

3. **Session Timeout**: The Lambda Authorizer enforces a 60-minute session timeout (Requirement 13.5). The middleware provides helper functions to check token expiry.

4. **Audit Logging**: The middleware logs all authenticated requests for audit purposes (Requirement 13.3).

## Related Components

- **Lambda Authorizer** (`src/auth/authorizer.ts`): Validates JWT tokens and generates IAM policies
- **API Gateway**: Routes requests and invokes Lambda Authorizer
- **Cognito User Pool**: Issues JWT tokens with user claims
- **Usage Limiter Middleware**: Enforces usage limits for free users (Task 2.6)
- **Error Handler Middleware**: Centralized error handling (Task 2.7)

## Requirements Satisfied

- ✅ **Requirement 13.4**: System SHALL authenticate all API requests through Cognito_User_Pool with JWT tokens
- ✅ **Requirement 13.5**: System SHALL expire user sessions after 60 minutes of inactivity (enforced by authorizer, checked by middleware)
- ✅ **Requirement 13.3**: System SHALL implement HIPAA-compliant access controls and audit logging

## Next Steps

After implementing this middleware:

1. **Task 2.6**: Implement usage limiting middleware for free tier users
2. **Task 2.7**: Implement centralized error handling middleware
3. **Task 3.x**: Use `withAuth()` in all protected Lambda functions
