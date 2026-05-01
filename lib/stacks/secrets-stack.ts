import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as kms from 'aws-cdk-lib/aws-kms';
import { EnvironmentConfig } from '../../config/environment';
import { getResourceName } from '../../config';

export interface SecretsStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  encryptionKey: kms.IKey;
}

/**
 * SecretsStack - Manages secrets and configuration parameters
 * 
 * This stack creates:
 * - AWS Secrets Manager secrets for sensitive data (API keys, credentials)
 * - AWS Systems Manager Parameter Store parameters for non-sensitive config
 * - Automatic secret rotation configuration
 * - KMS encryption for all secrets
 * 
 * Naming Convention:
 * - Secrets: /{environment}/ai-diet/{secret-name}
 * - Parameters: /{environment}/ai-diet/{parameter-name}
 */
export class SecretsStack extends cdk.Stack {
  // Secrets Manager secrets
  public readonly databaseCredentials: secretsmanager.ISecret;
  public readonly bedrockApiKey: secretsmanager.ISecret;
  public readonly jwtSecret: secretsmanager.ISecret;
  public readonly encryptionKey: secretsmanager.ISecret;
  public readonly stripeApiKey: secretsmanager.ISecret;
  public readonly dexcomApiCredentials: secretsmanager.ISecret;
  public readonly libreApiCredentials: secretsmanager.ISecret;

  // Parameter Store parameters
  public readonly bedrockModelId: ssm.IStringParameter;
  public readonly bedrockRegion: ssm.IStringParameter;
  public readonly sesFromEmail: ssm.IStringParameter;
  public readonly apiRateLimit: ssm.IStringParameter;
  public readonly sessionTimeoutMinutes: ssm.IStringParameter;
  public readonly freeTierLimits: ssm.IStringParameter;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    const envConfig = props.environmentConfig;
    const secretPrefix = `/${envConfig.environmentName}/ai-diet`;

    // ============================================================
    // SECRETS MANAGER - Sensitive Data
    // ============================================================

