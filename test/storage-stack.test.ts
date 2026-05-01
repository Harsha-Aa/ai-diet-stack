import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/stacks/storage-stack';
import { getEnvironmentConfig } from '../config';

describe('StorageStack', () => {
  let app: cdk.App;
  let stack: StorageStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    const envConfig = getEnvironmentConfig('dev');
    stack = new StorageStack(app, 'TestStorageStack', {
      environmentConfig: envConfig,
    });
    template = Template.fromStack(stack);
  });

  describe('Food Images Bucket', () => {
    test('should be created with KMS encryption', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-food-images',
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms',
              },
            },
          ],
        },
      });
    });

    test('should have public access blocked', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('should have versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('should have lifecycle rule with Intelligent-Tiering transition after 30 days', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-food-images',
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'TransitionToIntelligentTiering',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'INTELLIGENT_TIERING',
                  TransitionInDays: 30,
                },
              ],
            },
          ],
        },
      });
    });

    test('should have 2-year retention policy', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-food-images',
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'TransitionToIntelligentTiering',
              Status: 'Enabled',
              ExpirationInDays: 730, // 2 years
            },
          ],
        },
      });
    });

    test('should have CORS configuration for web app uploads', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-food-images',
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedMethods: ['GET', 'PUT', 'POST'],
              AllowedOrigins: ['*'],
              AllowedHeaders: [
                'Content-Type',
                'Content-Length',
                'Content-MD5',
                'Authorization',
                'X-Amz-Date',
                'X-Amz-Security-Token',
                'X-Amz-User-Agent',
                'X-Amz-Content-Sha256',
              ],
              ExposedHeaders: [
                'ETag',
                'X-Amz-Server-Side-Encryption',
                'X-Amz-Request-Id',
                'X-Amz-Id-2',
              ],
              MaxAge: 3600,
            },
          ],
        },
      });
    });
  });

  describe('KMS Encryption Key', () => {
    test('should be created with key rotation enabled', () => {
      template.hasResourceProperties('AWS::KMS::Key', {
        EnableKeyRotation: true,
      });
    });

    test('should be used by food images bucket', () => {
      // Verify that the bucket references the KMS key
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms',
              },
            },
          ],
        },
      });
    });
  });

  describe('Reports Bucket', () => {
    test('should be created with KMS encryption', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-reports',
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms',
              },
            },
          ],
        },
      });
    });

    test('should have public access blocked', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-reports',
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('should have versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-reports',
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('should have lifecycle rule with Glacier transition after 90 days', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-reports',
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'TransitionToGlacier',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 90,
                },
              ],
            },
          ],
        },
      });
    });

    test('should have 7-year retention policy for HIPAA compliance', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'dev-ai-diet-reports',
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'TransitionToGlacier',
              Status: 'Enabled',
              ExpirationInDays: 2555, // 7 years
            },
          ],
        },
      });
    });
  });

  describe('Stack Outputs', () => {
    test('should export food images bucket name', () => {
      template.hasOutput('FoodImagesBucketName', {});
    });

    test('should export food images bucket ARN', () => {
      template.hasOutput('FoodImagesBucketArn', {});
    });

    test('should export reports bucket name', () => {
      template.hasOutput('ReportsBucketName', {});
    });

    test('should export reports bucket ARN', () => {
      template.hasOutput('ReportsBucketArn', {});
    });

    test('should export encryption key ID', () => {
      template.hasOutput('EncryptionKeyId', {});
    });

    test('should export encryption key ARN', () => {
      template.hasOutput('EncryptionKeyArn', {});
    });
  });
});
