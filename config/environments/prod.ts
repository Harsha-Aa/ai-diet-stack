/**
 * Production Environment Configuration
 * 
 * Characteristics:
 * - Full HIPAA compliance
 * - Extended retention (7 years for HIPAA)
 * - High availability
 * - Maximum security
 * - Comprehensive monitoring
 */

import { Duration } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { EnvironmentConfig } from '../environment';

export const prodConfig: EnvironmentConfig = {
  // Environment identification
  environmentName: 'prod',
  
  // Resource naming
  resourcePrefix: 'prod',
  resourceSuffix: 'prod',
  
  // Tags
  tags: {
    Environment: 'Production',
    Project: 'AiDietMealRecommendation',
    ManagedBy: 'CDK',
    CostCenter: 'Production',
    Owner: 'OpsTeam',
    Compliance: 'HIPAA',
    DataClassification: 'PHI',
    BackupRequired: 'true',
  },
  
  // Logging configuration - extended retention for compliance
  logRetention: logs.RetentionDays.SIX_MONTHS,
  enableDetailedLogging: false, // Reduce noise in production
  
  // Backup and retention policies - HIPAA compliant
  enablePointInTimeRecovery: true,
  backupRetentionDays: 2555, // 7 years for HIPAA compliance
  
  // Cost optimization - disabled for reliability
  enableCostOptimization: false,
  
  // Security settings - maximum security
  enableEncryption: true,
  enableMfa: true, // Required for production
  
  // API Gateway settings - production limits per requirements
  apiGatewayThrottling: {
    rateLimit: 100, // 100 requests per second per user (Requirement 13.6)
    burstLimit: 200, // 200 burst requests
  },
  
  // Lambda settings - optimized for performance
  lambdaMemorySize: 1536, // 1.5 GB for better performance
  lambdaTimeout: Duration.seconds(60),
  
  // DynamoDB settings - on-demand for auto-scaling
  dynamoDbBillingMode: 'PAY_PER_REQUEST',
  
  // S3 lifecycle policies - HIPAA compliant retention
  s3TransitionToIADays: 90, // Move to IA after 90 days
  s3ExpirationDays: 2555, // 7 years retention for HIPAA
  
  // Monitoring and alerting - comprehensive monitoring
  enableXRayTracing: true,
  enableDetailedMetrics: true,
  
  // HIPAA compliance - full compliance required
  hipaaCompliant: true,
  
  // Session settings - per Requirement 13.5
  sessionTimeoutMinutes: 60,
  
  // Removal policy - always retain production data
  removalPolicy: 'RETAIN',
};
