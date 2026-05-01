# Authentication Middleware Examples

Real-world examples of using the authentication middleware in Lambda functions.

## Example 1: Simple Protected Endpoint

```typescript
// src/glucose/getReadings.ts
import { withAuth } from '../shared/middleware/authMiddleware';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuth(async (event, user) => {
  // User is automatically authenticated and typed
  const { userId } = user;

  // Query glucose readings for this user
  const result = await docClient.send(
    new QueryCommand({
      TableName: process.env.GLUCOSE_TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      Limit: 100,
    })
  );

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      readings: result.Items,
      count: result.Count,
    }),
  };
});
```

## Example 2: Premium Feature with Tier Check

```typescript
// src/ai/predictGlucose.ts
import { withAuth, isPremiumUser } from '../shared/middleware/authMiddleware';
import { checkUsageLimit, trackUsage } from '../shared/utils/usageTracker';

export const handler = withAuth(async (event, user) => {
  // Check if user is premium (unlimited access)
  if (!isPremiumUser(user)) {
    // Check usage limit for free users
    const hasLimit = await checkUsageLimit(user.userId, 'glucose_prediction');
    
    if (!hasLimit) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Usage limit exceeded',
          message: 'You have reached your monthly limit for glucose predictions',
          limit: 20,
          upgradeUrl: '/subscription/upgrade',
        }),
      };
    }
  }

  // Parse request body
  const body = JSON.parse(event.body || '{}');
  const { foodLogId, currentGlucose } = body;

  // Call AI prediction service
  const prediction = await generateGlucosePrediction({
    userId: user.userId,
    foodLogId,
    currentGlucose,
  });

  // Track usage for free users
  if (!isPremiumUser(user)) {
    await trackUsage(user.userId, 'glucose_prediction');
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prediction,
    }),
  };
});
```

## Example 3: Type 1 Diabetes Specific Feature

```typescript
// src/ai/calculateInsulin.ts
import { withAuth, isType1Diabetic } from '../shared/middleware/authMiddleware';

export const handler = withAuth(async (event, user) => {
  // Insulin dose calculator is only for Type 1 diabetics
  if (!isType1Diabetic(user)) {
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Feature not available',
        message: 'Insulin dose calculator is only available for Type 1 diabetes users',
      }),
    };
  }

  // Parse request
  const body = JSON.parse(event.body || '{}');
  const { carbsGrams, currentGlucose, targetGlucose } = body;

  // Get user's insulin settings from profile
  const profile = await getUserProfile(user.userId);
  const { insulinToCarbRatio, correctionFactor } = profile;

  // Calculate insulin dose
  const carbDose = carbsGrams / insulinToCarbRatio;
  const correctionDose = (currentGlucose - targetGlucose) / correctionFactor;
  const totalDose = Math.max(0, carbDose + correctionDose);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recommendedDose: totalDose,
      calculationBreakdown: {
        carbDose,
        correctionDose,
        totalDose,
      },
      disclaimer: 'This is a suggestion only. Always consult your healthcare provider.',
    }),
  };
});
```

## Example 4: Token Expiry Warning

```typescript
// src/glucose/createReading.ts
import {
  withAuth,
  isTokenExpiringSoon,
  getTokenRemainingSeconds,
} from '../shared/middleware/authMiddleware';

export const handler = withAuth(async (event, user) => {
  // Parse request
  const body = JSON.parse(event.body || '{}');
  const { readingValue, readingUnit, notes } = body;

  // Save glucose reading
  const reading = await saveGlucoseReading({
    userId: user.userId,
    readingValue,
    readingUnit,
    notes,
    timestamp: new Date().toISOString(),
  });

  // Check if token is expiring soon
  const response: any = {
    reading,
  };

  if (isTokenExpiringSoon(user)) {
    const remainingSeconds = getTokenRemainingSeconds(user);
    response.warning = {
      message: 'Your session is expiring soon. Please refresh your token.',
      expiresInSeconds: remainingSeconds,
    };
  }

  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response),
  };
});
```

## Example 5: Composing Multiple Middleware

```typescript
// src/food/recognizeFood.ts
import { withAuth, isPremiumUser } from '../shared/middleware/authMiddleware';
import { withErrorHandler } from '../shared/middleware/errorHandler';
import { withUsageLimit } from '../shared/middleware/usageLimiter';

// Compose middleware: error handling → auth → usage limiting → business logic
export const handler = withErrorHandler(
  withAuth(
    withUsageLimit('food_recognition')(
      async (event, user) => {
        // All middleware has run:
        // 1. Error handler catches any errors
        // 2. Auth extracts user context
        // 3. Usage limiter checks/tracks usage

        const body = JSON.parse(event.body || '{}');
        const { s3Key } = body;

        // Call Rekognition for food recognition
        const recognizedItems = await recognizeFood(s3Key);

        // Call Bedrock for nutrient analysis
        const nutrients = await analyzeNutrients(recognizedItems);

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            foodItems: recognizedItems,
            nutrients,
            usageInfo: isPremiumUser(user)
              ? { tier: 'premium', unlimited: true }
              : { tier: 'free', remaining: await getRemainingUsage(user.userId, 'food_recognition') },
          }),
        };
      }
    )
  )
);
```

