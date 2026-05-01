import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { EnvironmentConfig } from '../../config/environment';
import { getResourceName } from '../../config';

export interface ApiStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  userPool: cognito.IUserPool;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly userPool: cognito.IUserPool;
  public readonly authorizer: apigateway.TokenAuthorizer;
  public readonly glucoseReadingRequestModel: apigateway.IModel;
  public readonly foodAnalysisRequestModel: apigateway.IModel;
  public readonly userRegistrationRequestModel: apigateway.IModel;
  public readonly successResponseModel: apigateway.IModel;
  public readonly errorResponseModel: apigateway.IModel;
  private readonly envConfig: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.envConfig = props.environmentConfig;
    this.userPool = props.userPool;

    // API Gateway REST API
    this.api = new apigateway.RestApi(this, 'AiDietApi', {
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

    // ========================================
    // Request/Response Validation Models (Task 11.3)
    // ========================================

    // Glucose Reading Request Model
    const glucoseReadingRequestModel = this.api.addModel('GlucoseReadingRequest', {
      contentType: 'application/json',
      modelName: 'GlucoseReadingRequest',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'Glucose Reading Request',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          glucose_value: {
            type: apigateway.JsonSchemaType.NUMBER,
            minimum: 20,
            maximum: 600,
            description: 'Glucose value in mg/dL (20-600)',
          },
          timestamp: {
            type: apigateway.JsonSchemaType.STRING,
            format: 'date-time',
            description: 'ISO 8601 timestamp',
          },
          notes: {
            type: apigateway.JsonSchemaType.STRING,
            maxLength: 500,
            description: 'Optional notes',
          },
        },
        required: ['glucose_value'],
      },
    });
    this.glucoseReadingRequestModel = glucoseReadingRequestModel;

    // Food Analysis Request Model
    const foodAnalysisRequestModel = this.api.addModel('FoodAnalysisRequest', {
      contentType: 'application/json',
      modelName: 'FoodAnalysisRequest',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'Food Analysis Request',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          description: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 1,
            maxLength: 500,
            description: 'Food description text',
          },
        },
        required: ['description'],
      },
    });
    this.foodAnalysisRequestModel = foodAnalysisRequestModel;

    // User Registration Request Model
    const userRegistrationRequestModel = this.api.addModel('UserRegistrationRequest', {
      contentType: 'application/json',
      modelName: 'UserRegistrationRequest',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'User Registration Request',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          email: {
            type: apigateway.JsonSchemaType.STRING,
            format: 'email',
            description: 'User email address',
          },
          password: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 12,
            description: 'Password (min 12 characters)',
          },
          age: {
            type: apigateway.JsonSchemaType.INTEGER,
            minimum: 1,
            maximum: 120,
            description: 'User age',
          },
          weight_kg: {
            type: apigateway.JsonSchemaType.NUMBER,
            minimum: 1,
            maximum: 500,
            description: 'Weight in kg',
          },
          height_cm: {
            type: apigateway.JsonSchemaType.NUMBER,
            minimum: 50,
            maximum: 300,
            description: 'Height in cm',
          },
          diabetes_type: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['type1', 'type2', 'prediabetes', 'gestational'],
            description: 'Diabetes type',
          },
        },
        required: ['email', 'password', 'age', 'weight_kg', 'height_cm', 'diabetes_type'],
      },
    });
    this.userRegistrationRequestModel = userRegistrationRequestModel;

    // Standard Success Response Model
    const successResponseModel = this.api.addModel('SuccessResponse', {
      contentType: 'application/json',
      modelName: 'SuccessResponse',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'Success Response',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          success: {
            type: apigateway.JsonSchemaType.BOOLEAN,
            description: 'Operation success status',
          },
          data: {
            type: apigateway.JsonSchemaType.OBJECT,
            description: 'Response data',
          },
          message: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Success message',
          },
        },
        required: ['success'],
      },
    });
    this.successResponseModel = successResponseModel;

    // Error Response Model
    const errorResponseModel = this.api.addModel('ErrorResponse', {
      contentType: 'application/json',
      modelName: 'ErrorResponse',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'Error Response',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          error: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Error message',
          },
          code: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Error code',
          },
          details: {
            type: apigateway.JsonSchemaType.OBJECT,
            description: 'Additional error details',
          },
        },
        required: ['error'],
      },
    });
    this.errorResponseModel = errorResponseModel;

    // Lambda Authorizer Function
    const authorizerFunction = new lambda.Function(this, 'ApiAuthorizer', {
      functionName: getResourceName(this.envConfig, 'api-authorizer'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'authorizer.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist/src/auth')),
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
        USER_POOL_CLIENT_ID: props.userPool.userPoolId, // Will be set by ComputeStack
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      description: 'Lambda authorizer for API Gateway JWT validation',
      logRetention: this.envConfig.logRetention,
    });

    // Token Authorizer for API Gateway
    this.authorizer = new apigateway.TokenAuthorizer(this, 'TokenAuthorizer', {
      handler: authorizerFunction,
      identitySource: 'method.request.header.Authorization',
      authorizerName: getResourceName(this.envConfig, 'token-authorizer'),
      resultsCacheTtl: cdk.Duration.minutes(5), // Cache authorization results for 5 minutes
    });

    // Create resource structure (routes will be added by ComputeStack)
    // /auth
    const authResource = this.api.root.addResource('auth');
    authResource.addResource('register');
    authResource.addResource('login');
    authResource.addResource('profile');

    // /glucose
    const glucoseResource = this.api.root.addResource('glucose');
    glucoseResource.addResource('readings');
    glucoseResource.addResource('cgm-sync');

    // /food
    const foodResource = this.api.root.addResource('food');
    foodResource.addResource('upload-image');
    foodResource.addResource('recognize');
    foodResource.addResource('analyze-text');
    foodResource.addResource('voice-entry');

    // /ai
    const aiResource = this.api.root.addResource('ai');
    aiResource.addResource('predict-glucose');
    aiResource.addResource('recommend-meal');
    aiResource.addResource('analyze-patterns');
    aiResource.addResource('calculate-insulin');

    // /analytics
    const analyticsResource = this.api.root.addResource('analytics');
    analyticsResource.addResource('dashboard');
    analyticsResource.addResource('agp-report');

    // /activity
    const activityResource = this.api.root.addResource('activity');
    activityResource.addResource('log');
    activityResource.addResource('logs');

    // /provider
    const providerResource = this.api.root.addResource('provider');
    providerResource.addResource('invite');
    providerResource.addResource('access');

    // /subscription
    const subscriptionResource = this.api.root.addResource('subscription');
    subscriptionResource.addResource('usage');
    subscriptionResource.addResource('upgrade');

    // ========================================
    // Usage Plans and Rate Limiting (Tasks 11.5, 11.7)
    // ========================================

    // Free Tier Usage Plan
    const freeTierPlan = this.api.addUsagePlan('FreeTierPlan', {
      name: getResourceName(this.envConfig, 'free-tier-plan'),
      description: 'Free tier usage plan with rate limiting',
      throttle: {
        rateLimit: 10, // 10 requests per second
        burstLimit: 20, // Allow bursts up to 20 requests
      },
      quota: {
        limit: 1000, // 1000 requests per month
        period: apigateway.Period.MONTH,
      },
    });

    // Premium Tier Usage Plan
    const premiumTierPlan = this.api.addUsagePlan('PremiumTierPlan', {
      name: getResourceName(this.envConfig, 'premium-tier-plan'),
      description: 'Premium tier usage plan with higher limits',
      throttle: {
        rateLimit: 100, // 100 requests per second (Requirement 11.5)
        burstLimit: 200, // Allow bursts up to 200 requests
      },
      quota: {
        limit: 100000, // 100,000 requests per month
        period: apigateway.Period.MONTH,
      },
    });

    // Associate usage plans with API stage
    freeTierPlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    premiumTierPlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Create API Keys for testing (in production, these would be generated per user)
    const freeApiKey = this.api.addApiKey('FreeApiKey', {
      apiKeyName: getResourceName(this.envConfig, 'free-api-key'),
      description: 'API key for free tier testing',
    });

    const premiumApiKey = this.api.addApiKey('PremiumApiKey', {
      apiKeyName: getResourceName(this.envConfig, 'premium-api-key'),
      description: 'API key for premium tier testing',
    });

    // Associate API keys with usage plans
    freeTierPlan.addApiKey(freeApiKey);
    premiumTierPlan.addApiKey(premiumApiKey);

    // Stack Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${this.envConfig.resourcePrefix}-AiDietApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway REST API ID',
      exportName: `${this.envConfig.resourcePrefix}-AiDietApiId`,
    });

    new cdk.CfnOutput(this, 'ApiRootResourceId', {
      value: this.api.root.resourceId,
      description: 'API Gateway root resource ID',
      exportName: `${this.envConfig.resourcePrefix}-AiDietApiRootResourceId`,
    });

    new cdk.CfnOutput(this, 'AuthorizerFunctionArn', {
      value: authorizerFunction.functionArn,
      description: 'Lambda authorizer function ARN',
      exportName: `${this.envConfig.resourcePrefix}-AuthorizerFunctionArn`,
    });

    new cdk.CfnOutput(this, 'FreeTierPlanId', {
      value: freeTierPlan.usagePlanId,
      description: 'Free tier usage plan ID',
      exportName: `${this.envConfig.resourcePrefix}-FreeTierPlanId`,
    });

    new cdk.CfnOutput(this, 'PremiumTierPlanId', {
      value: premiumTierPlan.usagePlanId,
      description: 'Premium tier usage plan ID',
      exportName: `${this.envConfig.resourcePrefix}-PremiumTierPlanId`,
    });

    new cdk.CfnOutput(this, 'FreeApiKeyId', {
      value: freeApiKey.keyId,
      description: 'Free tier API key ID',
      exportName: `${this.envConfig.resourcePrefix}-FreeApiKeyId`,
    });

    new cdk.CfnOutput(this, 'PremiumApiKeyId', {
      value: premiumApiKey.keyId,
      description: 'Premium tier API key ID',
      exportName: `${this.envConfig.resourcePrefix}-PremiumApiKeyId`,
    });
  }
}
