/**
 * Lambda function for token refresh
 * POST /auth/refresh
 * 
 * Refreshes access and ID tokens using a valid refresh token
 * Maintains 60-minute session timeout for new tokens
 * 
 * Requirement 1: User Login and Session Management
 * Requirement 13.5: 60-minute session timeout
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  InitiateAuthCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import { successResponse, errorResponse } from '../shared/utils';
import { ERROR_CODES, HTTP_STATUS } from '../shared/constants';
import { z } from 'zod';

const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '';

/**
 * Validation schema for refresh token request
 */
const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

/**
 * Handle token refresh with Cognito
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Token refresh request received');

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
    
    // Validate refresh token
    const validationResult = refreshTokenSchema.safeParse(body);
    if (!validationResult.success) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(
          errorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
          )
        ),
      };
    }

    const { refresh_token } = validationResult.data;

    console.log('Refresh token validated');

    // Initiate token refresh with Cognito
    const authParams: InitiateAuthCommandInput = {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: USER_POOL_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refresh_token,
      },
    };

    const authCommand = new InitiateAuthCommand(authParams);
    const authResult: InitiateAuthCommandOutput = await cognitoClient.send(authCommand);

    // Check if token refresh was successful
    if (!authResult.AuthenticationResult) {
      console.error('Token refresh failed: No authentication result returned');
      return {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(
          errorResponse(ERROR_CODES.UNAUTHORIZED, 'Token refresh failed')
        ),
      };
    }

    const {
      AccessToken,
      IdToken,
      ExpiresIn,
    } = authResult.AuthenticationResult;

    // Note: Cognito does not return a new refresh token in REFRESH_TOKEN_AUTH flow
    // The original refresh token remains valid until it expires (30 days)

    console.log('Tokens refreshed successfully', {
      expiresIn: ExpiresIn,
    });

    // Return new JWT tokens
    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(
        successResponse({
          access_token: AccessToken,
          id_token: IdToken,
          expires_in: ExpiresIn, // 3600 seconds (60 minutes)
          token_type: 'Bearer',
        })
      ),
    };
  } catch (error) {
    console.error('Error during token refresh:', error);

    // Handle Cognito errors
    if (error instanceof Error) {
      // Invalid or expired refresh token
      if (error.name === 'NotAuthorizedException') {
        return {
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(
              ERROR_CODES.UNAUTHORIZED,
              'Invalid or expired refresh token. Please log in again.'
            )
          ),
        };
      }

      // User not found (user may have been deleted)
      if (error.name === 'UserNotFoundException') {
        return {
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(ERROR_CODES.UNAUTHORIZED, 'User not found. Please log in again.')
          ),
        };
      }

      // Too many requests
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
              'Too many token refresh attempts. Please try again later.'
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
        errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Failed to refresh tokens')
      ),
    };
  }
};
