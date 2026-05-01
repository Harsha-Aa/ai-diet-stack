/**
 * Staging Environment Configuration
 * 
 * Characteristics:
 * - Production-like settings for testing
 * - Full HIPAA compliance testing
 * - Extended retention for validation
 * - High availability testing
 */

import { Duration } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { EnvironmentConfig } from '../environment';

export const stagingConfig: EnvironmentConfig = {
  // Environment identification
  environmentName: 'staging',
  
  // Resource naming
  resourcePrefix: 'staging',
  resourceSuffix: 'staging',
  
  // Tags
  tags: {
    Environment: 'Staging',
    Project: 'AiDietMealRecommendation',
    ManagedBy: 'CDK',
    CostCenter: 'QA',
    Owner: 'QATeam',
    Compliance: 'HIPAA',
  },
  
  // Logging configuration - production-like retention
  logRetention: logs.RetentionDays.ONE_MONTH,
  enableDetailedLogging: true,
  
  // Backup and retention policies - production-like
  enablePointInTimeRecovery: true,
  backupRetentionDays: 30,
  
  // Cost optimization - balanced
  enableCostOptimization: false,
  
  // Security settings - production-like
  enableEncryption: true,
  enableMfa: true, // Test MFA flows
  
  // API Gateway settings - production-like limits
  apiGatewayThrottling: {
    rateLimit: 100, // 100 requests per second
    burstLimit: 200, // 200 burst requests
  },
  
  // Lambda settings - production-like memory
  lambdaMemorySize: 1024, // 1 GB
  lambdaTimeout: Duration.seconds(60),
  
  // DynamoDB settings - on-demand for flexibility
  dynamoDbBillingMode: 'PAY_PER_REQUEST',
  
  // S3 lifecycle policies - production-like
  s3TransitionToIADays: 30,
  s3ExpirationDays: 365, // 1 year retention
  
  // Monitoring and alerting - full monitoring
  enableXRayTracing: true,
  enableDetailedMetrics: true,
  
  // HIPAA compliance - full compliance for testing
  hipaaCompliant: true,
  
  // Session settings
  sessionTimeoutMinutes: 60,
  
  // Removal policy - retain for investigation
  removalPolicy: 'RETAIN',
};
