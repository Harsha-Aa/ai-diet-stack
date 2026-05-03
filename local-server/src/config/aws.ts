import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { TranscribeClient } from '@aws-sdk/client-transcribe';

// AWS Region
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// AWS Credentials
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
};

// Validate credentials
if (!credentials.accessKeyId || !credentials.secretAccessKey) {
  console.warn('⚠️  AWS credentials not configured. Using mock data mode.');
}

// DynamoDB Client
const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials,
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

// S3 Client
export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials,
});

// Cognito Client
export const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
  credentials,
});

// Bedrock Client
export const bedrockClient = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials,
});

// Rekognition Client
export const rekognitionClient = new RekognitionClient({
  region: AWS_REGION,
  credentials,
});

// Transcribe Client
export const transcribeClient = new TranscribeClient({
  region: AWS_REGION,
  credentials,
});

// Export region for use in other modules
export const awsRegion = AWS_REGION;

// Check if AWS is configured
export const isAWSConfigured = (): boolean => {
  return !!(credentials.accessKeyId && credentials.secretAccessKey);
};

console.log(`✅ AWS SDK configured for region: ${AWS_REGION}`);
console.log(`✅ AWS credentials: ${isAWSConfigured() ? 'Configured' : 'Not configured (using mock mode)'}`);
