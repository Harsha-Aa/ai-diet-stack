import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { EnvironmentConfig } from '../../config/environment';
import { getResourceName } from '../../config';

export interface AuthStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const envConfig = props.environmentConfig;

    // Cognito User Pool for authentication
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: getResourceName(envConfig, 'ai-diet-users'),
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 12, // Requirement 13: HIPAA-compliant password policy
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: envConfig.enableMfa ? cognito.Mfa.OPTIONAL : cognito.Mfa.OFF,
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
      customAttributes: {
        // Requirement 1: Store subscription tier for freemium model
        subscription_tier: new cognito.StringAttribute({
          mutable: true,
        }),
        // Requirement 1: Store diabetes type for personalized recommendations
        diabetes_type: new cognito.StringAttribute({
          mutable: true,
        }),
      },
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Cognito User Pool Client
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.minutes(envConfig.sessionTimeoutMinutes),
      idTokenValidity: cdk.Duration.minutes(envConfig.sessionTimeoutMinutes),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${envConfig.resourcePrefix}-AiDietUserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${envConfig.resourcePrefix}-AiDietUserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${envConfig.resourcePrefix}-AiDietUserPoolArn`,
    });
  }
}