## Example 6: Manual Context Extraction (Advanced)

```typescript
// src/provider/getPatientData.ts
import { extractUserContext, AuthenticationError } from '../shared/middleware/authMiddleware';
import { APIGatewayProxyEvent } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    // Manually extract user context
    const user = extractUserContext(event);

    // Get patient ID from path parameters
    const patientId = event.pathParameters?.patientId;

    if (!patientId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing patientId' }),
      };
    }

    // Check if this user (healthcare provider) has access to this patient
    const hasAccess = await checkProviderAccess(user.userId, patientId);

    if (!hasAccess) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Access denied',
          message: 'You do not have access to this patient data',
        }),
      };
    }

    // Get patient data
    const patientData = await getPatientData(patientId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: error.message,
        }),
      };
    }

    // Log unexpected errors
    console.error('Unexpected error', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
};
```

## Example 7: Audit Logging with User Context

```typescript
// src/shared/utils/auditLogger.ts
import { AuthenticatedUser } from '../middleware/authMiddleware';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function logAuditEvent(
  user: AuthenticatedUser,
  action: string,
  resourceType: string,
  resourceId: string,
  result: 'success' | 'failure',
  errorMessage?: string
) {
  await docClient.send(
    new PutCommand({
      TableName: process.env.AUDIT_LOG_TABLE_NAME,
      Item: {
        userId: user.userId,
        timestamp: new Date().toISOString(),
        actionType: action,
        actorId: user.userId,
        actorType: 'user',
        actorEmail: user.email,
        resourceType,
        resourceId,
        result,
        errorMessage,
      },
    })
  );
}

// Usage in a Lambda function
import { withAuth } from '../shared/middleware/authMiddleware';
import { logAuditEvent } from '../shared/utils/auditLogger';

export const handler = withAuth(async (event, user) => {
  try {
    // Perform action
    const reading = await createGlucoseReading(user.userId, data);

    // Log successful action
    await logAuditEvent(
      user,
      'create_glucose_reading',
      'glucose_reading',
      reading.id,
      'success'
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ reading }),
    };
  } catch (error) {
    // Log failed action
    await logAuditEvent(
      user,
      'create_glucose_reading',
      'glucose_reading',
      'unknown',
      'failure',
      error.message
    );

    throw error;
  }
});
```

## Example 8: User-Specific Data Access

```typescript
// src/analytics/getDashboard.ts
import { withAuth } from '../shared/middleware/authMiddleware';

export const handler = withAuth(async (event, user) => {
  // Get query parameters
  const period = event.queryStringParameters?.period || '30d';

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  
  switch (period) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '14d':
      startDate.setDate(startDate.getDate() - 14);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  // Get glucose readings for this user only
  const readings = await getGlucoseReadings(
    user.userId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Calculate metrics
  const metrics = {
    eA1C: calculateEA1C(readings),
    timeInRange: calculateTIR(readings, user.targetGlucoseMin, user.targetGlucoseMax),
    averageGlucose: calculateAverage(readings),
    glucoseVariability: calculateVariability(readings),
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      period,
      metrics,
      dataPoints: readings.length,
    }),
  };
});
```

## Testing Examples

### Unit Test with Mock User Context

```typescript
// test/glucose/getReadings.test.ts
import { handler } from '../../src/glucose/getReadings';
import { APIGatewayProxyEvent } from 'aws-lambda';

describe('Get Glucose Readings', () => {
  const createMockEvent = (userId: string): APIGatewayProxyEvent => ({
    // ... standard event fields
    requestContext: {
      // ... standard context fields
      authorizer: {
        userId,
        email: 'test@example.com',
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: Math.floor(Date.now() / 1000 - 300).toString(),
        tokenExpiresAt: Math.floor(Date.now() / 1000 + 3300).toString(),
      },
    },
  } as any);

  it('should return glucose readings for authenticated user', async () => {
    const event = createMockEvent('user-123');
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.readings).toBeDefined();
  });
});
```

## Common Patterns

### Pattern 1: Early Return for Authorization

```typescript
export const handler = withAuth(async (event, user) => {
  // Check authorization first
  if (!isPremiumUser(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Premium required' }),
    };
  }

  // Continue with business logic
  // ...
});
```

### Pattern 2: Conditional Features

```typescript
export const handler = withAuth(async (event, user) => {
  const features = {
    basicFeature: true,
    premiumFeature: isPremiumUser(user),
    insulinCalculator: isType1Diabetic(user),
  };

  return {
    statusCode: 200,
    body: JSON.stringify({ features }),
  };
});
```

### Pattern 3: User-Scoped Queries

```typescript
export const handler = withAuth(async (event, user) => {
  // Always scope queries to the authenticated user
  const data = await queryData({
    userId: user.userId, // Use authenticated user ID, not from request
    // ... other parameters
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ data }),
  };
});
```
