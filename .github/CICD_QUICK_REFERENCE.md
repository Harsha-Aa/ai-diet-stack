# CI/CD Quick Reference Guide

## Quick Setup Checklist

### 1. Configure GitHub Secrets (Required)

Go to: `Settings → Secrets and variables → Actions → New repository secret`

**Development:**
- [ ] `AWS_ACCESS_KEY_ID_DEV`
- [ ] `AWS_SECRET_ACCESS_KEY_DEV`
- [ ] `AWS_ACCOUNT_ID_DEV`

**Staging:**
- [ ] `AWS_ACCESS_KEY_ID_STAGING`
- [ ] `AWS_SECRET_ACCESS_KEY_STAGING`
- [ ] `AWS_ACCOUNT_ID_STAGING`

**Production:**
- [ ] `AWS_ACCESS_KEY_ID_PROD`
- [ ] `AWS_SECRET_ACCESS_KEY_PROD`
- [ ] `AWS_ACCOUNT_ID_PROD`

**Optional:**
- [ ] `CODECOV_TOKEN` (for coverage reports)
- [ ] `SNYK_TOKEN` (for security scanning)

### 2. Configure GitHub Environments

Go to: `Settings → Environments → New environment`

**Production Environment:**
- [ ] Create environment named `production`
- [ ] Enable "Required reviewers" (add 1-2 reviewers)
- [ ] Set deployment branch to `main` only

**Staging Environment:**
- [ ] Create environment named `staging`
- [ ] Set deployment branch to `staging` only

**Dev Environment:**
- [ ] Create environment named `dev`
- [ ] Set deployment branch to `develop` only

### 3. Bootstrap CDK in AWS Accounts

```bash
# Dev account
cdk bootstrap aws://DEV_ACCOUNT_ID/us-east-1

# Staging account
cdk bootstrap aws://STAGING_ACCOUNT_ID/us-east-1

# Production account
cdk bootstrap aws://PROD_ACCOUNT_ID/us-east-1
```

### 4. Create Branches

```bash
git checkout -b develop
git push origin develop

git checkout -b staging
git push origin staging

# main branch should already exist
```

## Workflow Triggers

| Workflow | Trigger | Environment | Approval Required |
|----------|---------|-------------|-------------------|
| CI | PR to any branch, push to develop | N/A | No |
| Deploy Dev | Push to `develop` | dev | No |
| Deploy Staging | Push to `staging` | staging | No |
| Deploy Production | Push to `main` | production | **Yes** |

## Common Commands

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Build TypeScript
npm run build

# Synthesize CDK
npm run cdk:synth
```

### Manual Deployment

```bash
# Deploy to dev
npm run cdk:deploy -- -c stage=dev

# Deploy to staging
npm run cdk:deploy -- -c stage=staging

# Deploy to production
npm run cdk:deploy -- -c stage=prod
```

### Git Workflow

```bash
# Feature development
git checkout develop
git checkout -b feature/my-feature
# ... make changes ...
git commit -m "Add my feature"
git push origin feature/my-feature
# Create PR to develop

# Deploy to dev (automatic after merge)
git checkout develop
git merge feature/my-feature
git push origin develop

# Deploy to staging
git checkout staging
git merge develop
git push origin staging

# Deploy to production (requires approval)
git checkout main
git merge staging
git push origin main
```

## Monitoring Deployments

### View Workflow Status

1. Go to **Actions** tab in GitHub
2. Click on the workflow run
3. View job status and logs

### Check Deployment Status

```bash
# Get CloudFormation stack status
aws cloudformation describe-stacks \
  --stack-name AiDietMealRecommendationStack-dev \
  --query 'Stacks[0].StackStatus'

# Get API Gateway URL
aws cloudformation describe-stacks \
  --stack-name AiDietMealRecommendationStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

### Test Deployed API

```bash
# Health check
curl https://API_URL/health

# Test authentication endpoint
curl -X POST https://API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Troubleshooting

### Workflow Failed - What to Do?

1. **Check the logs**: Click on the failed job in GitHub Actions
2. **Identify the error**: Look for red error messages
3. **Common fixes**:
   - AWS credentials: Verify secrets are correct
   - CDK bootstrap: Run `cdk bootstrap` in the account
   - Permissions: Check IAM user/role permissions
   - Resource limits: Check AWS service quotas

### Re-run Failed Workflow

1. Go to **Actions** tab
2. Click on the failed workflow run
3. Click **Re-run jobs** → **Re-run failed jobs**

### Rollback Production Deployment

```bash
# Option 1: Revert the commit
git revert HEAD
git push origin main

# Option 2: Manual rollback via AWS Console
# Go to CloudFormation → Select stack → Actions → Roll back
```

### Emergency: Disable Auto-Deployment

1. Go to **Settings** → **Environments**
2. Click on the environment (e.g., `production`)
3. Add a deployment protection rule to block deployments
4. Or delete the workflow file temporarily

## CI/CD Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CI Workflow                          │
│  (Runs on PR and push to develop)                           │
│                                                              │
│  ┌──────┐  ┌──────┐  ┌───────┐  ┌──────────┐  ┌─────────┐ │
│  │ Lint │→ │ Test │→ │ Build │→ │ CDK Synth│→ │Security │ │
│  └──────┘  └──────┘  └───────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Deploy Dev Workflow                     │
│  (Automatic on push to develop)                             │
│                                                              │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐            │
│  │ CI Checks│→ │ Deploy Dev │→ │ Smoke Tests │            │
│  └──────────┘  └────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Deploy Staging Workflow                    │
│  (Automatic on push to staging)                             │
│                                                              │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────┐          │
│  │ CI Checks│→ │Deploy Staging│→ │Integration   │          │
│  └──────────┘  └─────────────┘  │Tests + Load  │          │
│                                   │Tests         │          │
│                                   └──────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 Deploy Production Workflow                   │
│  (Manual approval required on push to main)                 │
│                                                              │
│  ┌──────────┐  ┌─────────┐  ┌──────────────┐  ┌─────────┐│
│  │ CI Checks│→ │ APPROVAL│→ │Deploy Prod   │→ │Smoke    ││
│  └──────────┘  └─────────┘  └──────────────┘  │Tests +  ││
│                                                 │Verify   ││
│                                                 └─────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Test Coverage

The CI workflow runs:

- **Unit Tests**: Test individual functions
- **Property-Based Tests**: Test properties with fast-check
- **Integration Tests** (staging): Test API endpoints
- **Load Tests** (staging): Test performance with Artillery
- **Smoke Tests** (all envs): Basic health checks

## Security

- **Secrets**: Never commit AWS credentials
- **Scanning**: Snyk scans for vulnerabilities
- **Encryption**: All data encrypted at rest and in transit
- **Audit**: CloudTrail logs all API calls
- **MFA**: Enable MFA for production AWS accounts

## Cost Optimization

- **On-Demand**: Lambda and DynamoDB scale to zero
- **Caching**: npm dependencies cached in workflows
- **Artifacts**: Retention set to 7-365 days
- **Monitoring**: CloudWatch alarms for cost thresholds

## Support

- **Documentation**: See `CI_CD_SETUP.md` for detailed guide
- **Issues**: Open GitHub issue with workflow logs
- **AWS Support**: Check CloudWatch logs and CloudFormation events

## Quick Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Project README](../README.md)
- [Detailed CI/CD Setup Guide](../CI_CD_SETUP.md)