    // Database credentials (for future RDS if needed)
    this.databaseCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: `${secretPrefix}/database-credentials`,
      description: `Database credentials for ${envConfig.environmentName} environment`,
      encryptionKey: props.encryptionKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'admin',
          engine: 'postgres',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // JWT signing secret for custom tokens
    this.jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `${secretPrefix}/jwt-secret`,
      description: `JWT signing secret for ${envConfig.environmentName} environment`,
      encryptionKey: props.encryptionKey,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Data encryption key for application-level encryption
    this.encryptionKey = new secretsmanager.Secret(this, 'EncryptionKey', {
      secretName: `${secretPrefix}/encryption-key`,
      description: `Application encryption key for ${envConfig.environmentName} environment`,
      encryptionKey: props.encryptionKey,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Bedrock API key (placeholder - Bedrock uses IAM, but keeping for future use)
    this.bedrockApiKey = new secretsmanager.Secret(this, 'BedrockApiKey', {
      secretName: `${secretPrefix}/bedrock-api-key`,
      description: `Bedrock API key for ${envConfig.environmentName} environment`,
      encryptionKey: props.encryptionKey,
      secretStringValue: cdk.SecretValue.unsafePlainText('PLACEHOLDER_USE_IAM'),
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Stripe API key for payment processing
    this.stripeApiKey = new secretsmanager.Secret(this, 'StripeApiKey', {
      secretName: `${secretPrefix}/stripe-api-key`,
      description: `Stripe API key for ${envConfig.environmentName} environment`,
      encryptionKey: props.encryptionKey,
      secretStringValue: cdk.SecretValue.unsafePlainText('PLACEHOLDER_UPDATE_MANUALLY'),
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Dexcom CGM API credentials
    this.dexcomApiCredentials = new secretsmanager.Secret(this, 'DexcomApiCredentials', {
      secretName: `${secretPrefix}/dexcom-api-credentials`,
      description: `Dexcom CGM API credentials for ${envConfig.environmentName} environment`,
      encryptionKey: props.encryptionKey,
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        clientId: 'PLACEHOLDER_UPDATE_MANUALLY',
        clientSecret: 'PLACEHOLDER_UPDATE_MANUALLY',
        redirectUri: 'PLACEHOLDER_UPDATE_MANUALLY',
      })),
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Libre CGM API credentials
    this.libreApiCredentials = new secretsmanager.Secret(this, 'LibreApiCredentials', {
      secretName: `${secretPrefix}/libre-api-credentials`,
      description: `Libre CGM API credentials for ${envConfig.environmentName} environment`,
      encryptionKey: props.encryptionKey,
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        clientId: 'PLACEHOLDER_UPDATE_MANUALLY',
        clientSecret: 'PLACEHOLDER_UPDATE_MANUALLY',
        redirectUri: 'PLACEHOLDER_UPDATE_MANUALLY',
      })),
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // ============================================================
    // PARAMETER STORE - Non-Sensitive Configuration
    // ============================================================

    // Bedrock model ID
    this.bedrockModelId = new ssm.StringParameter(this, 'BedrockModelId', {
      parameterName: `${secretPrefix}/bedrock-model-id`,
      description: `Bedrock model ID for ${envConfig.environmentName} environment`,
      stringValue: 'anthropic.claude-3-sonnet-20240229-v1:0',
      tier: ssm.ParameterTier.STANDARD,
    });

    // Bedrock region
    this.bedrockRegion = new ssm.StringParameter(this, 'BedrockRegion', {
      parameterName: `${secretPrefix}/bedrock-region`,
      description: `Bedrock region for ${envConfig.environmentName} environment`,
      stringValue: process.env.CDK_DEFAULT_REGION || 'us-east-1',
      tier: ssm.ParameterTier.STANDARD,
    });

    // SES from email
    this.sesFromEmail = new ssm.StringParameter(this, 'SesFromEmail', {
      parameterName: `${secretPrefix}/ses-from-email`,
      description: `SES from email for ${envConfig.environmentName} environment`,
      stringValue: envConfig.environmentName === 'prod' 
        ? 'noreply@aidiet.app' 
        : `noreply-${envConfig.environmentName}@aidiet.app`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // API rate limit
    this.apiRateLimit = new ssm.StringParameter(this, 'ApiRateLimit', {
      parameterName: `${secretPrefix}/api-rate-limit`,
      description: `API rate limit for ${envConfig.environmentName} environment`,
      stringValue: envConfig.apiGatewayThrottling.rateLimit.toString(),
      tier: ssm.ParameterTier.STANDARD,
    });

    // Session timeout
    this.sessionTimeoutMinutes = new ssm.StringParameter(this, 'SessionTimeoutMinutes', {
      parameterName: `${secretPrefix}/session-timeout-minutes`,
      description: `Session timeout in minutes for ${envConfig.environmentName} environment`,
      stringValue: envConfig.sessionTimeoutMinutes.toString(),
      tier: ssm.ParameterTier.STANDARD,
    });

    // Free tier usage limits (JSON)
    this.freeTierLimits = new ssm.StringParameter(this, 'FreeTierLimits', {
      parameterName: `${secretPrefix}/free-tier-limits`,
      description: `Free tier usage limits for ${envConfig.environmentName} environment`,
      stringValue: JSON.stringify({
        food_recognition: 25,
        glucose_prediction: 20,
        meal_recommendation: 15,
        voice_entry: 20,
        text_nutrient_analysis: 25,
        insulin_dose: 20,
        pattern_insight: 1,
      }),
      tier: ssm.ParameterTier.STANDARD,
    });

    // ============================================================
    // STACK OUTPUTS
    // ============================================================

    // Secrets Manager ARNs
    new cdk.CfnOutput(this, 'DatabaseCredentialsArn', {
      value: this.databaseCredentials.secretArn,
      description: 'Database credentials secret ARN',
      exportName: `${envConfig.resourcePrefix}-DatabaseCredentialsArn`,
    });

    new cdk.CfnOutput(this, 'JwtSecretArn', {
      value: this.jwtSecret.secretArn,
      description: 'JWT secret ARN',
      exportName: `${envConfig.resourcePrefix}-JwtSecretArn`,
    });

    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.secretArn,
      description: 'Encryption key secret ARN',
      exportName: `${envConfig.resourcePrefix}-EncryptionKeyArn`,
    });

    new cdk.CfnOutput(this, 'StripeApiKeyArn', {
      value: this.stripeApiKey.secretArn,
      description: 'Stripe API key secret ARN',
      exportName: `${envConfig.resourcePrefix}-StripeApiKeyArn`,
    });

    new cdk.CfnOutput(this, 'DexcomApiCredentialsArn', {
      value: this.dexcomApiCredentials.secretArn,
      description: 'Dexcom API credentials secret ARN',
      exportName: `${envConfig.resourcePrefix}-DexcomApiCredentialsArn`,
    });

    new cdk.CfnOutput(this, 'LibreApiCredentialsArn', {
      value: this.libreApiCredentials.secretArn,
      description: 'Libre API credentials secret ARN',
      exportName: `${envConfig.resourcePrefix}-LibreApiCredentialsArn`,
    });

    // Parameter Store names
    new cdk.CfnOutput(this, 'BedrockModelIdParameter', {
      value: this.bedrockModelId.parameterName,
      description: 'Bedrock model ID parameter name',
      exportName: `${envConfig.resourcePrefix}-BedrockModelIdParameter`,
    });

    new cdk.CfnOutput(this, 'BedrockRegionParameter', {
      value: this.bedrockRegion.parameterName,
      description: 'Bedrock region parameter name',
      exportName: `${envConfig.resourcePrefix}-BedrockRegionParameter`,
    });

    new cdk.CfnOutput(this, 'SesFromEmailParameter', {
      value: this.sesFromEmail.parameterName,
      description: 'SES from email parameter name',
      exportName: `${envConfig.resourcePrefix}-SesFromEmailParameter`,
    });

    new cdk.CfnOutput(this, 'FreeTierLimitsParameter', {
      value: this.freeTierLimits.parameterName,
      description: 'Free tier limits parameter name',
      exportName: `${envConfig.resourcePrefix}-FreeTierLimitsParameter`,
    });
  }
}
