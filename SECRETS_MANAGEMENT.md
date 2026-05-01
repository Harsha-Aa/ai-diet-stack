# Secrets Management Guide

## Overview

This document describes the secrets management strategy for the AI Diet & Meal Recommendation System. The system uses AWS Secrets Manager for sensitive data and AWS Systems Manager Parameter Store for non-sensitive configuration.

## Architecture

### AWS Secrets Manager
Used for sensitive data that requires encryption and rotation:
- Database credentials
- API keys (Stripe, CGM providers)
- JWT signing secrets
- Application encryption keys

### AWS Systems Manager Parameter Store
Used for non-sensitive configuration that may change between environments:
- Bedrock model IDs
- AWS region settings
- Email addresses
- Rate limits
- Feature flags

## Naming Conventions

### Secrets Manager

All secrets follow this naming pattern:
```
/{environment}/ai-diet/{secret-name}
```

**Examples:**
- `/dev/ai-diet/database-credentials`
- `/staging/ai-diet/stripe-api-key`
- `/prod/ai-diet/jwt-secret`

### Parameter Store

All parameters follow this naming pattern:
```
/{environment}/ai-diet/{parameter-name}
```

**Examples:**
- `/dev/ai-diet/bedrock-model-id`
- `/staging/ai-diet/ses-from-email`
- `/prod/ai-diet/free-tier-limits`

## Secrets Inventory

### Secrets Manager Secrets

| Secret Name | Description | Rotation | Required |
|-------------|-------------|----------|----------|
| `database-credentials` | Database username and password | 90 days | Future use |
| `jwt-secret` | JWT token signing key | 180 days | Yes |
| `encryption-key` | Application-level encryption key | 180 days | Yes |
| `stripe-api-key` | Stripe payment API key | Manual | Yes (Premium) |
| `dexcom-api-credentials` | Dexcom CGM OAuth credentials | Manual | Optional |
| `libre-api-credentials` | Libre CGM OAuth credentials | Manual | Optional |

### Parameter Store Parameters

| Parameter Name | Description | Type | Example Value |
|----------------|-------------|------|---------------|
| `bedrock-model-id` | Amazon Bedrock model identifier | String | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `bedrock-region` | AWS region for Bedrock | String | `us-east-1` |
| `ses-from-email` | SES sender email address | String | `noreply@aidiet.app` |
| `api-rate-limit` | API Gateway rate limit | Number | `100` |
| `session-timeout-minutes` | User session timeout | Number | `60` |
| `free-tier-limits` | Free tier usage limits (JSON) | JSON | See below |

**Free Tier Limits JSON Structure:**
```json
{
  "food_recognition": 25,
  "glucose_prediction": 20,
  "meal_recommendation": 15,
  "voice_entry": 20,
  "text_nutrient_analysis": 25,
  "insulin_dose": 20,
  "pattern_insight": 1
}
```

## Secret Rotation Policies

### Automatic Rotation

**Database Credentials** (Future):
- Rotation frequency: Every 90 days
- Rotation strategy: AWS Secrets Manager automatic rotation with Lambda
- Zero-downtime: Multi-user rotation strategy

**JWT Secret**:
- Rotation frequency: Every 180 days
- Rotation strategy: Manual rotation with grace period
- Process:
  1. Generate new secret
  2. Deploy with both old and new secrets active
  3. Wait for all tokens to expire (60 minutes)
  4. Remove old secret

**Encryption Key**:
- Rotation frequency: Every 180 days
- Rotation strategy: Key versioning with re-encryption
- Process:
  1. Generate new key version
  2. Re-encrypt all data with new key
  3. Maintain old key for decryption only
  4. Remove old key after migration complete

### Manual Rotation

**Stripe API Key**:
- Rotation trigger: Security incident or annual review
- Process:
  1. Generate new key in Stripe dashboard
  2. Update secret in Secrets Manager
  3. Deploy updated Lambda functions
  4. Revoke old key in Stripe

**CGM API Credentials**:
- Rotation trigger: Security incident or provider requirement
- Process:
  1. Generate new OAuth credentials from provider
  2. Update secret in Secrets Manager
  3. Deploy updated Lambda functions
  4. Revoke old credentials with provider

## Deployment Process

### Initial Setup

1. **Deploy Infrastructure**:
   ```bash
   # Deploy secrets stack first
   cdk deploy SecretsStack-dev --context stage=dev
   ```

2. **Update Placeholder Secrets**:
   ```bash
   # Update Stripe API key
   aws secretsmanager update-secret \
     --secret-id /dev/ai-diet/stripe-api-key \
     --secret-string "sk_test_YOUR_STRIPE_KEY"
   
   # Update Dexcom credentials
   aws secretsmanager update-secret \
     --secret-id /dev/ai-diet/dexcom-api-credentials \
     --secret-string '{"clientId":"YOUR_CLIENT_ID","clientSecret":"YOUR_CLIENT_SECRET","redirectUri":"YOUR_REDIRECT_URI"}'
   ```

3. **Verify Secrets**:
   ```bash
   # List all secrets
   aws secretsmanager list-secrets \
     --filters Key=name,Values=/dev/ai-diet/
   
   # Get a specific secret (for testing)
   aws secretsmanager get-secret-value \
     --secret-id /dev/ai-diet/jwt-secret
   ```

