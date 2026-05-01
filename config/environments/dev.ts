/**
 * Development Environment Configuration
 * 
 * Characteristics:
 * - Shorter log retention for cost savings
 * - Relaxed policies for faster development
 * - Cost-optimized settings
 * - Resources can be destroyed
 */

import { Duration } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { EnvironmentConfig } from '../environment';

export const devConfig: EnvironmentConfig = {
  // Environment identification
  environmentName: 'dev',
  
  // Resource naming
  resourcePrefix: 'dev',
  resourceSuffix: 'dev',
  
  // Tags
  tags: {
    Environment: 'Development',
    Project: 'AiDietMealRecommendation',
    ManagedBy: 'CDK',
    CostCenter: 'Development',
    Owner: 'DevTeam',
  },
  
  // Logging configuration - shorter retention for cost savings
  logRetention: logs.RetentionDays.ONE_WEEK,
  enableDetailedLogging: true, // Detailed logs for debugging
  
  // Backup and retention policies - minimal for dev
  enablePointInTimeRecovery: false, // Disabled for cost savings
  backupRetentionDays: 7,
  
  // Cost optimization - enabled
  enableCostOptimization: true,
  
  // Security settings - relaxed for development
  enableEncryption: true, // Still encrypt, but can use AWS managed keys
  enableMfa: false, // Optional MFA for dev
  
  // API Gateway settings - relaxed limits
  apiGatewayThrottling: {
    rateLimit: 50, // 50 requests per second
    burstLimit: 100, // 100 burst requests
  },
  
  // Lambda settings - smaller memory for cost savings
  lambdaMemorySize: 512, // 512 MB
  lambdaTimeout: Duration.seconds(30),
  
  // DynamoDB settings - on-demand for unpredictable dev workloads
  dynamoDbBillingMode: 'PAY_PER_REQUEST',
  
  // S3 lifecycle policies - aggressive cleanup
  s3TransitionToIADays: 7, // Move to IA after 7 days
  s3ExpirationDays: 30, // Delete after 30 days
  
  // Monitoring and alerting - enabled for testing
  enableXRayTracing: true,
  enableDetailedMetrics: true,
  
  // HIPAA compliance - not required for dev
  hipaaCompliant: false,
  
  // Session settings
  sessionTimeoutMinutes: 60,
  
  // Removal policy - can destroy resources
  removalPolicy: 'DESTROY',
};
