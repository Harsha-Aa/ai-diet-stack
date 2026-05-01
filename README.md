# AI Diet & Meal Recommendation System

AI-powered diabetes management platform built on AWS serverless architecture with HIPAA compliance.

## Overview

The AI Diet & Meal Recommendation System is a comprehensive diabetes management application designed to help pre-diabetes, Type 1, and Type 2 diabetes patients manage their condition through intelligent food tracking, glucose monitoring, and personalized recommendations.

### Key Features

- **Glucose Monitoring**: Manual entry and CGM device integration
- **AI Food Recognition**: Photo-based food identification using Amazon Rekognition
- **Predictive Analytics**: Glucose predictions using Amazon Bedrock (Claude)
- **Personalized Recommendations**: AI-powered meal suggestions
- **Dashboard Analytics**: eA1C, Time in Range (TIR), AGP reports
- **Voice Entry**: Speech-to-text using Amazon Transcribe
- **Freemium Model**: Usage-based limits with premium subscription option

## Architecture

Built on AWS serverless architecture:
- **Compute**: AWS Lambda
- **Storage**: DynamoDB, S3
- **Authentication**: Amazon Cognito
- **API**: API Gateway REST API
- **AI Services**: Amazon Bedrock, Rekognition, Transcribe
- **Notifications**: SNS, SES
- **Monitoring**: CloudWatch, X-Ray, CloudTrail

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- TypeScript 5.x

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-diet-meal-recommendation-system
```

2. Install dependencies:
```bash
npm install
```

3. Configure AWS credentials:
```bash
aws configure
```

## Project Structure

```
.
├── bin/                    # CDK app entry point
│   └── app.ts
├── lib/                    # CDK stack definitions
│   └── ai-diet-meal-recommendation-stack.ts
├── src/                    # Lambda function source code
│   ├── auth/              # Authentication functions
│   ├── glucose/           # Glucose tracking functions
│   ├── food/              # Food logging functions
│   ├── ai/                # AI prediction functions
│   ├── analytics/         # Analytics functions
│   └── shared/            # Shared utilities
├── test/                   # Test files
│   ├── setup.ts
│   └── *.test.ts
├── cdk.json               # CDK configuration
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest configuration
└── package.json           # Dependencies
```

## Development

### Build the project
```bash
npm run build
```

### Run tests
```bash
npm test
```

### Watch mode for tests
```bash
npm run test:watch
```

### Lint code
```bash
npm run lint
```

### Format code
```bash
npm run format
```

## CDK Commands

### Synthesize CloudFormation template
```bash
npm run cdk:synth
```

### Deploy to AWS
```bash
npm run cdk:deploy
```

### View differences
```bash
npm run cdk:diff
```

### Destroy stack
```bash
npm run cdk:destroy
```

### Deploy to specific stage
```bash
cdk deploy -c stage=dev
cdk deploy -c stage=prod
```

## Configuration

### Environment Variables

The following environment variables can be configured:

- `CDK_DEFAULT_ACCOUNT`: AWS account ID
- `CDK_DEFAULT_REGION`: AWS region (default: us-east-1)

### CDK Context

Configure stage-specific settings in `cdk.json` or pass via CLI:

```bash
cdk deploy -c stage=prod
```

## Testing

The project uses Jest for testing with the following test types:

- **Unit Tests**: Test individual functions and components
- **Property-Based Tests**: Use fast-check for testing properties across many inputs
- **Integration Tests**: Test AWS service integrations

Run all tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Security & Compliance

### HIPAA Compliance

- **Encryption at Rest**: KMS encryption for DynamoDB and S3
- **Encryption in Transit**: TLS 1.2+ for all API communications
- **Audit Logging**: CloudTrail for all API calls
- **Access Control**: IAM roles with least-privilege access
- **Data Retention**: Point-in-time recovery for DynamoDB tables

### Authentication

- Amazon Cognito User Pool with email verification
- JWT tokens with 60-minute expiry
- Optional MFA support (SMS and TOTP)
- Password policy: 8+ characters, uppercase, lowercase, digits, symbols

## Monitoring

- **CloudWatch Logs**: Centralized logging for all Lambda functions
- **CloudWatch Metrics**: Custom metrics for usage tracking
- **CloudWatch Alarms**: Alerts for errors and cost thresholds
- **X-Ray**: Distributed tracing for performance optimization
- **CloudTrail**: Audit logging for compliance

## Cost Optimization

- **On-Demand Billing**: DynamoDB and Lambda scale to zero
- **S3 Lifecycle Policies**: Automatic transition to IA after 30 days
- **Usage Limits**: Freemium model with usage tracking
- **Resource Tagging**: Cost allocation by project and environment

## CI/CD Pipeline

The project uses GitHub Actions for automated CI/CD with the following workflows:

### Workflows

1. **CI Workflow** (`.github/workflows/ci.yml`)
   - Triggers on pull requests and pushes to develop branch
   - Runs linting, unit tests, property-based tests
   - Generates test coverage reports
   - Builds TypeScript code
   - Synthesizes CDK stacks
   - Runs security scans

2. **Deploy Dev** (`.github/workflows/deploy-dev.yml`)
   - Triggers on pushes to develop branch
   - Runs CI checks first
   - Deploys to dev environment
   - Runs smoke tests

3. **Deploy Staging** (`.github/workflows/deploy-staging.yml`)
   - Triggers on pushes to staging branch
   - Runs CI checks first
   - Deploys to staging environment
   - Runs integration tests and load tests

4. **Deploy Production** (`.github/workflows/deploy-prod.yml`)
   - Triggers on pushes to main branch
   - Requires manual approval (GitHub environment protection)
   - Runs CI checks first
   - Creates deployment backup
   - Deploys to production environment
   - Runs comprehensive smoke tests
   - Verifies AWS resources (DynamoDB, S3, CloudWatch)

### Required GitHub Secrets

Configure the following secrets in your GitHub repository settings:

#### AWS Credentials - Development
- `AWS_ACCESS_KEY_ID_DEV` - AWS access key for dev environment
- `AWS_SECRET_ACCESS_KEY_DEV` - AWS secret key for dev environment
- `AWS_ACCOUNT_ID_DEV` - AWS account ID for dev environment

#### AWS Credentials - Staging
- `AWS_ACCESS_KEY_ID_STAGING` - AWS access key for staging environment
- `AWS_SECRET_ACCESS_KEY_STAGING` - AWS secret key for staging environment
- `AWS_ACCOUNT_ID_STAGING` - AWS account ID for staging environment

#### AWS Credentials - Production
- `AWS_ACCESS_KEY_ID_PROD` - AWS access key for production environment
- `AWS_SECRET_ACCESS_KEY_PROD` - AWS secret key for production environment
- `AWS_ACCOUNT_ID_PROD` - AWS account ID for production environment
- `AWS_DEPLOY_ROLE_ARN` - (Optional) IAM role ARN for production deployments

#### CI/CD Secrets (Optional)
- `AWS_ACCESS_KEY_ID` - AWS access key for CI checks (CDK synth)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for CI checks (CDK synth)
- `CODECOV_TOKEN` - (Optional) Codecov token for coverage reports
- `SNYK_TOKEN` - (Optional) Snyk token for security scanning

### GitHub Environment Protection

Configure environment protection rules in GitHub:

1. **Production Environment**
   - Enable "Required reviewers" (at least 1 reviewer)
   - Enable "Wait timer" (optional, e.g., 5 minutes)
   - Restrict to main branch only

2. **Staging Environment**
   - Enable "Required reviewers" (optional)
   - Restrict to staging branch only

3. **Dev Environment**
   - No restrictions (auto-deploy on develop branch)

### Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the corresponding value

### Branch Strategy

- `develop` - Development branch (auto-deploys to dev)
- `staging` - Staging branch (auto-deploys to staging)
- `main` - Production branch (deploys to production with approval)

### Manual Deployment

You can still deploy manually using CDK:

#### Development Environment
```bash
cdk deploy -c stage=dev
```

#### Staging Environment
```bash
cdk deploy -c stage=staging
```

#### Production Environment
```bash
cdk deploy -c stage=prod
```

## Troubleshooting

### CDK Bootstrap

If you encounter bootstrap errors:
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Permission Issues

Ensure your AWS credentials have the necessary permissions:
- CloudFormation
- Lambda
- DynamoDB
- S3
- Cognito
- API Gateway
- IAM
- KMS
- CloudWatch

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Run linting and tests
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