### Environment-Specific Deployment

**Development**:
- Use placeholder values for external APIs
- Auto-generated secrets are sufficient
- No rotation required

**Staging**:
- Use test API keys from providers
- Enable rotation for testing
- Mirror production configuration

**Production**:
- Use production API keys
- Enable all rotation policies
- Strict access controls

## Access Control

### IAM Policies

Lambda functions have read-only access to secrets:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:/*/ai-diet/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:parameter/*/ai-diet/*"
      ]
    }
  ]
}
```

### KMS Encryption

All secrets are encrypted with a customer-managed KMS key:
- Key rotation: Enabled (automatic annual rotation)
- Key policy: Least privilege access
- Audit: CloudTrail logs all key usage

## Usage in Lambda Functions

### Import the Secrets Module

```typescript
import {
  getJwtSecret,
  getStripeApiKey,
  getDexcomApiCredentials,
  getBedrockModelId,
  getFreeTierLimits,
} from '../shared/secrets';
```

### Retrieve Secrets

```typescript
// Get a single secret
const jwtSecret = await getJwtSecret();

// Get configuration parameters
const bedrockModelId = await getBedrockModelId();
const freeTierLimits = await getFreeTierLimits();

// Get all config at once (batch operation)
const config = await getAllConfigParameters();
```

### Caching

Secrets are automatically cached for 5 minutes to reduce API calls:
- First call: Fetches from AWS
- Subsequent calls: Returns cached value
- After 5 minutes: Fetches fresh value

To clear cache (useful for testing):
```typescript
import { clearSecretsCache } from '../shared/secrets';

clearSecretsCache();
```

### Error Handling

All secret retrieval functions include automatic retry logic:
- Retries: Up to 3 attempts
- Backoff: Exponential (1s, 2s, 4s)
- Errors: Descriptive error messages

```typescript
try {
  const secret = await getJwtSecret();
} catch (error) {
  console.error('Failed to retrieve JWT secret:', error);
  // Handle error appropriately
}
```

## Security Best Practices

### DO

✅ Use Secrets Manager for sensitive data  
✅ Use Parameter Store for non-sensitive config  
✅ Enable KMS encryption for all secrets  
✅ Implement automatic rotation where possible  
✅ Use IAM policies for least-privilege access  
✅ Cache secrets to reduce API calls  
✅ Log secret access for audit purposes  
✅ Use environment-specific secret paths  

### DON'T

❌ Store secrets in environment variables  
❌ Commit secrets to version control  
❌ Share secrets between environments  
❌ Use AWS-managed keys for HIPAA data  
❌ Grant write access to Lambda functions  
❌ Disable CloudTrail logging  
❌ Use long-lived secrets without rotation  
❌ Hardcode secrets in Lambda code  

## Monitoring and Alerts

### CloudWatch Alarms

**Secret Access Failures**:
- Metric: `secretsmanager:GetSecretValue` errors
- Threshold: > 5 errors in 5 minutes
- Action: SNS notification to ops team

**Unusual Access Patterns**:
- Metric: `secretsmanager:GetSecretValue` count
- Threshold: > 1000 calls in 1 minute
- Action: SNS notification + investigate

### CloudTrail Audit

All secret access is logged to CloudTrail:
- Event: `GetSecretValue`
- Retention: 7 years (HIPAA compliance)
- Analysis: Regular review for anomalies

## Troubleshooting

### Secret Not Found

**Error**: `ResourceNotFoundException: Secrets Manager can't find the specified secret`

**Solution**:
1. Verify secret exists: `aws secretsmanager list-secrets`
2. Check secret name matches environment
3. Ensure CDK stack deployed successfully

### Access Denied

**Error**: `AccessDeniedException: User is not authorized to perform: secretsmanager:GetSecretValue`

**Solution**:
1. Verify Lambda execution role has correct permissions
2. Check KMS key policy allows Lambda role
3. Ensure secret resource policy allows access

### Cache Issues

**Problem**: Secret value not updating after manual change

**Solution**:
1. Wait 5 minutes for cache to expire
2. Or call `clearSecretsCache()` to force refresh
3. Or restart Lambda (cold start clears cache)

## Compliance

### HIPAA Requirements

✅ Encryption at rest (KMS)  
✅ Encryption in transit (TLS 1.2+)  
✅ Access controls (IAM policies)  
✅ Audit logging (CloudTrail)  
✅ Secret rotation (automated)  
✅ Least privilege access  

### Audit Trail

All secret operations are logged:
- Who accessed the secret (IAM principal)
- When it was accessed (timestamp)
- What secret was accessed (secret ARN)
- From where (source IP, Lambda ARN)

## Cost Optimization

### Secrets Manager Costs

- Secret storage: $0.40 per secret per month
- API calls: $0.05 per 10,000 calls
- Rotation: Included (Lambda execution costs apply)

**Optimization strategies**:
- Cache secrets to reduce API calls
- Use Parameter Store for non-sensitive config (cheaper)
- Batch parameter retrieval with `GetParametersByPath`

### Parameter Store Costs

- Standard parameters: Free
- Advanced parameters: $0.05 per parameter per month
- API calls: Free (standard tier)

**Current setup**: All parameters use standard tier (free)

## References

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [HIPAA Compliance on AWS](https://aws.amazon.com/compliance/hipaa-compliance/)
