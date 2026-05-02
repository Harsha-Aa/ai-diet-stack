import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { EnvironmentConfig } from '../../config/environment';
import { getResourceName } from '../../config';

export interface StorageStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
}

export class StorageStack extends cdk.Stack {
  public readonly encryptionKey: kms.Key;
  public readonly foodImagesBucket: s3.Bucket;
  public readonly reportsBucket: s3.Bucket;
  public readonly glucoseUploadsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const envConfig = props.environmentConfig;

    // KMS Key for encryption at rest (HIPAA compliance - Requirement 13.1)
    this.encryptionKey = new kms.Key(this, 'EncryptionKey', {
      enableKeyRotation: true,
      description: `KMS key for encrypting sensitive health data - ${envConfig.environmentName}`,
      alias: getResourceName(envConfig, 'ai-diet-meal-recommendation-key'),
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // S3 Bucket for food images
    this.foodImagesBucket = new s3.Bucket(this, 'FoodImagesBucket', {
      bucketName: getResourceName(envConfig, 'ai-diet-food-images'),
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true, // Versioning enabled for data protection
      lifecycleRules: [
        {
          id: 'TransitionToIntelligentTiering',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          expiration: cdk.Duration.days(730), // Delete after 2 years
        },
      ],
      // CORS configuration for web app uploads (Task 4.4)
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // In production, restrict to specific web app domains (e.g., https://app.example.com)
          allowedHeaders: [
            'Content-Type',
            'Content-Length',
            'Content-MD5',
            'Authorization',
            'X-Amz-Date',
            'X-Amz-Security-Token',
            'X-Amz-User-Agent',
            'X-Amz-Content-Sha256',
          ],
          exposedHeaders: [
            'ETag',
            'X-Amz-Server-Side-Encryption',
            'X-Amz-Request-Id',
            'X-Amz-Id-2',
          ],
          maxAge: 3600, // 1 hour
        },
      ],
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: envConfig.removalPolicy === 'DESTROY',
    });

    // S3 Bucket for reports
    this.reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      bucketName: getResourceName(envConfig, 'ai-diet-reports'),
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true, // Versioning enabled for data protection
      lifecycleRules: [
        {
          id: 'TransitionToGlacier',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          // Retain for 7 years (HIPAA compliance)
          expiration: cdk.Duration.days(2555),
        },
      ],
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: envConfig.removalPolicy === 'DESTROY',
    });

    // S3 Bucket for glucose file uploads (Task 7B.2 - Requirement 2B)
    this.glucoseUploadsBucket = new s3.Bucket(this, 'GlucoseUploadsBucket', {
      bucketName: getResourceName(envConfig, 'ai-diet-glucose-uploads'),
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false, // No versioning needed for temporary uploads
      lifecycleRules: [
        {
          id: 'DeleteOldUploads',
          enabled: true,
          expiration: cdk.Duration.days(30), // 30-day TTL for uploaded files
        },
        {
          id: 'DeleteParsedData',
          enabled: true,
          prefix: '*/*/parsed-data.json', // Matches {user_id}/{parse_id}/parsed-data.json
          expiration: cdk.Duration.days(1), // 24-hour TTL for parsed data (Task 7B.11)
        },
      ],
      // CORS configuration for file uploads
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // In production, restrict to specific web app domains
          allowedHeaders: [
            'Content-Type',
            'Content-Length',
            'Content-MD5',
            'Authorization',
            'X-Amz-Date',
            'X-Amz-Security-Token',
            'X-Amz-User-Agent',
            'X-Amz-Content-Sha256',
          ],
          exposedHeaders: [
            'ETag',
            'X-Amz-Server-Side-Encryption',
            'X-Amz-Request-Id',
            'X-Amz-Id-2',
          ],
          maxAge: 3000, // 50 minutes (longer than pre-signed URL expiration)
        },
      ],
      removalPolicy: envConfig.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: envConfig.removalPolicy === 'DESTROY',
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'EncryptionKeyId', {
      value: this.encryptionKey.keyId,
      description: 'KMS Encryption Key ID',
      exportName: `${envConfig.resourcePrefix}-AiDietEncryptionKeyId`,
    });

    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.keyArn,
      description: 'KMS Encryption Key ARN',
      exportName: `${envConfig.resourcePrefix}-AiDietEncryptionKeyArn`,
    });

    new cdk.CfnOutput(this, 'FoodImagesBucketName', {
      value: this.foodImagesBucket.bucketName,
      description: 'S3 bucket for food images',
      exportName: `${envConfig.resourcePrefix}-AiDietFoodImagesBucket`,
    });

    new cdk.CfnOutput(this, 'FoodImagesBucketArn', {
      value: this.foodImagesBucket.bucketArn,
      description: 'S3 bucket ARN for food images',
      exportName: `${envConfig.resourcePrefix}-AiDietFoodImagesBucketArn`,
    });

    new cdk.CfnOutput(this, 'ReportsBucketName', {
      value: this.reportsBucket.bucketName,
      description: 'S3 bucket for reports',
      exportName: `${envConfig.resourcePrefix}-AiDietReportsBucket`,
    });

    new cdk.CfnOutput(this, 'ReportsBucketArn', {
      value: this.reportsBucket.bucketArn,
      description: 'S3 bucket ARN for reports',
      exportName: `${envConfig.resourcePrefix}-AiDietReportsBucketArn`,
    });

    new cdk.CfnOutput(this, 'GlucoseUploadsBucketName', {
      value: this.glucoseUploadsBucket.bucketName,
      description: 'S3 bucket for glucose file uploads',
      exportName: `${envConfig.resourcePrefix}-AiDietGlucoseUploadsBucket`,
    });

    new cdk.CfnOutput(this, 'GlucoseUploadsBucketArn', {
      value: this.glucoseUploadsBucket.bucketArn,
      description: 'S3 bucket ARN for glucose file uploads',
      exportName: `${envConfig.resourcePrefix}-AiDietGlucoseUploadsBucketArn`,
    });
  }
}
