import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/stacks/data-stack';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import { EnvironmentConfig } from '../config/environment';

describe('DataStack - ActivityLogsTable', () => {
  let app: cdk.App;
  let stack: DataStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    
    const envConfig: EnvironmentConfig = {
      environmentName: 'dev',
      resourcePrefix: 'test',
      resourceSuffix: 'test',
      tags: {},
      logRetention: logs.RetentionDays.ONE_WEEK,
      enableDetailedLogging: false,
      enablePointInTimeRecovery: true,
      backupRetentionDays: 7,
      enableCostOptimization: false,
      enableEncryption: true,
      enableMfa: false,
      apiGatewayThrottling: {
        rateLimit: 100,
        burstLimit: 200,
      },
      lambdaMemorySize: 256,
      lambdaTimeout: cdk.Duration.seconds(30),
      dynamoDbBillingMode: 'PAY_PER_REQUEST',
      s3TransitionToIADays: 30,
      s3ExpirationDays: 90,
      enableXRayTracing: false,
      enableDetailedMetrics: false,
      hipaaCompliant: true,
      sessionTimeoutMinutes: 60,
      removalPolicy: 'DESTROY',
    };

    // Create a temporary stack for the KMS key
    const keyStack = new cdk.Stack(app, 'TestKeyStack');
    const encryptionKey = new kms.Key(keyStack, 'TestKey', {
      enableKeyRotation: true,
    });

    stack = new DataStack(app, 'TestDataStack', {
      environmentConfig: envConfig,
      encryptionKey,
    });

    template = Template.fromStack(stack);
  });

  test('ActivityLogsTable has correct partition key (user_id)', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        {
          AttributeName: 'user_id',
          KeyType: 'HASH',
        },
        {
          AttributeName: 'timestamp',
          KeyType: 'RANGE',
        },
      ],
    });
  });

  test('ActivityLogsTable has KMS encryption enabled', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      SSESpecification: {
        SSEEnabled: true,
        SSEType: 'KMS',
      },
    });
  });

  test('ActivityLogsTable has on-demand capacity mode', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('ActivityLogsTable has point-in-time recovery enabled', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });
  });

  test('ActivityLogsTable has correct attribute definitions', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      AttributeDefinitions: [
        {
          AttributeName: 'user_id',
          AttributeType: 'S',
        },
        {
          AttributeName: 'timestamp',
          AttributeType: 'S',
        },
      ],
    });
  });
});

describe('DataStack - AIInsightsTable', () => {
  let app: cdk.App;
  let stack: DataStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    
    const envConfig: EnvironmentConfig = {
      environmentName: 'dev',
      resourcePrefix: 'test',
      resourceSuffix: 'test',
      tags: {},
      logRetention: logs.RetentionDays.ONE_WEEK,
      enableDetailedLogging: false,
      enablePointInTimeRecovery: true,
      backupRetentionDays: 7,
      enableCostOptimization: false,
      enableEncryption: true,
      enableMfa: false,
      apiGatewayThrottling: {
        rateLimit: 100,
        burstLimit: 200,
      },
      lambdaMemorySize: 256,
      lambdaTimeout: cdk.Duration.seconds(30),
      dynamoDbBillingMode: 'PAY_PER_REQUEST',
      s3TransitionToIADays: 30,
      s3ExpirationDays: 90,
      enableXRayTracing: false,
      enableDetailedMetrics: false,
      hipaaCompliant: true,
      sessionTimeoutMinutes: 60,
      removalPolicy: 'DESTROY',
    };

    // Create a temporary stack for the KMS key
    const keyStack = new cdk.Stack(app, 'TestKeyStack');
    const encryptionKey = new kms.Key(keyStack, 'TestKey', {
      enableKeyRotation: true,
    });

    stack = new DataStack(app, 'TestDataStack', {
      environmentConfig: envConfig,
      encryptionKey,
    });

    template = Template.fromStack(stack);
  });

  test('AIInsightsTable has TTL enabled with expiresAt attribute', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TimeToLiveSpecification: {
        AttributeName: 'expiresAt',
        Enabled: true,
      },
    });
  });

  test('AIInsightsTable has correct partition and sort keys', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        {
          AttributeName: 'userId',
          KeyType: 'HASH',
        },
        {
          AttributeName: 'insightId',
          KeyType: 'RANGE',
        },
      ],
    });
  });

  test('AIInsightsTable has KMS encryption enabled', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      SSESpecification: {
        SSEEnabled: true,
        SSEType: 'KMS',
      },
    });
  });

  test('AIInsightsTable has CreatedAtIndex GSI', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: [
        {
          IndexName: 'CreatedAtIndex',
          KeySchema: [
            {
              AttributeName: 'userId',
              KeyType: 'HASH',
            },
            {
              AttributeName: 'createdAt',
              KeyType: 'RANGE',
            },
          ],
          Projection: {
            ProjectionType: 'ALL',
          },
        },
      ],
    });
  });
});
