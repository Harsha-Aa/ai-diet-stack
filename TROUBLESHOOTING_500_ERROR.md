# Troubleshooting 500 Error on Registration

## Current Status

✅ **Health endpoint works** - Server is running with AWS integration enabled  
❌ **Registration fails** - Returns 500 Internal Server Error  
⏳ **Latest code not deployed** - Debug endpoint (404) and error details not showing  

---

## Possible Causes

### 1. AWS Credentials Issue
**Symptoms**: 500 error, no specific error message  
**Check**:
- Render Environment tab → Verify `AWS_ACCESS_KEY_ID` is set
- Render Environment tab → Verify `AWS_SECRET_ACCESS_KEY` is set
- Values should match those in `local-server/.env`

### 2. Cognito Configuration Issue
**Symptoms**: 500 error when calling Cognito API  
**Check**:
- `COGNITO_USER_POOL_ID` should be `us-east-1_mzKjA4m2a`
- `COGNITO_CLIENT_ID` should be `59kkpi3ujptbngvp8im8sft1mi`
- Region should be `us-east-1`

### 3. DynamoDB Table Not Found
**Symptoms**: 500 error when trying to write to DynamoDB  
**Check**:
- `DYNAMODB_USERS_TABLE` should be `dev-ai-diet-users`
- Table exists in AWS Console → DynamoDB → Tables
- Table is in `us-east-1` region

### 4. IAM Permissions Issue
**Symptoms**: 500 error with "Access Denied" in logs  
**Check**:
- IAM user `kiro-agent` has permissions for:
  - `cognito-idp:SignUp`
  - `cognito-idp:InitiateAuth`
  - `dynamodb:PutItem`
  - `dynamodb:GetItem`
  - `dynamodb:Query`

### 5. Module Import Issue
**Symptoms**: 500 error, "Cannot find module" in logs  
**Check**:
- `dist/` folder was created during build
- `postinstall` script ran successfully
- TypeScript compiled without errors

---

## Debugging Steps

### Step 1: Check Render Logs

1. Go to https://dashboard.render.com/
2. Click **ai-diet-api**
3. Click **Logs** tab
4. Try registration again
5. Look for error messages

**What to look for**:
```
Registration error: <error message>
Full error: <full error object>
Error stack: <stack trace>
```

### Step 2: Verify Latest Deployment

1. Click **Events** tab
2. Check if latest commit is deployed
3. Latest commit should be: `b6438da` or later
4. If not, click **Manual Deploy** → **Deploy latest commit**

### Step 3: Test Debug Endpoint

Once deployed, test:
```bash
curl https://ai-diet-api.onrender.com/debug/aws-config
```

Should return:
```json
{
  "aws_region": "us-east-1",
  "aws_access_key_configured": true,
  "cognito_user_pool_id": "us-east-1_mzKjA4m2a",
  "cognito_client_id": "59kkpi3ujptbngvp8im8sft1mi",
  "dynamodb_users_table": "dev-ai-diet-users",
  "enable_aws_services": "true",
  "use_mock_data": "false"
}
```

### Step 4: Test Registration with Error Details

```powershell
$body = @{
    email = "test-$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
    password = "Test123!"
    age = 30
    weight_kg = 70
    height_cm = 170
    diabetes_type = "type2"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://ai-diet-api.onrender.com/auth/register" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

If it fails, the error response should now include `details` field with the actual error message.

---

## Common Error Messages and Solutions

### "Cannot find module './dist/services/auth.service'"
**Solution**: TypeScript didn't compile. Check build logs for `tsc` errors.

### "User pool us-east-1_mzKjA4m2a does not exist"
**Solution**: Cognito User Pool ID is wrong or not in us-east-1 region.

### "The security token included in the request is invalid"
**Solution**: AWS credentials are wrong. Double-check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

### "Requested resource not found"
**Solution**: DynamoDB table name is wrong or table doesn't exist.

### "User: arn:aws:iam::407902217908:user/kiro-agent is not authorized"
**Solution**: IAM user doesn't have required permissions. Check IAM policy.

---

## Manual Testing in AWS Console

### Test Cognito
1. Go to AWS Console → Cognito
2. Select User Pool `us-east-1_mzKjA4m2a`
3. Try creating a test user manually
4. If it works, the issue is with credentials or code

### Test DynamoDB
1. Go to AWS Console → DynamoDB
2. Select table `dev-ai-diet-users`
3. Try adding an item manually
4. If it works, the issue is with credentials or code

### Test IAM Permissions
1. Go to AWS Console → IAM
2. Select user `kiro-agent`
3. Check attached policies
4. Verify permissions include Cognito and DynamoDB actions

---

## Temporary Workaround: Use Mock Data

If AWS integration continues to fail, you can temporarily fall back to mock data:

1. In Render Environment tab, set:
   ```
   USE_MOCK_DATA=true
   ENABLE_AWS_SERVICES=false
   ```

2. Redeploy

3. This will use in-memory storage (data lost on restart) but will allow testing

---

## Next Steps

1. **Check Render Logs** for the actual error message
2. **Verify AWS credentials** are correct
3. **Test AWS services** manually in AWS Console
4. **Check IAM permissions** for kiro-agent user
5. **Report back** with the error message from logs

---

## Contact Information

If you're stuck, provide:
1. Error message from Render logs
2. Screenshot of Render Environment variables (hide sensitive values)
3. Screenshot of AWS Console showing DynamoDB tables
4. Screenshot of IAM user permissions

This will help diagnose the exact issue.
