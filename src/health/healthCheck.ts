import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * Health check endpoint for monitoring and smoke tests
 * Returns 200 OK with system status
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'AI Diet & Meal Recommendation System',
      version: process.env.VERSION || '1.0.0',
      environment: process.env.STAGE || 'dev',
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Health check error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
