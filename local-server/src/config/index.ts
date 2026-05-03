import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    
    // Cognito
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID || 'us-east-1_mzKjA4m2a',
      clientId: process.env.COGNITO_CLIENT_ID || '59kkpi3ujptbngvp8im8sft1mi',
    },
    
    // DynamoDB Tables
    tables: {
      users: process.env.DYNAMODB_USER_PROFILES_TABLE || 'dev-ai-diet-user-profiles',
      userProfiles: process.env.DYNAMODB_USER_PROFILES_TABLE || 'dev-ai-diet-user-profiles',
      glucoseReadings: process.env.DYNAMODB_GLUCOSE_TABLE || 'dev-ai-diet-glucose-readings',
      foodLogs: process.env.DYNAMODB_FOOD_LOGS_TABLE || 'dev-ai-diet-food-logs',
      usageTracking: process.env.DYNAMODB_USAGE_TRACKING_TABLE || 'dev-ai-diet-usage-tracking',
      aiInsights: process.env.DYNAMODB_AI_INSIGHTS_TABLE || 'dev-ai-diet-ai-insights',
      predictions: process.env.DYNAMODB_PREDICTIONS_TABLE || 'dev-ai-diet-predictions',
      activityLogs: process.env.DYNAMODB_ACTIVITY_LOGS_TABLE || 'dev-ai-diet-activity-logs',
      providerAccess: process.env.DYNAMODB_PROVIDER_ACCESS_TABLE || 'dev-ai-diet-provider-access',
      auditLogs: process.env.DYNAMODB_AUDIT_LOGS_TABLE || 'dev-ai-diet-audit-logs',
    },
    
    // S3 Buckets
    buckets: {
      foodImages: process.env.S3_FOOD_IMAGES_BUCKET || 'dev-ai-diet-food-images',
      reports: process.env.S3_REPORTS_BUCKET || 'dev-ai-diet-reports',
      glucoseUploads: process.env.S3_GLUCOSE_UPLOADS_BUCKET || 'dev-ai-diet-glucose-uploads',
    },
    
    // Bedrock
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
      region: process.env.BEDROCK_REGION || 'us-east-1',
    },
    
    // API
    apiEndpoint: process.env.API_ENDPOINT || 'https://u4d3l1pdk1.execute-api.us-east-1.amazonaws.com/dev/',
  },
  
  // Feature Flags
  useMockData: process.env.USE_MOCK_DATA === 'true',
  enableAWSServices: process.env.ENABLE_AWS_SERVICES !== 'false',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];
  
  if (config.enableAWSServices) {
    if (!config.aws.accessKeyId) {
      errors.push('AWS_ACCESS_KEY_ID is required when AWS services are enabled');
    }
    if (!config.aws.secretAccessKey) {
      errors.push('AWS_SECRET_ACCESS_KEY is required when AWS services are enabled');
    }
    if (!config.aws.cognito.userPoolId) {
      errors.push('COGNITO_USER_POOL_ID is required');
    }
    if (!config.aws.cognito.clientId) {
      errors.push('COGNITO_CLIENT_ID is required');
    }
  }
  
  if (errors.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    errors.forEach(error => console.warn(`   - ${error}`));
    console.warn('⚠️  Falling back to mock data mode');
    config.useMockData = true;
    config.enableAWSServices = false;
  }
}

// Run validation on import
validateConfig();

export default config;
