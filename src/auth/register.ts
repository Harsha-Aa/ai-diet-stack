/**
 * Lambda function for user registration
 * POST /auth/register
 * 
 * Creates user in Cognito User Pool and stores profile in DynamoDB
 * Assigns Free_User tier by default
 * Calculates BMI from height and weight
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminAddUserToGroupCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { putItem } from '../shared/dynamodb';
import { getCurrentTimestamp, successResponse, errorResponse } from '../shared/utils';
import { validate } from '../shared/validators';
import { registrationSchema } from './validators';
import { UserProfile, UserTier, DiabetesType } from '../shared/types';
import { ERROR_CODES, HTTP_STATUS } from '../shared/constants';
import { ZodError } from 'zod';

const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.USER_POOL_ID || '';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '';
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || '';

/**
 * Calculate BMI from weight (kg) and height (cm)
 * Formula: weight(kg) / (height(m))^2
 */
function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

/**
 * Map DiabetesType enum to string for Cognito custom attribute
 */
function mapDiabetesTypeToString(diabetesType: DiabetesType): string {
  switch (diabetesType) {
    case DiabetesType.PRE_DIABETES:
      return 'pre-diabetes';
    case DiabetesType.TYPE_1:
      return 'type1';
    case DiabetesType.TYPE_2:
      return 'type2';
    default:
      return 'unknown';
  }
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Registration request received');

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(
          errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Request body is required')
        ),
      };
    }

    const body = JSON.parse(event.body);
    const validatedData = validate(registrationSchema, body);

    console.log('Input validated successfully', { email: validatedData.email });

    // Step 1: Create user in Cognito User Pool
    const signUpCommand = new SignUpCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: validatedData.email,
      Password: validatedData.password,
      UserAttributes: [
        {
          Name: 'email',
          Value: validatedData.email,
        },
        {
          Name: 'custom:subscription_tier',
          Value: 'free',
        },
        {
          Name: 'custom:diabetes_type',
          Value: mapDiabetesTypeToString(validatedData.diabetesType),
        },
      ],
    });

    const signUpResult = await cognitoClient.send(signUpCommand);
    const userId = signUpResult.UserSub!;

    console.log('User created in Cognito', { userId, email: validatedData.email });

    // Step 2: Calculate BMI
    const bmi = calculateBMI(validatedData.weight, validatedData.height);

    // Step 3: Create user profile in DynamoDB
    const userProfile: UserProfile = {
      userId,
      email: validatedData.email,
      diabetesType: validatedData.diabetesType,
      age: validatedData.age,
      weight: validatedData.weight,
      height: validatedData.height,
      targetGlucoseMin: validatedData.targetGlucoseMin,
      targetGlucoseMax: validatedData.targetGlucoseMax,
      tier: UserTier.FREE,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    };

    // Add BMI to profile (extend the type inline)
    const profileWithBMI = {
      ...userProfile,
      bmi,
    };

    await putItem(USER_PROFILES_TABLE, profileWithBMI, {
      ConditionExpression: 'attribute_not_exists(userId)',
    });

    console.log('User profile created in DynamoDB', { userId });

    // Return success response (exclude password from response)
    return {
      statusCode: HTTP_STATUS.CREATED,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(
        successResponse({
          userId,
          email: validatedData.email,
          subscriptionTier: 'free',
          message: 'Registration successful. Please check your email to verify your account.',
        })
      ),
    };
  } catch (error) {
    console.error('Error during registration:', error);

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(
          errorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
          )
        ),
      };
    }

    // Handle Cognito errors
    if (error instanceof Error) {
      if (error.name === 'UsernameExistsException') {
        return {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(ERROR_CODES.VALIDATION_ERROR, 'User with this email already exists')
          ),
        };
      }

      if (error.name === 'InvalidPasswordException') {
        return {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(
              ERROR_CODES.VALIDATION_ERROR,
              'Password does not meet security requirements'
            )
          ),
        };
      }

      if (error.name === 'ConditionalCheckFailedException') {
        return {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(ERROR_CODES.VALIDATION_ERROR, 'User profile already exists')
          ),
        };
      }
    }

    // Generic error response
    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(
        errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Failed to register user')
      ),
    };
  }
};
