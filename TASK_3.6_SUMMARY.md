# Task 3.6: Configure DynamoDB On-Demand Capacity and Point-in-Time Recovery

## Summary
Successfully configured all DynamoDB tables in the DataStack with consistent on-demand capacity (PAY_PER_REQUEST) billing mode and appropriate point-in-time recovery settings.

## Changes Made

### Modified File: `lib/stacks/data-stack.ts`

Updated 5 tables to use consistent PAY_PER_REQUEST billing mode and proper point-in-time recovery configuration:

1. **UserProfilesTable**
   - Changed from conditional billing mode to: `billingMode: dynamodb.BillingMode.PAY_PER_REQUEST`
   - Point-in-time recovery: `envConfig.enablePointInTimeRecovery`

2. **GlucoseReadingsTable**
   - Changed from conditional billing mode to: `billingMode: dynamodb.BillingMode.PAY_PER_REQUEST`
   - Point-in-time recovery: `envConfig.enablePointInTimeRecovery`

3. **AIInsightsTable**
   - Changed from conditional billing mode to: `billingMode: dynamodb.BillingMode.PAY_PER_REQUEST`
   - Added point-in-time recovery: `envConfig.enablePointInTimeRecovery`

4. **ProviderAccessTable**
   - Changed from conditional billing mode to: `billingMode: dynamodb.BillingMode.PAY_PER_REQUEST`
   - Added point-in-time recovery: `envConfig.enablePointInTimeRecovery`

5. **AuditLogsTable**
   - Changed from conditional billing mode to: `billingMode: dynamodb.BillingMode.PAY_PER_REQUEST`
   - Added point-in-time recovery: `envConfig.enablePointInTimeRecovery`

### Tables Already Configured Correctly

4 tables were already properly configured:

1. **UsersTable** - PAY_PER_REQUEST + point-in-time recovery enabled
2. **FoodLogsTable** - PAY_PER_REQUEST + point-in-time recovery enabled
3. **UsageTrackingTable** - PAY_PER_REQUEST + point-in-time recovery explicitly disabled (correct for non-critical usage data)
4. **ActivityLogsTable** - PAY_PER_REQUEST + point-in-time recovery enabled

## Configuration Details

### Total Tables: 9

The DataStack contains 9 DynamoDB tables as specified in the task.

**All 9 Tables:**
1. UsersTable
2. UserProfilesTable
3. GlucoseReadingsTable
4. FoodLogsTable
5. UsageTrackingTable
6. ActivityLogsTable
7. AIInsightsTable
8. ProviderAccessTable
9. AuditLogsTable

**Note:** The UsersTable is defined in DataStack but is not currently referenced by other stacks. User authentication is primarily handled by AWS Cognito User Pool in the AuthStack. The UsersTable may be used for storing additional user metadata beyond what Cognito provides.

### Billing Mode
All tables now use: `dynamodb.BillingMode.PAY_PER_REQUEST` (on-demand capacity)

### Point-in-Time Recovery
- **8 tables** use: `pointInTimeRecovery: envConfig.enablePointInTimeRecovery`
  - This respects the environment configuration
  - Dev environment: disabled (false)
  - Staging/Prod environments: enabled (true)
  
- **1 table (UsageTrackingTable)** uses: `pointInTimeRecovery: false`
  - Explicitly disabled because usage tracking data is not critical
  - Correct per task requirements

## Verification

### Build Status
✅ TypeScript compilation successful: `npm run build`

### CDK Synthesis
⚠️ CDK synthesis encounters a pre-existing error in ApiStack (Authorizer must be attached to a RestApi)
- This error is unrelated to the DataStack changes
- The DataStack TypeScript code is correct and compiles successfully
- All 9 tables are properly configured in the source code
- The synthesis error prevents CloudFormation template generation, but does not affect the correctness of the DataStack configuration

### CloudFormation Template Verification
⚠️ Unable to verify CloudFormation template due to ApiStack synthesis error
- The TypeScript source code in `lib/stacks/data-stack.ts` is correct
- All 9 tables have `billingMode: dynamodb.BillingMode.PAY_PER_REQUEST`
- 8 tables have `pointInTimeRecovery: envConfig.enablePointInTimeRecovery`
- 1 table (UsageTrackingTable) has `pointInTimeRecovery: false`
- Once the ApiStack Authorizer issue is resolved, synthesis will succeed

## Acceptance Criteria Status

✅ All tables use PAY_PER_REQUEST billing mode (on-demand capacity)
✅ All tables except UsageTracking have point-in-time recovery enabled (when envConfig.enablePointInTimeRecovery is true)
✅ UsageTracking table has point-in-time recovery explicitly disabled
✅ Configuration is consistent across all tables
⚠️ CDK synthesis blocked by pre-existing ApiStack Authorizer error (unrelated to this task)

## Notes

1. **Environment-Aware Configuration**: Point-in-time recovery is controlled by `envConfig.enablePointInTimeRecovery`:
   - Dev: disabled (cost optimization)
   - Staging/Prod: enabled (data protection)

2. **UsageTracking Exception**: This table explicitly disables point-in-time recovery regardless of environment because usage metrics are not critical data.

3. **No UsersTable in DynamoDB**: The UsersTable is defined in DataStack but is not currently used by other stacks. User authentication is primarily handled by AWS Cognito User Pool in the AuthStack. The UsersTable may be intended for storing additional user metadata beyond what Cognito provides.

4. **Deprecation Warning**: CDK shows warnings about `pointInTimeRecovery` being deprecated in favor of `pointInTimeRecoverySpecification`. This is a CDK API deprecation and doesn't affect functionality. Can be addressed in a future refactoring task.

5. **ApiStack Synthesis Error**: There is a pre-existing error in ApiStack where the Authorizer must be attached to a RestApi. This prevents full CDK synthesis but does not affect the correctness of the DataStack configuration.

## Task Completion

Task 3.6 is complete. All DynamoDB tables in the DataStack now have consistent on-demand capacity configuration and appropriate point-in-time recovery settings.
