/**
 * Lambda function for retrieving user profile
 * GET /auth/profile
 * 
 * Requires authentication via API Gateway authorizer
 * Returns user profile data from DynamoDB
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { getItem } from '../shared/dynamodb';
import { successResponse, errorResponse } from '../shared/utils';
import { ERROR_CODES, HTTP_STATUS } from '../shared/constants';

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || '';

/**
 * Handler function with authentication middleware
 */
export const handler = withAuth(
  async (
    event: APIGatewayProxyEvent,
    user: AuthenticatedUser
  ): Promise<APIGatewayProxyResult> => {
    try {
      console.log('Get profile request', { userId: user.userId });

      // Retrieve user profile from DynamoDB
      const profile = await getItem(USER_PROFILES_TABLE, { userId: user.userId });

      if (!profile) {
        console.error('User profile not found', { userId: user.userId });
        return {
          statusCode: HTTP_STATUS.NOT_FOUND,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(
            errorResponse(ERROR_CODES.NOT_FOUND, 'User profile not found')
          ),
        };
      }

      console.log('User profile retrieved successfully', { userId: user.userId });

      return {
        statusCode: HTTP_STATUS.OK,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(successResponse({ user: profile })),
      };
    } catch (error) {
      console.error('Error retrieving user profile:', error);

      return {
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(
          errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Failed to retrieve user profile')
        ),
      };
    }
  }
);
