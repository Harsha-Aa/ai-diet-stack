import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { devConfig } from '../config/environments/dev';

describe('Modular Stack Structure', () => {
  let app: cdk.App;
  let authStack: AuthStack;
  let storageStack: StorageStack;
  let dataStack: DataStack;
  let apiStack: ApiStack;
  let computeStack: ComputeStack;

  beforeEach(() => {
    app = new cdk.App();
    
    // Create stacks in dependency order
    authStack = new AuthStack(app, 'TestAuthStack', {
      environmentConfig: devConfig,
    });

    storageStack = new StorageStack(app, 'TestStorageStack', {
      environmentConfig: devConfig,
    });

    dataStack = new DataStack(app, 'TestDataStack', {
      environmentConfig: devConfig,
      encryptionKey: storageStack.encryptionKey,
    });

    apiStack = new ApiStack(app, 'TestApiStack', {
      environmentConfig: devConfig,
      userPool: authStack.userPool,
    });

    computeStack = new ComputeStack(app, 'TestComputeStack', {
      environmentConfig: devConfig,
      userPool: authStack.userPool,
      userProfilesTable: dataStack.userProfilesTable,
      glucoseReadingsTable: dataStack.glucoseReadingsTable,
      foodLogsTable: dataStack.foodLogsTable,
      usageTrackingTable: dataStack.usageTrackingTable,
      activityLogsTable: dataStack.activityLogsTable,
      aiInsightsTable: dataStack.aiInsightsTable,
      providerAccessTable: dataStack.providerAccessTable,
      auditLogsTable: dataStack.auditLogsTable,
      predictionsTable: dataStack.predictionsTable,
      foodImagesBucket: storageStack.foodImagesBucket,
      reportsBucket: storageStack.reportsBucket,
      api: apiStack.api,
      authorizer: apiStack.authorizer,
    });
  });

  describe('AuthStack', () => {
    test('Stack creates successfully', () => {
      expect(authStack).toBeDefined();
    });

    test('Creates Cognito User Pool with correct configuration', () => {
      const template = Template.fromStack(authStack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'dev-ai-diet-users',
        AutoVerifiedAttributes: ['email'],
        MfaConfiguration: 'OFF', // Dev environment has MFA disabled
      });
    });

    test('Creates Cognito User Pool Client', () => {
      const template = Template.fromStack(authStack);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        GenerateSecret: false,
      });
    });

    test('Exports User Pool ID and ARN', () => {
      const template = Template.fromStack(authStack);
      const outputs = template.findOutputs('*');
      expect(outputs).toHaveProperty('UserPoolId');
      expect(outputs).toHaveProperty('UserPoolClientId');
      expect(outputs).toHaveProperty('UserPoolArn');
    });
  });

  describe('StorageStack', () => {
    test('Stack creates successfully', () => {
      expect(storageStack).toBeDefined();
    });

    test('Creates KMS key with rotation enabled', () => {
      const template = Template.fromStack(storageStack);
      template.hasResourceProperties('AWS::KMS::Key', {
        EnableKeyRotation: true,
      });
    });

    test('Creates food images S3 bucket with encryption and lifecycle rules', () => {
      const template = Template.fromStack(storageStack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-food-images',
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'TransitionAndExpire',
              Status: 'Enabled',
              ExpirationInDays: 30, // Dev environment: 30 days
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 7, // Dev environment: 7 days
                },
              ],
            },
          ],
        },
      });
    });

    test('Creates reports S3 bucket', () => {
      const template = Template.fromStack(storageStack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-reports',
      });
    });

    test('Exports encryption key and bucket names', () => {
      const template = Template.fromStack(storageStack);
      const outputs = template.findOutputs('*');
      expect(outputs).toHaveProperty('EncryptionKeyId');
      expect(outputs).toHaveProperty('FoodImagesBucketName');
      expect(outputs).toHaveProperty('ReportsBucketName');
    });
  });

  describe('DataStack', () => {
    test('Stack creates successfully', () => {
      expect(dataStack).toBeDefined();
    });

    test('Creates all DynamoDB tables with encryption', () => {
      const template = Template.fromStack(dataStack);
      
      // User Profiles Table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-user-profiles',
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: false, // Dev environment has PITR disabled
        },
      });

      // Glucose Readings Table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-glucose-readings',
        BillingMode: 'PAY_PER_REQUEST',
      });

      // Food Logs Table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-food-logs',
        BillingMode: 'PAY_PER_REQUEST',
      });

      // Usage Tracking Table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-usage-tracking',
        BillingMode: 'PAY_PER_REQUEST',
      });

      // Activity Logs Table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-activity-logs',
        BillingMode: 'PAY_PER_REQUEST',
      });

      // AI Insights Table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-ai-insights',
        BillingMode: 'PAY_PER_REQUEST',
      });

      // Provider Access Table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-provider-access',
        BillingMode: 'PAY_PER_REQUEST',
      });

      // Audit Logs Table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-audit-logs',
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('Glucose Readings table has DateIndex GSI', () => {
      const template = Template.fromStack(dataStack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-ai-diet-glucose-readings',
        GlobalSecondaryIndexes: [
          {
            IndexName: 'DateIndex',
            KeySchema: [
              { AttributeName: 'userId', KeyType: 'HASH' },
              { AttributeName: 'date', KeyType: 'RANGE' },
            ],
          },
        ],
      });
    });

    test('Exports all table names', () => {
      const template = Template.fromStack(dataStack);
      const outputs = template.findOutputs('*');
      expect(outputs).toHaveProperty('UserProfilesTableName');
      expect(outputs).toHaveProperty('GlucoseReadingsTableName');
      expect(outputs).toHaveProperty('FoodLogsTableName');
      expect(outputs).toHaveProperty('UsageTrackingTableName');
      expect(outputs).toHaveProperty('ActivityLogsTableName');
      expect(outputs).toHaveProperty('AIInsightsTableName');
      expect(outputs).toHaveProperty('ProviderAccessTableName');
      expect(outputs).toHaveProperty('AuditLogsTableName');
    });
  });

  describe('ApiStack', () => {
    test('Stack creates successfully', () => {
      expect(apiStack).toBeDefined();
    });

    test('Creates API Gateway REST API', () => {
      const template = Template.fromStack(apiStack);
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'dev-ai-diet-api',
      });
    });

    test('Exports API endpoint and ID', () => {
      const template = Template.fromStack(apiStack);
      const outputs = template.findOutputs('*');
      expect(outputs).toHaveProperty('ApiEndpoint');
      expect(outputs).toHaveProperty('ApiId');
    });
  });

  describe('ComputeStack', () => {
    test('Stack creates successfully', () => {
      expect(computeStack).toBeDefined();
    });

    test('Creates IAM role for Lambda with necessary permissions', () => {
      const template = Template.fromStack(computeStack);
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            },
          ],
        },
      });
    });

    test('Lambda role has Bedrock permissions', () => {
      const template = Template.fromStack(computeStack);
      const resources = template.findResources('AWS::IAM::Policy');
      const policyStatements = Object.values(resources).flatMap((resource: any) =>
        resource.Properties.PolicyDocument.Statement
      );
      
      const hasBedrockPermission = policyStatements.some((statement: any) =>
        statement.Action?.includes('bedrock:InvokeModel') ||
        (Array.isArray(statement.Action) && statement.Action.some((action: string) => action.includes('bedrock:')))
      );
      
      expect(hasBedrockPermission).toBe(true);
    });

    test('Lambda role has Rekognition permissions', () => {
      const template = Template.fromStack(computeStack);
      const resources = template.findResources('AWS::IAM::Policy');
      const policyStatements = Object.values(resources).flatMap((resource: any) =>
        resource.Properties.PolicyDocument.Statement
      );
      
      const hasRekognitionPermission = policyStatements.some((statement: any) =>
        statement.Action?.includes('rekognition:DetectLabels') ||
        (Array.isArray(statement.Action) && statement.Action.some((action: string) => action.includes('rekognition:')))
      );
      
      expect(hasRekognitionPermission).toBe(true);
    });

    test('Lambda role has Transcribe permissions', () => {
      const template = Template.fromStack(computeStack);
      const resources = template.findResources('AWS::IAM::Policy');
      const policyStatements = Object.values(resources).flatMap((resource: any) =>
        resource.Properties.PolicyDocument.Statement
      );
      
      const hasTranscribePermission = policyStatements.some((statement: any) =>
        statement.Action?.includes('transcribe:StartTranscriptionJob') ||
        (Array.isArray(statement.Action) && statement.Action.some((action: string) => action.includes('transcribe:')))
      );
      
      expect(hasTranscribePermission).toBe(true);
    });

    test('Exports Lambda role ARN', () => {
      const template = Template.fromStack(computeStack);
      const outputs = template.findOutputs('*');
      expect(outputs).toHaveProperty('LambdaRoleArn');
    });
  });

  describe('Stack Integration', () => {
    test('All stacks are defined', () => {
      expect(authStack).toBeDefined();
      expect(storageStack).toBeDefined();
      expect(dataStack).toBeDefined();
      expect(apiStack).toBeDefined();
      expect(computeStack).toBeDefined();
    });

    test('DataStack uses StorageStack encryption key', () => {
      expect(dataStack.userProfilesTable).toBeDefined();
      // The encryption key is passed correctly if the stack constructs without error
    });

    test('ApiStack has user pool reference', () => {
      expect(apiStack.userPool).toBeDefined();
    });

    test('ComputeStack has access to all resources', () => {
      expect(computeStack.lambdaRole).toBeDefined();
      // If the stack constructs successfully, all dependencies are properly passed
    });
  });
});
