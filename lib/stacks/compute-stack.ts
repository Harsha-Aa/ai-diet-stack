import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import { EnvironmentConfig } from '../../config/environment';
import { getResourceName } from '../../config';

export interface ComputeStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  userPool: cognito.IUserPool;
  userProfilesTable: dynamodb.ITable;
  glucoseReadingsTable: dynamodb.ITable;
  foodLogsTable: dynamodb.ITable;
  usageTrackingTable: dynamodb.ITable;
  activityLogsTable: dynamodb.ITable;
  aiInsightsTable: dynamodb.ITable;
  providerAccessTable: dynamodb.ITable;
  auditLogsTable: dynamodb.ITable;
  predictionsTable: dynamodb.ITable;
  foodImagesBucket: s3.IBucket;
  reportsBucket: s3.IBucket;
  api: apigateway.IRestApi;
  authorizer: apigateway.IAuthorizer;
  // Secrets and parameters
  databaseCredentials?: secretsmanager.ISecret;
  jwtSecret?: secretsmanager.ISecret;
  encryptionKey?: secretsmanager.ISecret;
  stripeApiKey?: secretsmanager.ISecret;
  dexcomApiCredentials?: secretsmanager.ISecret;
  libreApiCredentials?: secretsmanager.ISecret;
  bedrockModelIdParameter?: ssm.IStringParameter;
  bedrockRegionParameter?: ssm.IStringParameter;
  sesFromEmailParameter?: ssm.IStringParameter;
  freeTierLimitsParameter?: ssm.IStringParameter;
}

export class ComputeStack extends cdk.Stack {
  public readonly lambdaRole: iam.Role;
  public readonly dashboardLambda: lambda.Function;
  public readonly analyzeTextLambda: lambda.Function;
  public readonly updateFoodLogLambda: lambda.Function;
  public readonly predictGlucoseLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const envConfig = props.environmentConfig;

    // Lambda Execution Role with necessary permissions
    this.lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant permissions to Lambda role for DynamoDB tables
    props.userProfilesTable.grantReadWriteData(this.lambdaRole);
    props.glucoseReadingsTable.grantReadWriteData(this.lambdaRole);
    props.foodLogsTable.grantReadWriteData(this.lambdaRole);
    props.usageTrackingTable.grantReadWriteData(this.lambdaRole);
    props.activityLogsTable.grantReadWriteData(this.lambdaRole);
    props.aiInsightsTable.grantReadWriteData(this.lambdaRole);
    props.providerAccessTable.grantReadWriteData(this.lambdaRole);
    props.auditLogsTable.grantReadWriteData(this.lambdaRole);
    props.predictionsTable.grantReadWriteData(this.lambdaRole);

    // Grant permissions for S3 buckets
    props.foodImagesBucket.grantReadWrite(this.lambdaRole);
    props.reportsBucket.grantReadWrite(this.lambdaRole);

