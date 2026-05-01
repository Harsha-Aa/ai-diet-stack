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
  }
}
