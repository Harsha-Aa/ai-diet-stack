/**
 * Lambda function for user login
 * POST /auth/login
 * 
 * Authenticates user with Cognito User Pool using USER_PASSWORD_AUTH flow
 * Returns JWT tokens (access, refresh, ID) with 60-minute expiry
 * 
 * Requirement 1: User Login and Session Management
 * Requirement 13.4: JWT token authentication
 * Requirement 13.5: 60-minute session timeout
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  InitiateAuthCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import { validate } from '../shared/validators';
import { loginSchema } from './validators';
import { successResponse, errorResponse } from '../shared/utils';
import { ERROR_CODES, HTTP_STATUS } from '../shared/constants';
import { ZodError } from 'zod';

const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '';

/**
 * Handle user login with Cognito
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Login request received');

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
    const validatedData = validate(loginSchema, body);

    console.log('Input validated successfully', { email: validatedData.email });

    // Initiate authentication with Cognito
    const authParams: InitiateAuthCommandInput = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: validatedData.email,
        PASSWORD: validatedData.password,
      },
    };

    const authCommand = new InitiateAuthCommand(authParams);
    const authResult: InitiateAuthCommandOutput = await cognitoClient.send(authCommand);

    // Check if authentication was successful
    if (!authResult.AuthenticationResult) {
      console.error('Authentication failed: No authentication result returned');
      return {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(
          errorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication failed')
        ),
      };
    }

    const {
      AccessToken,
      RefreshToken,
      IdToken,
      ExpiresIn,
    } = authResult.AuthenticationResult;

    console.log('User authenticated successfully', {
      email: validatedData.email,
      expiresIn: ExpiresIn,
    });

    // Return JWT tokens
    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(
        successResponse({
          access_token: AccessToken,
          refresh_token: RefreshToken,
          id_token: IdToken,
          expires_in: ExpiresIn, // 3600 seconds (60 minutes)
          token_type: 'Bearer',
        })
      ),
    };
  } catch (error) {
    console.error('Error during login:', error);

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
      // User not found
      if (error.name === 'UserNotFoundException') {
        return {
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password')
          ),
        };
      }

      // Incorrect password
      if (error.name === 'NotAuthorizedException') {
        return {
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password')
          ),
        };
      }

      // User not confirmed (email verification pending)
      if (error.name === 'UserNotConfirmedException') {
        return {
          statusCode: HTTP_STATUS.FORBIDDEN,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(
              ERROR_CODES.FORBIDDEN,
              'Email verification required. Please check your email and verify your account.'
            )
          ),
        };
      }

      // Too many failed login attempts
      if (error.name === 'TooManyRequestsException') {
        return {
          statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(
              ERROR_CODES.TOO_MANY_REQUESTS,
              'Too many login attempts. Please try again later.'
            )
          ),
        };
      }

      // Password reset required
      if (error.name === 'PasswordResetRequiredException') {
        return {
          statusCode: HTTP_STATUS.FORBIDDEN,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(
              ERROR_CODES.FORBIDDEN,
              'Password reset required. Please reset your password.'
            )
          ),
        };
      }

      // Invalid user pool configuration
      if (error.name === 'InvalidUserPoolConfigurationException') {
        console.error('Invalid Cognito User Pool configuration', { error });
        return {
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Authentication service misconfigured')
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
        errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Failed to authenticate user')
      ),
    };
  }
};