    // Grant Bedrock permissions
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: ['*'],
      })
    );

    // Grant Rekognition permissions
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rekognition:DetectLabels', 'rekognition:DetectText'],
        resources: ['*'],
      })
    );

    // Grant Transcribe permissions
    this.lambdaRole.addToPolicy(
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
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish', 'ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // Grant Secrets Manager permissions
    if (props.databaseCredentials) {
      props.databaseCredentials.grantRead(this.lambdaRole);
    }
    if (props.jwtSecret) {
      props.jwtSecret.grantRead(this.lambdaRole);
    }
    if (props.encryptionKey) {
      props.encryptionKey.grantRead(this.lambdaRole);
    }
    if (props.stripeApiKey) {
      props.stripeApiKey.grantRead(this.lambdaRole);
    }
    if (props.dexcomApiCredentials) {
      props.dexcomApiCredentials.grantRead(this.lambdaRole);
    }
    if (props.libreApiCredentials) {
      props.libreApiCredentials.grantRead(this.lambdaRole);
    }

    // Grant Parameter Store permissions
    const parameterPrefix = `/${envConfig.environmentName}/ai-diet/*`;
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/${envConfig.environmentName}/ai-diet/*`,
        ],
      })
    );

    // ========================================
    // Analytics Lambda Functions
    // ========================================

    // GET /analytics/dashboard Lambda Function
    this.dashboardLambda = new lambda.Function(this, 'DashboardLambda', {
      functionName: getResourceName(envConfig, 'dashboard'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dashboard.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist/src/analytics')),
      role: this.lambdaRole,
      environment: {
        USERS_TABLE: props.userProfilesTable.tableName,
        GLUCOSE_READINGS_TABLE: props.glucoseReadingsTable.tableName,
        NODE_ENV: envConfig.environmentName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024, // Analytics requires more memory for data processing
      description: 'GET /analytics/dashboard - Calculate dashboard metrics (eA1C, TIR, trends)',
      logRetention: envConfig.logRetention,
    });

    // Integrate dashboard Lambda with API Gateway
    const analyticsResource = props.api.root.getResource('analytics');
    if (analyticsResource) {
      const dashboardResource = analyticsResource.getResource('dashboard');
      if (dashboardResource) {
        dashboardResource.addMethod(
          'GET',
          new apigateway.LambdaIntegration(this.dashboardLambda, {
            proxy: true,
            integrationResponses: [
              {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Origin': "'*'",
                },
              },
            ],
          }),
          {
            authorizer: props.authorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
            methodResponses: [
              {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Origin': true,
                },
              },
            ],
          }
        );
      }
    }

    // ========================================
    // Food Lambda Functions
    // ========================================

    // POST /food/analyze-text Lambda Function
    this.analyzeTextLambda = new lambda.Function(this, 'AnalyzeTextLambda', {
      functionName: getResourceName(envConfig, 'analyze-text'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'analyzeText.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist/src/food')),
      role: this.lambdaRole,
      environment: {
        FOOD_LOGS_TABLE: props.foodLogsTable.tableName,
        NODE_ENV: envConfig.environmentName,
        AWS_REGION: this.region,
      },
      timeout: cdk.Duration.seconds(10), // AI service timeout (Requirement 9.3)
      memorySize: 512, // Sufficient for Bedrock API calls
      description: 'POST /food/analyze-text - AI-based food nutrient analysis from text (Requirements 9, 16)',
      logRetention: envConfig.logRetention,
    });

    // Integrate analyzeText Lambda with API Gateway
    const foodResource = props.api.root.getResource('food');
    if (foodResource) {
      const analyzeTextResource = foodResource.addResource('analyze-text');
      analyzeTextResource.addMethod(
        'POST',
        new apigateway.LambdaIntegration(this.analyzeTextLambda, {
          proxy: true,
          integrationResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': "'*'",
              },
            },
          ],
        }),
        {
          authorizer: props.authorizer,
          authorizationType: apigateway.AuthorizationType.CUSTOM,
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        }
      );

      // Add CORS support for OPTIONS method
      analyzeTextResource.addMethod(
        'OPTIONS',
        new apigateway.MockIntegration({
          integrationResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Headers':
                  "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                'method.response.header.Access-Control-Allow-Origin': "'*'",
              },
            },
          ],
          passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
          requestTemplates: {
            'application/json': '{"statusCode": 200}',
          },
        }),
        {
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        }
      );
    }

    // PUT /food/logs/:logId Lambda Function
    this.updateFoodLogLambda = new lambda.Function(this, 'UpdateFoodLogLambda', {
      functionName: getResourceName(envConfig, 'update-food-log'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'updateFoodLog.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist/src/food')),
      role: this.lambdaRole,
      environment: {
        FOOD_LOGS_TABLE: props.foodLogsTable.tableName,
        NODE_ENV: envConfig.environmentName,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      description: 'PUT /food/logs/:logId - Update food log portion sizes and recalculate nutrients (Requirement 9.4)',
      logRetention: envConfig.logRetention,
    });

    // Integrate updateFoodLog Lambda with API Gateway
    if (foodResource) {
      const logsResource = foodResource.addResource('logs');
      const logIdResource = logsResource.addResource('{logId}');
      
      logIdResource.addMethod(
        'PUT',
        new apigateway.LambdaIntegration(this.updateFoodLogLambda, {
          proxy: true,
          integrationResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': "'*'",
              },
            },
          ],
        }),
        {
          authorizer: props.authorizer,
          authorizationType: apigateway.AuthorizationType.CUSTOM,
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        }
      );

      // Add CORS support for OPTIONS method
      logIdResource.addMethod(
        'OPTIONS',
        new apigateway.MockIntegration({
          integrationResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Headers':
                  "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                'method.response.header.Access-Control-Allow-Methods': "'PUT,OPTIONS'",
                'method.response.header.Access-Control-Allow-Origin': "'*'",
              },
            },
          ],
          passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
          requestTemplates: {
            'application/json': '{"statusCode": 200}',
          },
        }),
        {
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        }
      );
    }

    // ========================================
    // AI Lambda Functions
    // ========================================

    // POST /ai/predict-glucose Lambda Function
    this.predictGlucoseLambda = new lambda.Function(this, 'PredictGlucoseLambda', {
      functionName: getResourceName(envConfig, 'predict-glucose'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'predictGlucose.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist/src/ai')),
      role: this.lambdaRole,
      environment: {
        GLUCOSE_READINGS_TABLE: props.glucoseReadingsTable.tableName,
        FOOD_LOGS_TABLE: props.foodLogsTable.tableName,
        PREDICTIONS_TABLE: props.predictionsTable.tableName,
        USAGE_TRACKING_TABLE: props.usageTrackingTable.tableName,
        NODE_ENV: envConfig.environmentName,
        AWS_REGION: this.region,
      },
      timeout: cdk.Duration.seconds(30), // AI service timeout (Bedrock can take longer)
      memorySize: 1024, // More memory for complex AI predictions
      description: 'POST /ai/predict-glucose - AI-powered glucose predictions using Bedrock (Requirement 5)',
      logRetention: envConfig.logRetention,
    });

    // Integrate predictGlucose Lambda with API Gateway
    const aiResource = props.api.root.getResource('ai');
    if (aiResource) {
      const predictGlucoseResource = aiResource.getResource('predict-glucose');
      if (predictGlucoseResource) {
        predictGlucoseResource.addMethod(
          'POST',
          new apigateway.LambdaIntegration(this.predictGlucoseLambda, {
            proxy: true,
            integrationResponses: [
              {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Origin': "'*'",
                },
              },
            ],
          }),
          {
            authorizer: props.authorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
            methodResponses: [
              {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Origin': true,
                },
              },
            ],
          }
        );

        // Add CORS support for OPTIONS method
        predictGlucoseResource.addMethod(
          'OPTIONS',
          new apigateway.MockIntegration({
            integrationResponses: [
              {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Headers':
                    "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                  'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                  'method.response.header.Access-Control-Allow-Origin': "'*'",
                },
              },
            ],
            passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
            requestTemplates: {
              'application/json': '{"statusCode": 200}',
            },
          }),
          {
            methodResponses: [
              {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Headers': true,
                  'method.response.header.Access-Control-Allow-Methods': true,
                  'method.response.header.Access-Control-Allow-Origin': true,
                },
              },
            ],
          }
        );
      }
    }

    // TODO: Lambda functions will be added in subsequent tasks
    // This stack serves as a placeholder for compute resources
    // Future tasks will add:
    // - Auth Lambda functions (register, login, profile)
    // - Glucose Lambda functions (createReading, getReadings, cgmSync)
    // - Food Lambda functions (uploadImage, recognize, analyzeText, voiceEntry)
    // - AI Lambda functions (predictGlucose, recommendMeal, analyzePatterns, calculateInsulin)
    // - Analytics Lambda functions (agpReport)
    // - Notification Lambda functions (alerts, reminders, summaries)

    // Stack Outputs
    new cdk.CfnOutput(this, 'LambdaRoleArn', {
      value: this.lambdaRole.roleArn,
      description: 'Lambda execution role ARN',
      exportName: `${envConfig.resourcePrefix}-AiDietLambdaRoleArn`,
    });

    new cdk.CfnOutput(this, 'DashboardLambdaArn', {
      value: this.dashboardLambda.functionArn,
      description: 'Dashboard Lambda function ARN',
      exportName: `${envConfig.resourcePrefix}-DashboardLambdaArn`,
    });

    new cdk.CfnOutput(this, 'AnalyzeTextLambdaArn', {
      value: this.analyzeTextLambda.functionArn,
      description: 'Analyze Text Lambda function ARN',
      exportName: `${envConfig.resourcePrefix}-AnalyzeTextLambdaArn`,
    });

    new cdk.CfnOutput(this, 'UpdateFoodLogLambdaArn', {
      value: this.updateFoodLogLambda.functionArn,
      description: 'Update Food Log Lambda function ARN',
      exportName: `${envConfig.resourcePrefix}-UpdateFoodLogLambdaArn`,
    });

    new cdk.CfnOutput(this, 'PredictGlucoseLambdaArn', {
      value: this.predictGlucoseLambda.functionArn,
      description: 'Predict Glucose Lambda function ARN',
      exportName: `${envConfig.resourcePrefix}-PredictGlucoseLambdaArn`,
    });
  }
}
