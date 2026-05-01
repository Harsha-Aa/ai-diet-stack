# CI/CD Pipeline Setup Guide

This document provides detailed instructions for setting up the GitHub Actions CI/CD pipeline for the AI Diet & Meal Recommendation System.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [GitHub Secrets Configuration](#github-secrets-configuration)
4. [Environment Protection Rules](#environment-protection-rules)
5. [Workflow Details](#workflow-details)
6. [Troubleshooting](#troubleshooting)

## Overview

The CI/CD pipeline consists of four GitHub Actions workflows:

- **CI Workflow**: Automated testing and validation on every PR and push
- **Deploy Dev**: Automatic deployment to development environment
- **Deploy Staging**: Automatic deployment to staging with integration tests
- **Deploy Production**: Manual approval deployment to production with comprehensive checks

## Prerequisites

Before setting up the CI/CD pipeline, ensure you have:

1. **AWS Accounts**: Separate AWS accounts for dev, staging, and production (recommended)
2. **IAM Users/Roles**: IAM users with deployment permissions for each environment
3. **GitHub Repository**: Repository with admin access to configure secrets and environments
4. **CDK Bootstrap**: CDK bootstrapped in each AWS account/region

### AWS IAM Permissions

Create IAM users or roles with the following permissions for each environment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "dynamodb:*",
        "s3:*",
        "cognito-idp:*",
        "apigateway:*",
        "iam:*",
        "kms:*",
        "logs:*",
        "events:*",
        "sns:*",
        "ses:*",
        "bedrock:*",
        "rekognition:*",
        "transcribe:*",
        "ssm:*",
        "secretsmanager:*"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note**: For production, use more restrictive policies following the principle of least privilege.

## GitHub Secrets Configuration

### Step 1: Navigate to Repository Secrets

1. Go to your GitHub repository
2. Click on **Settings**
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**

### Step 2: Add AWS Credentials for Each Environment

#### Development Environment Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID_DEV` | AWS access key for dev | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY_DEV` | AWS secret key for dev | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_ACCOUNT_ID_DEV` | AWS account ID for dev | `123456789012` |

#### Staging Environment Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID_STAGING` | AWS access key for staging | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY_STAGING` | AWS secret key for staging | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_ACCOUNT_ID_STAGING` | AWS account ID for staging | `123456789013` |

#### Production Environment Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID_PROD` | AWS access key for production | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY_PROD` | AWS secret key for production | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_ACCOUNT_ID_PROD` | AWS account ID for production | `123456789014` |
| `AWS_DEPLOY_ROLE_ARN` | (Optional) IAM role ARN for prod | `arn:aws:iam::123456789014:role/DeployRole` |

#### CI/CD Secrets (Optional)

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `AWS_ACCESS_KEY_ID` | AWS access key for CI checks | No (for CDK synth) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for CI checks | No (for CDK synth) |
| `CODECOV_TOKEN` | Codecov token for coverage reports | No |
| `SNYK_TOKEN` | Snyk token for security scanning | No |

### Step 3: Verify Secrets

After adding all secrets, verify they are correctly configured:

```bash
# Test AWS credentials locally
aws sts get-caller-identity --profile dev
aws sts get-caller-identity --profile staging
aws sts get-caller-identity --profile prod
```

## Environment Protection Rules

### Step 1: Create Environments

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Create three environments: `dev`, `staging`, `production`

### Step 2: Configure Production Environment Protection

For the **production** environment:

1. Click on the **production** environment
2. Enable **Required reviewers**
   - Add at least 1-2 reviewers who must approve deployments
3. (Optional) Enable **Wait timer**
   - Set to 5-10 minutes to allow for last-minute cancellations
4. Under **Deployment branches**, select **Selected branches**
   - Add rule: `main` branch only

### Step 3: Configure Staging Environment Protection (Optional)

For the **staging** environment:

1. Click on the **staging** environment
2. (Optional) Enable **Required reviewers** for additional safety
3. Under **Deployment branches**, select **Selected branches**
   - Add rule: `staging` branch only

### Step 4: Configure Dev Environment

For the **dev** environment:

1. Click on the **dev** environment
2. No protection rules needed (auto-deploy)
3. Under **Deployment branches**, select **Selected branches**
   - Add rule: `develop` branch only

## Workflow Details

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Pull requests to `develop`, `staging`, `main`
- Pushes to `develop`

**Jobs:**
1. **Lint**: Runs ESLint on TypeScript code
2. **Test**: Runs unit tests and property-based tests with coverage
3. **Build**: Compiles TypeScript to JavaScript
4. **CDK Synth**: Synthesizes CloudFormation templates
5. **Security Scan**: Runs Snyk vulnerability scanning

**Artifacts:**
- Test coverage reports (uploaded to Codecov)
- Build artifacts (dist/, lib/)
- CDK output (cdk.out/)

### Deploy Dev Workflow (`.github/workflows/deploy-dev.yml`)

**Triggers:**
- Pushes to `develop` branch

**Jobs:**
1. **CI Checks**: Runs full CI workflow
2. **Deploy Dev**: Deploys to AWS dev environment
3. **Smoke Tests**: Basic health checks
4. **Notify**: Sends deployment status notification

**Deployment Steps:**
1. Install dependencies
2. Build TypeScript
3. Configure AWS credentials
4. Deploy CDK stacks with `stage=dev`
5. Extract API Gateway URL
6. Run smoke tests

### Deploy Staging Workflow (`.github/workflows/deploy-staging.yml`)

**Triggers:**
- Pushes to `staging` branch

**Jobs:**
1. **CI Checks**: Runs full CI workflow
2. **Deploy Staging**: Deploys to AWS staging environment
3. **Integration Tests**: Comprehensive API tests
4. **Load Tests**: Performance testing with Artillery
5. **Notify**: Sends deployment status notification

**Integration Tests:**
- User registration flow
- Glucose logging flow
- Food logging flow
- Analytics dashboard
- API response time validation

**Load Tests:**
- Warm-up phase: 5 req/sec for 60 seconds
- Sustained load: 10 req/sec for 120 seconds

### Deploy Production Workflow (`.github/workflows/deploy-prod.yml`)

**Triggers:**
- Pushes to `main` branch
- **Requires manual approval** via GitHub environment protection

**Jobs:**
1. **CI Checks**: Runs full CI workflow
2. **Deploy Production**: Deploys to AWS production environment
3. **Smoke Tests**: Comprehensive production validation
4. **Rollback on Failure**: Alerts for manual rollback if needed
5. **Notify**: Sends deployment status notification

**Production Smoke Tests:**
- API health endpoint check
- Authentication endpoint availability
- API response time validation
- DynamoDB table verification
- S3 bucket verification
- CloudWatch alarm status check

**Safety Features:**
- Creates deployment backup before deployment
- Tags deployment with timestamp
- Comprehensive resource verification
- Manual rollback alert on failure

## Branch Strategy

### Recommended Git Flow

```
main (production)
  ↑
  └── staging
        ↑
        └── develop
              ↑
              └── feature/*, bugfix/*
```

### Workflow

1. **Feature Development**
   ```bash
   git checkout develop
   git checkout -b feature/new-feature
   # Make changes
   git commit -m "Add new feature"
   git push origin feature/new-feature
   # Create PR to develop
   ```

2. **Deploy to Dev**
   ```bash
   # Merge PR to develop
   # Automatic deployment to dev environment
   ```

3. **Deploy to Staging**
   ```bash
   git checkout staging
   git merge develop
   git push origin staging
   # Automatic deployment to staging environment
   ```

4. **Deploy to Production**
   ```bash
   git checkout main
   git merge staging
   git push origin main
   # Manual approval required
   # Deployment to production after approval
   ```

## Troubleshooting

### Common Issues

#### 1. CDK Bootstrap Error

**Error**: `This stack uses assets, so the toolkit stack must be deployed to the environment`

**Solution**:
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

#### 2. AWS Credentials Invalid

**Error**: `The security token included in the request is invalid`

**Solution**:
- Verify AWS credentials in GitHub secrets
- Check IAM user/role permissions
- Ensure credentials are not expired

#### 3. CloudFormation Stack Rollback

**Error**: `Stack deployment failed and rolled back`

**Solution**:
- Check CloudWatch Logs for Lambda errors
- Review CloudFormation events in AWS Console
- Verify all required resources are available

#### 4. Smoke Tests Failing

**Error**: `Health check failed with status code: 000`

**Solution**:
- Verify API Gateway deployment
- Check Lambda function logs
- Ensure security groups allow traffic
- Verify VPC configuration (if applicable)

#### 5. Integration Tests Timeout

**Error**: `Test exceeded timeout of 30000ms`

**Solution**:
- Increase test timeout in workflow
- Check Lambda cold start times
- Verify DynamoDB capacity settings

### Debugging Workflows

#### View Workflow Logs

1. Go to **Actions** tab in GitHub
2. Click on the failed workflow run
3. Click on the failed job
4. Expand the failed step to view logs

#### Re-run Failed Workflows

1. Go to **Actions** tab
2. Click on the failed workflow run
3. Click **Re-run jobs** → **Re-run failed jobs**

#### Manual Deployment

If CI/CD fails, deploy manually:

```bash
# Configure AWS credentials
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-east-1

# Deploy
npm run build
npm run cdk:deploy -- -c stage=dev
```

## Monitoring and Alerts

### CloudWatch Dashboards

After deployment, monitor the following:

- **Lambda Metrics**: Invocations, errors, duration, throttles
- **API Gateway Metrics**: Request count, latency, 4xx/5xx errors
- **DynamoDB Metrics**: Read/write capacity, throttles
- **Cost Metrics**: Daily spend by service

### CloudWatch Alarms

Set up alarms for:

- Lambda error rate > 5%
- API Gateway 5xx error rate > 1%
- DynamoDB throttled requests > 0
- Daily cost > threshold

### Notifications

Configure SNS topics for:

- Deployment success/failure
- CloudWatch alarm triggers
- Security findings from Snyk

## Best Practices

1. **Never commit AWS credentials** to the repository
2. **Use separate AWS accounts** for dev, staging, and production
3. **Enable MFA** for production AWS accounts
4. **Rotate AWS credentials** regularly (every 90 days)
5. **Review CloudWatch logs** after each deployment
6. **Monitor costs** to avoid unexpected charges
7. **Test in staging** before deploying to production
8. **Use semantic versioning** for releases
9. **Document all manual changes** to infrastructure
10. **Keep dependencies updated** for security patches

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)

## Support

For issues or questions:

1. Check this documentation
2. Review workflow logs in GitHub Actions
3. Check AWS CloudWatch logs
4. Open a GitHub issue with details
