#!/bin/bash

# GitHub Actions Secrets Validation Script
# This script helps validate that all required secrets are configured

set -e

echo "=================================="
echo "GitHub Actions Secrets Validator"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Required secrets
REQUIRED_SECRETS=(
  "AWS_ACCESS_KEY_ID_DEV"
  "AWS_SECRET_ACCESS_KEY_DEV"
  "AWS_ACCOUNT_ID_DEV"
  "AWS_ACCESS_KEY_ID_STAGING"
  "AWS_SECRET_ACCESS_KEY_STAGING"
  "AWS_ACCOUNT_ID_STAGING"
  "AWS_ACCESS_KEY_ID_PROD"
  "AWS_SECRET_ACCESS_KEY_PROD"
  "AWS_ACCOUNT_ID_PROD"
)

OPTIONAL_SECRETS=(
  "AWS_ACCESS_KEY_ID"
  "AWS_SECRET_ACCESS_KEY"
  "AWS_DEPLOY_ROLE_ARN"
  "CODECOV_TOKEN"
  "SNYK_TOKEN"
)

echo "Checking required secrets..."
echo ""

missing_secrets=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  # Note: This script cannot actually check GitHub secrets
  # It's meant to be run as a checklist
  echo "[ ] $secret"
  missing_secrets+=("$secret")
done

echo ""
echo "Checking optional secrets..."
echo ""

for secret in "${OPTIONAL_SECRETS[@]}"; do
  echo "[ ] $secret (optional)"
done

echo ""
echo "=================================="
echo "Manual Verification Required"
echo "=================================="
echo ""
echo "This script cannot automatically verify GitHub secrets."
echo "Please manually verify the following:"
echo ""
echo "1. Go to: https://github.com/YOUR_ORG/YOUR_REPO/settings/secrets/actions"
echo "2. Verify all required secrets are configured"
echo "3. Test AWS credentials locally:"
echo ""
echo "   # Test Dev credentials"
echo "   export AWS_ACCESS_KEY_ID=\$AWS_ACCESS_KEY_ID_DEV"
echo "   export AWS_SECRET_ACCESS_KEY=\$AWS_SECRET_ACCESS_KEY_DEV"
echo "   aws sts get-caller-identity"
echo ""
echo "   # Test Staging credentials"
echo "   export AWS_ACCESS_KEY_ID=\$AWS_ACCESS_KEY_ID_STAGING"
echo "   export AWS_SECRET_ACCESS_KEY=\$AWS_SECRET_ACCESS_KEY_STAGING"
echo "   aws sts get-caller-identity"
echo ""
echo "   # Test Production credentials"
echo "   export AWS_ACCESS_KEY_ID=\$AWS_ACCESS_KEY_ID_PROD"
echo "   export AWS_SECRET_ACCESS_KEY=\$AWS_SECRET_ACCESS_KEY_PROD"
echo "   aws sts get-caller-identity"
echo ""
echo "4. Verify GitHub Environments are configured:"
echo "   - dev (no protection)"
echo "   - staging (optional protection)"
echo "   - production (required reviewers)"
echo ""
echo "5. Verify branch protection rules:"
echo "   - develop → auto-deploy to dev"
echo "   - staging → auto-deploy to staging"
echo "   - main → manual approval for production"
echo ""
echo "=================================="
echo "Next Steps"
echo "=================================="
echo ""
echo "1. Configure all required secrets in GitHub"
echo "2. Set up GitHub Environments with protection rules"
echo "3. Bootstrap CDK in each AWS account:"
echo "   cdk bootstrap aws://ACCOUNT_ID/us-east-1"
echo "4. Push to develop branch to trigger first deployment"
echo ""
echo "For detailed instructions, see: CI_CD_SETUP.md"
echo ""
