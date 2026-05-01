# Deployment Guide

This guide provides step-by-step instructions for deploying the AI Diet & Meal Recommendation System to AWS.

## Multi-Environment Support

This project supports deployment to three environments: **dev**, **staging**, and **prod**. Each environment has its own configuration with environment-specific settings.

**📖 For detailed information about multi-environment deployment, see [ENVIRONMENT_DEPLOYMENT.md](./ENVIRONMENT_DEPLOYMENT.md)**

Quick deployment commands:
```bash
# Development
cdk deploy --context stage=dev

# Staging
cdk deploy --context stage=staging

# Production
cdk deploy --context stage=prod
```

## Prerequisites

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Installed and configured with credentials
3. **Node.js**: Version 18.x or later
4. **AWS CDK**: Installed globally (`npm install -g aws-cdk`)
5. **Git**: For version control

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure AWS Credentials

```bash
aws configure
```

Enter your AWS Access Key ID, Secret Access Key, and default region.

### 3. Bootstrap CDK (First Time Only)

Bootstrap CDK in your AWS account and region:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace `ACCOUNT-ID` with your AWS account ID and `REGION` with your target region (e.g., us-east-1).

## Deployment Stages

### Development Environment

Deploy to development environment:

```bash
# Set environment variables
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1

# Deploy
cdk deploy -c stage=dev
```

### Staging Environment

Deploy to staging environment:

```bash
cdk deploy -c stage=staging
```

### Production Environment

Deploy to production environment:

```bash
cdk deploy -c stage=prod
```

## Deployment Steps

### 1. Build the Project

```bash
npm run build
```

### 2. Run Tests

```bash
npm test
```

### 3. Synthesize CloudFormation Template

```bash
npm run cdk:synth
```

This generates the CloudFormation template in the `cdk.out` directory.

### 4. Review Changes

```bash
npm run cdk:diff
```

This shows what changes will be made to your AWS infrastructure.

### 5. Deploy

```bash
npm run cdk:deploy
```

Or for a specific stage:

```bash
cdk deploy -c stage=prod
```

### 6. Verify Deployment

After deployment, CDK will output important values:

- User Pool ID
- User Pool Client ID
- API Gateway Endpoint
- S3 Bucket Names
- DynamoDB Table Names

Save these values for your frontend configuration.

## Post-Deployment Configuration

### 1. Configure SES for Email Notifications

Verify email addresses in Amazon SES:

```bash
aws ses verify-email-identity --email-address noreply@example.com
```

### 2. Enable Bedrock Model Access

1. Go to AWS Console → Amazon Bedrock
2. Navigate to Model Access
3. Request access to Claude 3 Sonnet model
4. Wait for approval (usually instant for most regions)

### 3. Configure SNS Topics

Create SNS topics for notifications:

```bash
aws sns create-topic --name ai-diet-notifications
```

### 4. Set Up CloudWatch Alarms

Configure alarms for:
- Lambda errors
- API Gateway 5xx errors
- DynamoDB throttling
- Cost thresholds

### 5. Configure CORS for API Gateway

If needed, update CORS settings in the CDK stack or via AWS Console.

## Environment Variables

After deployment, update your frontend application with the following values:

```javascript
// Frontend configuration
export const config = {
  region: 'us-east-1',
  userPoolId: 'OUTPUT_FROM_CDK',
  userPoolClientId: 'OUTPUT_FROM_CDK',
  apiEndpoint: 'OUTPUT_FROM_CDK',
};
```

## Monitoring and Logging

### View Lambda Logs

```bash
aws logs tail /aws/lambda/FUNCTION_NAME --follow
```

### View API Gateway Logs

```bash
aws logs tail /aws/apigateway/ai-diet-api --follow
```

### CloudWatch Dashboard

Create a CloudWatch dashboard to monitor:
- API request count
- Lambda invocations
- Error rates
- DynamoDB read/write capacity
- S3 storage usage

## Rollback

If deployment fails or issues arise:

```bash
cdk destroy -c stage=STAGE_NAME
```

Then redeploy the previous version.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: cdk deploy --require-approval never -c stage=prod
```

## Cost Optimization

### Monitor Costs

1. Enable AWS Cost Explorer
2. Set up billing alerts
3. Review AWS Cost and Usage Reports

### Optimize Resources

- Use DynamoDB on-demand billing for variable workloads
- Implement S3 lifecycle policies (already configured)
- Set Lambda memory and timeout appropriately
- Use CloudWatch Logs retention policies

## Security Checklist

- [ ] Enable MFA for AWS root account
- [ ] Use IAM roles with least-privilege access
- [ ] Enable CloudTrail for audit logging
- [ ] Enable AWS Config for compliance monitoring
- [ ] Rotate KMS keys regularly
- [ ] Review security groups and NACLs
- [ ] Enable AWS GuardDuty for threat detection
- [ ] Configure AWS WAF for API Gateway (if needed)

## Troubleshooting

### Common Issues

**Issue**: CDK bootstrap fails
**Solution**: Ensure you have AdministratorAccess or equivalent permissions

**Issue**: Lambda function timeout
**Solution**: Increase timeout in CDK stack definition

**Issue**: DynamoDB throttling
**Solution**: Switch to on-demand billing or increase provisioned capacity

**Issue**: Bedrock access denied
**Solution**: Request model access in Bedrock console

**Issue**: S3 access denied
**Solution**: Check bucket policies and IAM permissions

### Getting Help

- Check CloudWatch Logs for detailed error messages
- Review AWS CloudTrail for API call history
- Consult AWS Support or AWS Forums

## Cleanup

To remove all resources:

```bash
cdk destroy -c stage=STAGE_NAME
```

**Warning**: This will delete all data. Ensure you have backups before destroying production resources.

## Next Steps

1. Configure frontend application with CDK outputs
2. Set up monitoring and alerting
3. Configure backup and disaster recovery
4. Implement CI/CD pipeline
5. Conduct security audit
6. Perform load testing
7. Document operational procedures
