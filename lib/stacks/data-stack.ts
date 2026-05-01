import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { EnvironmentConfig } from '../../config/environment';
import { getResourceName } from '../../config';

export interface DataStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  encryptionKey: kms.IKey;
}

export class DataStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;
  public readonly userProfilesTable: dynamodb.Table;
  public readonly glucoseReadingsTable: dynamodb.Table;
  public readonly foodLogsTable: dynamodb.Table;
  public readonly usageTrackingTable: dynamodb.Table;
  public readonly activityLogsTable: dynamodb.Table;
  public readonly aiInsightsTable: dynamodb.Table;
  public readonly providerAccessTable: dynamodb.Table;
  public readonly auditLogsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const envConfig = props.environmentConfig;
    const encryptionKey = props.encryptionKey;

    // Users Table
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: getResourceName(envConfig, 'ai-diet-users'),
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: envConfig.enablePointInTimeRecovery,
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // User Profiles Table
    this.userProfilesTable = new dynamodb.Table(this, 'UserProfilesTable', {
      tableName: getResourceName(envConfig, 'ai-diet-user-profiles'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: envConfig.enablePointInTimeRecovery,
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Glucose Readings Table
    this.glucoseReadingsTable = new dynamodb.Table(this, 'GlucoseReadingsTable', {
      tableName: getResourceName(envConfig, 'ai-diet-glucose-readings'),
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: envConfig.enablePointInTimeRecovery,
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for date-based queries
    this.glucoseReadingsTable.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Food Logs Table
    this.foodLogsTable = new dynamodb.Table(this, 'FoodLogsTable', {
      tableName: getResourceName(envConfig, 'ai-diet-food-logs'),
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: envConfig.enablePointInTimeRecovery,
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for date-based queries
    this.foodLogsTable.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Usage Tracking Table (for freemium model)
    this.usageTrackingTable = new dynamodb.Table(this, 'UsageTrackingTable', {
      tableName: getResourceName(envConfig, 'ai-diet-usage-tracking'),
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'month', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: false,
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Activity Logs Table
    this.activityLogsTable = new dynamodb.Table(this, 'ActivityLogsTable', {
      tableName: getResourceName(envConfig, 'ai-diet-activity-logs'),
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: envConfig.enablePointInTimeRecovery,
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // AI Insights Table
    this.aiInsightsTable = new dynamodb.Table(this, 'AIInsightsTable', {
      tableName: getResourceName(envConfig, 'ai-diet-ai-insights'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'insightId', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: envConfig.enablePointInTimeRecovery,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for chronological queries
    this.aiInsightsTable.addGlobalSecondaryIndex({
      indexName: 'CreatedAtIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Provider Access Table
    this.providerAccessTable = new dynamodb.Table(this, 'ProviderAccessTable', {
      tableName: getResourceName(envConfig, 'ai-diet-provider-access'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'providerEmail', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: envConfig.enablePointInTimeRecovery,
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for provider-centric queries
    this.providerAccessTable.addGlobalSecondaryIndex({
      indexName: 'ProviderEmailIndex',
      partitionKey: { name: 'providerEmail', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Audit Logs Table
    this.auditLogsTable = new dynamodb.Table(this, 'AuditLogsTable', {
      tableName: getResourceName(envConfig, 'ai-diet-audit-logs'),
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: envConfig.enablePointInTimeRecovery,
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for compliance queries
    this.auditLogsTable.addGlobalSecondaryIndex({
      indexName: 'ActionTypeIndex',
      partitionKey: { name: 'actionType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'DynamoDB table for users',
      exportName: `${envConfig.resourcePrefix}-AiDietUsersTable`,
    });

    new cdk.CfnOutput(this, 'UserProfilesTableName', {
      value: this.userProfilesTable.tableName,
      description: 'DynamoDB table for user profiles',
      exportName: `${envConfig.resourcePrefix}-AiDietUserProfilesTable`,
    });

    new cdk.CfnOutput(this, 'GlucoseReadingsTableName', {
      value: this.glucoseReadingsTable.tableName,
      description: 'DynamoDB table for glucose readings',
      exportName: `${envConfig.resourcePrefix}-AiDietGlucoseReadingsTable`,
    });

    new cdk.CfnOutput(this, 'FoodLogsTableName', {
      value: this.foodLogsTable.tableName,
      description: 'DynamoDB table for food logs',
      exportName: `${envConfig.resourcePrefix}-AiDietFoodLogsTable`,
    });

    new cdk.CfnOutput(this, 'UsageTrackingTableName', {
      value: this.usageTrackingTable.tableName,
      description: 'DynamoDB table for usage tracking',
      exportName: `${envConfig.resourcePrefix}-AiDietUsageTrackingTable`,
    });

    new cdk.CfnOutput(this, 'ActivityLogsTableName', {
      value: this.activityLogsTable.tableName,
      description: 'DynamoDB table for activity logs',
      exportName: `${envConfig.resourcePrefix}-AiDietActivityLogsTable`,
    });

    new cdk.CfnOutput(this, 'AIInsightsTableName', {
      value: this.aiInsightsTable.tableName,
      description: 'DynamoDB table for AI insights',
      exportName: `${envConfig.resourcePrefix}-AiDietAIInsightsTable`,
    });

    new cdk.CfnOutput(this, 'ProviderAccessTableName', {
      value: this.providerAccessTable.tableName,
      description: 'DynamoDB table for provider access',
      exportName: `${envConfig.resourcePrefix}-AiDietProviderAccessTable`,
    });

    new cdk.CfnOutput(this, 'AuditLogsTableName', {
      value: this.auditLogsTable.tableName,
      description: 'DynamoDB table for audit logs',
      exportName: `${envConfig.resourcePrefix}-AiDietAuditLogsTable`,
    });
  }
}
