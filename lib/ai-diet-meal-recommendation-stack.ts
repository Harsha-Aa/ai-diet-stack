import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as kms from 'aws-cdk-lib/aws-kms';
import { EnvironmentConfig } from '../config/environment';
import { getResourceName } from '../config';

export interface AiDietMealRecommendationStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
}

export class AiDietMealRecommendationStack extends cdk.Stack {
  private readonly envConfig: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: AiDietMealRecommendationStackProps) {
    super(scope, id, props);
    
    this.envConfig = props.environmentConfig;

    // KMS Key for encryption at rest (HIPAA compliance - Requirement 13.1)
    const encryptionKey = new kms.Key(this, 'EncryptionKey', {
      enableKeyRotation: true,
      description: `KMS key for encrypting sensitive health data - ${this.envConfig.environmentName}`,
      alias: getResourceName(this.envConfig, 'ai-diet-meal-recommendation-key'),
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // S3 Bucket for food images and reports
    const foodImagesBucket = new s3.Bucket(this, 'FoodImagesBucket', {
      bucketName: getResourceName(this.envConfig, 'ai-diet-food-images'),
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: this.envConfig.hipaaCompliant, // Versioning for HIPAA compliance
      lifecycleRules: [
        {
          id: 'TransitionAndExpire',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(this.envConfig.s3TransitionToIADays),
            },
          ],
          expiration: cdk.Duration.days(this.envConfig.s3ExpirationDays),
        },
      ],
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: this.envConfig.removalPolicy === 'DESTROY',
    });

    // Cognito User Pool for authentication
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: getResourceName(this.envConfig, 'ai-diet-users'),
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: this.envConfig.enableMfa ? cognito.Mfa.OPTIONAL : cognito.Mfa.OFF,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Cognito User Pool Client
    const userPoolClient = userPool.addClient('UserPoolClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.minutes(this.envConfig.sessionTimeoutMinutes),
      idTokenValidity: cdk.Duration.minutes(this.envConfig.sessionTimeoutMinutes),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // DynamoDB Tables

    // User Profiles Table
    const userProfilesTable = new dynamodb.Table(this, 'UserProfilesTable', {
      tableName: getResourceName(this.envConfig, 'ai-diet-user-profiles'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: this.envConfig.dynamoDbBillingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecovery: this.envConfig.enablePointInTimeRecovery,
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Glucose Readings Table
    const glucoseReadingsTable = new dynamodb.Table(this, 'GlucoseReadingsTable', {
      tableName: getResourceName(this.envConfig, 'ai-diet-glucose-readings'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: this.envConfig.dynamoDbBillingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecovery: this.envConfig.enablePointInTimeRecovery,
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for date-based queries
    glucoseReadingsTable.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Food Logs Table
    const foodLogsTable = new dynamodb.Table(this, 'FoodLogsTable', {
      tableName: getResourceName(this.envConfig, 'ai-diet-food-logs'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: this.envConfig.dynamoDbBillingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecovery: this.envConfig.enablePointInTimeRecovery,
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Usage Tracking Table (for freemium model)
    const usageTrackingTable = new dynamodb.Table(this, 'UsageTrackingTable', {
      tableName: getResourceName(this.envConfig, 'ai-diet-usage-tracking'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'month', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: this.envConfig.dynamoDbBillingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Activity Logs Table
    const activityLogsTable = new dynamodb.Table(this, 'ActivityLogsTable', {
      tableName: getResourceName(this.envConfig, 'ai-diet-activity-logs'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: this.envConfig.dynamoDbBillingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Lambda Execution Role with necessary permissions
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant permissions to Lambda role
    userProfilesTable.grantReadWriteData(lambdaRole);
    glucoseReadingsTable.grantReadWriteData(lambdaRole);
    foodLogsTable.grantReadWriteData(lambdaRole);
    usageTrackingTable.grantReadWriteData(lambdaRole);
    activityLogsTable.grantReadWriteData(lambdaRole);
    foodImagesBucket.grantReadWrite(lambdaRole);

    // Grant Bedrock permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: ['*'],
      })
    );

    // Grant Rekognition permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rekognition:DetectLabels', 'rekognition:DetectText'],
        resources: ['*'],
      })
    );

    // Grant Transcribe permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'transcribe:StartTranscriptionJob',
          'transcribe:GetTranscriptionJob',
          'transcribe:DeleteTranscriptionJob',
        ],
        resources: ['*'],
      })
    );

    // Grant SNS and SES permissions for notifications
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish', 'ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // API Gateway REST API
    const api = new apigateway.RestApi(this, 'AiDietApi', {
      restApiName: getResourceName(this.envConfig, 'ai-diet-api'),
      description: `API for AI-powered diabetes management platform - ${this.envConfig.environmentName}`,
      deployOptions: {
        stageName: this.envConfig.environmentName,
        loggingLevel: this.envConfig.enableDetailedLogging 
          ? apigateway.MethodLoggingLevel.INFO 
          : apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: this.envConfig.enableDetailedLogging,
        tracingEnabled: this.envConfig.enableXRayTracing,
        metricsEnabled: this.envConfig.enableDetailedMetrics,
        throttlingRateLimit: this.envConfig.apiGatewayThrottling.rateLimit,
        throttlingBurstLimit: this.envConfig.apiGatewayThrottling.burstLimit,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // CloudWatch Log Group for API Gateway
    new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/${getResourceName(this.envConfig, 'ai-diet-api')}`,
      retention: this.envConfig.logRetention,
      removalPolicy: this.envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'AiDietUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'AiDietUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'AiDietApiEndpoint',
    });

    new cdk.CfnOutput(this, 'FoodImagesBucketName', {
      value: foodImagesBucket.bucketName,
      description: 'S3 bucket for food images',
      exportName: 'AiDietFoodImagesBucket',
    });

    new cdk.CfnOutput(this, 'UserProfilesTableName', {
      value: userProfilesTable.tableName,
      description: 'DynamoDB table for user profiles',
      exportName: 'AiDietUserProfilesTable',
    });

    new cdk.CfnOutput(this, 'GlucoseReadingsTableName', {
      value: glucoseReadingsTable.tableName,
      description: 'DynamoDB table for glucose readings',
      exportName: 'AiDietGlucoseReadingsTable',
    });

    new cdk.CfnOutput(this, 'FoodLogsTableName', {
      value: foodLogsTable.tableName,
      description: 'DynamoDB table for food logs',
      exportName: 'AiDietFoodLogsTable',
    });

    new cdk.CfnOutput(this, 'UsageTrackingTableName', {
      value: usageTrackingTable.tableName,
      description: 'DynamoDB table for usage tracking',
      exportName: 'AiDietUsageTrackingTable',
    });

    new cdk.CfnOutput(this, 'ActivityLogsTableName', {
      value: activityLogsTable.tableName,
      description: 'DynamoDB table for activity logs',
      exportName: 'AiDietActivityLogsTable',
    });
  }
}
