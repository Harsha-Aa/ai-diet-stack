/**
 * Environment Configuration Types
 * Defines the structure for environment-specific settings
 */

import { Duration } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';

export type EnvironmentName = 'dev' | 'staging' | 'prod';

export interface EnvironmentConfig {
  // Environment identification
  environmentName: EnvironmentName;
  
  // Resource naming
  resourcePrefix: string;
  resourceSuffix: string;
  
  // Tags
  tags: Record<string, string>;
  
  // Logging configuration
  logRetention: logs.RetentionDays;
  enableDetailedLogging: boolean;
  
  // Backup and retention policies
  enablePointInTimeRecovery: boolean;
  backupRetentionDays: number;
  
  // Cost optimization
  enableCostOptimization: boolean;
  
  // Security settings
  enableEncryption: boolean;
  enableMfa: boolean;
  
  // API Gateway settings
  apiGatewayThrottling: {
    rateLimit: number;
    burstLimit: number;
  };
  
  // Lambda settings
  lambdaMemorySize: number;
  lambdaTimeout: Duration;
  
  // DynamoDB settings
  dynamoDbBillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  
  // S3 lifecycle policies
  s3TransitionToIADays: number;
  s3ExpirationDays: number;
  
  // Monitoring and alerting
  enableXRayTracing: boolean;
  enableDetailedMetrics: boolean;
  
  // HIPAA compliance level
  hipaaCompliant: boolean;
  
  // Session settings
  sessionTimeoutMinutes: number;
  
  // Removal policy
  removalPolicy: 'DESTROY' | 'RETAIN' | 'SNAPSHOT';
}
