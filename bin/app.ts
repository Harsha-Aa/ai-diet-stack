#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { getCurrentEnvironment, getEnvironmentConfig, getStackName } from '../config';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';

const app = new cdk.App();

// Get current environment (dev, staging, or prod)
const environmentName = getCurrentEnvironment(app);
console.log(`Deploying to environment: ${environmentName}`);

// Load environment-specific configuration
const envConfig = getEnvironmentConfig(environmentName);
console.log(`Loaded configuration for: ${envConfig.environmentName}`);

// Get AWS account and region from environment or CDK defaults
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack naming helper
const getEnvStackName = (baseName: string) => getStackName(envConfig, baseName);

// 1. AuthStack - Independent (Cognito User Pool, User Pool Client)
const authStack = new AuthStack(app, `AuthStack-${environmentName}`, {
  env,
  stackName: getEnvStackName('auth'),
  description: `Authentication stack - ${envConfig.environmentName} environment`,
  tags: envConfig.tags,
  environmentConfig: envConfig,
});

// 2. StorageStack - Independent (S3 buckets, KMS keys)
const storageStack = new StorageStack(app, `StorageStack-${environmentName}`, {
  env,
  stackName: getEnvStackName('storage'),
  description: `Storage stack - ${envConfig.environmentName} environment`,
  tags: envConfig.tags,
  environmentConfig: envConfig,
});

// 3. SecretsStack - Depends on StorageStack (uses KMS key)
const secretsStack = new SecretsStack(app, `SecretsStack-${environmentName}`, {
  env,
  stackName: getEnvStackName('secrets'),
  description: `Secrets and configuration stack - ${envConfig.environmentName} environment`,
  tags: envConfig.tags,
  environmentConfig: envConfig,
  encryptionKey: storageStack.encryptionKey,
});
secretsStack.addDependency(storageStack);

// 4. DataStack - Depends on StorageStack (uses KMS key)
const dataStack = new DataStack(app, `DataStack-${environmentName}`, {
  env,
  stackName: getEnvStackName('data'),
  description: `Data stack - ${envConfig.environmentName} environment`,
  tags: envConfig.tags,
  environmentConfig: envConfig,
  encryptionKey: storageStack.encryptionKey,
});
dataStack.addDependency(storageStack);

// 5. ApiStack - Depends on AuthStack (uses User Pool for authorization)
const apiStack = new ApiStack(app, `ApiStack-${environmentName}`, {
  env,
  stackName: getEnvStackName('api'),
  description: `API Gateway stack - ${envConfig.environmentName} environment`,
  tags: envConfig.tags,
  environmentConfig: envConfig,
  userPool: authStack.userPool,
});
apiStack.addDependency(authStack);

// 6. ComputeStack - Depends on AuthStack, DataStack, StorageStack, SecretsStack, ApiStack
const computeStack = new ComputeStack(app, `ComputeStack-${environmentName}`, {
  env,
  stackName: getEnvStackName('compute'),
  description: `Compute stack - ${envConfig.environmentName} environment`,
  tags: envConfig.tags,
  environmentConfig: envConfig,
  userPool: authStack.userPool,
  userProfilesTable: dataStack.userProfilesTable,
  glucoseReadingsTable: dataStack.glucoseReadingsTable,
  foodLogsTable: dataStack.foodLogsTable,
  usageTrackingTable: dataStack.usageTrackingTable,
  activityLogsTable: dataStack.activityLogsTable,
  aiInsightsTable: dataStack.aiInsightsTable,
  providerAccessTable: dataStack.providerAccessTable,
  auditLogsTable: dataStack.auditLogsTable,
  foodImagesBucket: storageStack.foodImagesBucket,
  reportsBucket: storageStack.reportsBucket,
  api: apiStack.api,
  authorizer: apiStack.authorizer,
  // Secrets and parameters
  databaseCredentials: secretsStack.databaseCredentials,
  jwtSecret: secretsStack.jwtSecret,
  encryptionKey: secretsStack.encryptionKey,
  stripeApiKey: secretsStack.stripeApiKey,
  dexcomApiCredentials: secretsStack.dexcomApiCredentials,
  libreApiCredentials: secretsStack.libreApiCredentials,
  bedrockModelIdParameter: secretsStack.bedrockModelId,
  bedrockRegionParameter: secretsStack.bedrockRegion,
  sesFromEmailParameter: secretsStack.sesFromEmail,
  freeTierLimitsParameter: secretsStack.freeTierLimits,
});
computeStack.addDependency(authStack);
computeStack.addDependency(dataStack);
computeStack.addDependency(storageStack);
computeStack.addDependency(secretsStack);
computeStack.addDependency(apiStack);

// Add termination protection for production
if (environmentName === 'prod') {
  cdk.Tags.of(app).add('TerminationProtection', 'true');
}

app.synth();
