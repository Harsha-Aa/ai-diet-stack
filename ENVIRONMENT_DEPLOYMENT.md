# Multi-Environment Deployment Guide

This document describes how to deploy the AI Diet & Meal Recommendation System to different environments (dev, staging, prod) using AWS CDK.

## Table of Contents

- [Overview](#overview)
- [Environment Configurations](#environment-configurations)
- [Deployment Commands](#deployment-commands)
- [Environment Variables](#environment-variables)
- [Resource Naming](#resource-naming)
- [Configuration Management](#configuration-management)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The project supports three deployment environments:

- **Development (dev)**: For active development and testing
- **Staging (staging)**: For pre-production testing and validation
- **Production (prod)**: For live production workloads

Each environment has its own configuration with environment-specific settings for:
- Resource naming (prefixes/suffixes)
- Log retention periods
- Backup policies
- Cost optimization settings
- Security configurations
- HIPAA compliance levels

## Environment Configurations

### Development Environment

**Purpose**: Active development and testing

**Characteristics**:
- Shorter log retention (1 week) for cost savings
- Relaxed security policies for faster development
- Resources can be destroyed (`DESTROY` removal policy)
- Point-in-time recovery disabled
- Optional MFA
- Smaller Lambda memory (512 MB)
- Aggressive S3 lifecycle policies (7 days to IA, 30 days expiration)

**Use Cases**:
- Feature development
- Unit testing
- Integration testing
- Experimentation

### Staging Environment

**Purpose**: Pre-production testing and validation

**Characteristics**:
- Production-like settings
- Full HIPAA compliance testing
- Extended retention (1 month logs, 30 days backups)
- Point-in-time recovery enabled
- MFA enabled
- Production-like Lambda memory (1 GB)
- Production-like S3 lifecycle policies

**Use Cases**:
- End-to-end testing
- Performance testing
- Security testing
- User acceptance testing (UAT)
- HIPAA compliance validation

### Production Environment

**Purpose**: Live production workloads

**Characteristics**:
- Full HIPAA compliance
- Extended retention (6 months logs, 7 years backups)
- Point-in-time recovery enabled
- MFA required
- Optimized Lambda memory (1.5 GB)
- HIPAA-compliant S3 lifecycle policies (7 years retention)
- Resources always retained (`RETAIN` removal policy)
- Comprehensive monitoring and alerting

**Use Cases**:
- Live user traffic
- Production data storage
- Real-time health monitoring

## Deployment Commands

### Prerequisites

1. Install AWS CDK:
```bash
npm install -g aws-cdk
```

2. Install project dependencies:
```bash
npm install
```

3. Configure AWS credentials:
```bash
aws configure
```

### Deploy to Development

```bash
# Using CDK context
cdk deploy --context stage=dev

# Using environment variable
STAGE=dev cdk deploy

# Alternative environment variable
ENVIRONMENT=dev cdk deploy
```

### Deploy to Staging

```bash
# Using CDK context
cdk deploy --context stage=staging

# Using environment variable
STAGE=staging cdk deploy
```

### Deploy to Production

```bash
# Using CDK context
cdk deploy --context stage=prod

# Using environment variable
STAGE=prod cdk deploy
```

### Synthesize CloudFormation Template

Preview the CloudFormation template without deploying:

```bash
# Development
cdk synth --context stage=dev

# Staging
cdk synth --context stage=staging

# Production
cdk synth --context stage=prod
```

### Diff Changes

Compare deployed stack with local changes:

```bash
# Development
cdk diff --context stage=dev

# Staging
cdk diff --context stage=staging

# Production
cdk diff --context stage=prod
```

### Destroy Stack

**WARNING**: This will delete all resources. Use with caution!

```bash
# Development (allowed)
cdk destroy --context stage=dev

# Staging (use with caution)
cdk destroy --context stage=staging

# Production (NOT RECOMMENDED - resources are retained by policy)
cdk destroy --context stage=prod
```

## Environment Variables

The following environment variables can be used to configure deployments:

### Required Variables

- `CDK_DEFAULT_ACCOUNT`: AWS account ID (auto-detected if using AWS CLI)
- `CDK_DEFAULT_REGION`: AWS region (defaults to `us-east-1`)

### Optional Variables

- `STAGE` or `ENVIRONMENT`: Environment name (dev, staging, prod)
  - Defaults to `dev` if not specified
  - Can also be set via CDK context: `--context stage=<env>`

### Lambda Function Environment Variables

Lambda functions automatically receive:

- `ENVIRONMENT`: Current environment name
- `STAGE`: Alias for ENVIRONMENT
- `AWS_REGION`: AWS region
- `LOG_LEVEL`: Logging level based on environment

## Resource Naming

Resources are named using environment-specific prefixes to avoid conflicts:

### Naming Pattern

```
{environment}-{resource-name}
```

### Examples

**Development**:
- Stack: `dev-ai-diet-meal-recommendation`
- User Pool: `dev-ai-diet-users`
- S3 Bucket: `dev-ai-diet-food-images`
- DynamoDB Table: `dev-ai-diet-user-profiles`
- KMS Key Alias: `dev-ai-diet-meal-recommendation-key`

**Staging**:
- Stack: `staging-ai-diet-meal-recommendation`
- User Pool: `staging-ai-diet-users`
- S3 Bucket: `staging-ai-diet-food-images`
- DynamoDB Table: `staging-ai-diet-user-profiles`
- KMS Key Alias: `staging-ai-diet-meal-recommendation-key`

**Production**:
- Stack: `prod-ai-diet-meal-recommendation`
- User Pool: `prod-ai-diet-users`
- S3 Bucket: `prod-ai-diet-food-images`
- DynamoDB Table: `prod-ai-diet-user-profiles`
- KMS Key Alias: `prod-ai-diet-meal-recommendation-key`

## Configuration Management

### Configuration Files

Environment configurations are stored in:

```
config/
├── environment.ts          # Type definitions
├── index.ts               # Configuration loader
└── environments/
    ├── dev.ts            # Development config
    ├── staging.ts        # Staging config
    └── prod.ts           # Production config
```

### Adding New Configuration

To add a new configuration parameter:

1. Update `config/environment.ts` with the new property
2. Add the property to each environment file (dev.ts, staging.ts, prod.ts)
3. Use the property in your stack or Lambda functions

Example:

```typescript
// config/environment.ts
export interface EnvironmentConfig {
  // ... existing properties
  newFeatureEnabled: boolean;
}

// config/environments/dev.ts
export const devConfig: EnvironmentConfig = {
  // ... existing properties
  newFeatureEnabled: true,
};

// lib/ai-diet-meal-recommendation-stack.ts
if (this.envConfig.newFeatureEnabled) {
  // Create new feature resources
}
```

### Using Configuration in Lambda Functions

```typescript
import { getCurrentEnvironment, isProduction, getTableName } from '../shared/environment';

export const handler = async (event: any) => {
  const env = getCurrentEnvironment();
  console.log(`Running in ${env} environment`);
  
  if (isProduction()) {
    // Production-specific logic
  }
  
  const tableName = getTableName('ai-diet-user-profiles');
  // Use tableName with DynamoDB client
};
```

## Best Practices

### 1. Always Test in Dev First

```bash
# Deploy to dev
cdk deploy --context stage=dev

# Test thoroughly
npm test

# Deploy to staging
cdk deploy --context stage=staging

# Final validation
# Deploy to production
cdk deploy --context stage=prod
```

### 2. Use CDK Diff Before Deploying

```bash
# Check what will change
cdk diff --context stage=prod

# Review changes carefully
# Deploy if changes are expected
cdk deploy --context stage=prod
```

### 3. Tag Resources Appropriately

All resources are automatically tagged with:
- `Environment`: dev, staging, or prod
- `Project`: AiDietMealRecommendation
- `ManagedBy`: CDK
- `CostCenter`: Environment-specific
- `Owner`: Team name

### 4. Monitor Costs

- Development: Aggressive cleanup, cost-optimized
- Staging: Balanced retention
- Production: Full retention, no cost optimization

Use AWS Cost Explorer to monitor spending per environment using tags.

### 5. Backup and Recovery

**Development**:
- No point-in-time recovery
- 7-day backup retention
- Resources can be destroyed

**Staging**:
- Point-in-time recovery enabled
- 30-day backup retention
- Resources retained

**Production**:
- Point-in-time recovery enabled
- 7-year backup retention (HIPAA compliance)
- Resources always retained
- Regular backup testing recommended

### 6. Security

**Development**:
- Encryption enabled
- MFA optional
- Relaxed policies

**Staging**:
- Full encryption
- MFA enabled
- Production-like security

**Production**:
- Full encryption (KMS)
- MFA required
- HIPAA-compliant security
- Audit logging enabled

## Troubleshooting

### Issue: "Invalid environment" error

**Solution**: Ensure environment name is one of: dev, staging, prod

```bash
# Correct
cdk deploy --context stage=dev

# Incorrect
cdk deploy --context stage=development  # Will default to 'dev'
```

### Issue: Resource name conflicts

**Solution**: Each environment uses unique prefixes. Ensure you're deploying to the correct environment.

```bash
# Check current environment
cdk synth --context stage=dev | grep StackName
```

### Issue: Permission denied during deployment

**Solution**: Ensure AWS credentials have sufficient permissions:

```bash
# Check current credentials
aws sts get-caller-identity

# Ensure you have AdministratorAccess or equivalent
```

### Issue: Stack already exists

**Solution**: Use a different environment or destroy the existing stack:

```bash
# List existing stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Destroy if needed (dev only)
cdk destroy --context stage=dev
```

### Issue: Lambda function can't find resources

**Solution**: Ensure Lambda functions use environment-aware resource names:

```typescript
import { getTableName } from '../shared/environment';

// Correct
const tableName = getTableName('ai-diet-user-profiles');

// Incorrect
const tableName = 'ai-diet-user-profiles';  // Missing environment prefix
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main        # Deploy to production
      - staging     # Deploy to staging
      - develop     # Deploy to development

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to Dev
        if: github.ref == 'refs/heads/develop'
        run: cdk deploy --context stage=dev --require-approval never
      
      - name: Deploy to Staging
        if: github.ref == 'refs/heads/staging'
        run: cdk deploy --context stage=staging --require-approval never
      
      - name: Deploy to Production
        if: github.ref == 'refs/heads/main'
        run: cdk deploy --context stage=prod --require-approval never
```

## Summary

- **Three environments**: dev, staging, prod
- **Environment-specific configurations**: Defined in `config/environments/`
- **Deployment**: Use `--context stage=<env>` or `STAGE=<env>` environment variable
- **Resource naming**: Automatic prefixing with environment name
- **Best practice**: Test in dev → staging → prod
- **Production**: Full HIPAA compliance, 7-year retention, always retained

For more information, see:
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Project README](./README.md)
- [Deployment Guide](./DEPLOYMENT.md)
