/**
 * Lambda function for updating user profile
 * PUT /auth/profile
 * 
 * Requires authentication via API Gateway authorizer
 * Updates user profile data in DynamoDB
 * Recalculates BMI if weight or height is updated
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { getItem, updateItem } from '../shared/dynamodb';
import { getCurrentTimestamp, successResponse, errorResponse } from '../shared/utils';
import { validate } from '../shared/validators';
import { updateProfileSchema } from './validators';
import { ERROR_CODES, HTTP_STATUS } from '../shared/constants';
import { ZodError } from 'zod';

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
 * Build DynamoDB update expression from validated data
 */
function buildUpdateExpression(data: Record<string, any>): {
  updateExpression: string;
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues: Record<string, any>;
} {
  const updates: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  let index = 0;
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const nameKey = `#attr${index}`;
      const valueKey = `:val${index}`;
      updates.push(`${nameKey} = ${valueKey}`);
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[valueKey] = value;
      index++;
    }
  }

  // Always update the updatedAt timestamp
  updates.push(`#updatedAt = :updatedAt`);
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = getCurrentTimestamp();

  return {
    updateExpression: `SET ${updates.join(', ')}`,
    expressionAttributeNames,
    expressionAttributeValues,
  };
}

/**
 * Handler function with authentication middleware
 */
export const handler = withAuth(
  async (
    event: APIGatewayProxyEvent,
    user: AuthenticatedUser
  ): Promise<APIGatewayProxyResult> => {
    try {
      console.log('Update profile request', { userId: user.userId });

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
      const validatedData = validate(updateProfileSchema, body);

      console.log('Input validated successfully', { userId: user.userId });

      // Get current profile to check if weight/height changed
      const currentProfile = await getItem<any>(USER_PROFILES_TABLE, { userId: user.userId });

      if (!currentProfile) {
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

      // Prepare update data
      const updateData: Record<string, any> = { ...validatedData };

      // Recalculate BMI if weight or height changed
      const newWeight = validatedData.weight ?? currentProfile.weight;
      const newHeight = validatedData.height ?? currentProfile.height;

      if (validatedData.weight || validatedData.height) {
        updateData.bmi = calculateBMI(newWeight, newHeight);
        console.log('BMI recalculated', { bmi: updateData.bmi });
      }

      // Build update expression
      const { updateExpression, expressionAttributeNames, expressionAttributeValues } =
        buildUpdateExpression(updateData);

      // Update profile in DynamoDB
      const updatedProfile = await updateItem(
        USER_PROFILES_TABLE,
        { userId: user.userId },
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames
      );

      console.log('User profile updated successfully', { userId: user.userId });

      return {
        statusCode: HTTP_STATUS.OK,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(
          successResponse({
            user: updatedProfile,
            message: 'Profile updated successfully',
          })
        ),
      };
    } catch (error) {
      console.error('Error updating user profile:', error);

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

      return {
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(
          errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Failed to update user profile')
        ),
      };
    }
  }
);
