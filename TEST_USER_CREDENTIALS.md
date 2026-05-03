# Test User Credentials

## Quick Login

Use these credentials to login to the application without registering:

**Email:** `test@example.com`  
**Password:** `Test123!`

## User Details

- **User ID:** `user-test-123`
- **Diabetes Type:** Type 2
- **Age:** 30 years
- **Weight:** 70 kg
- **Height:** 170 cm
- **BMI:** 24.2
- **Subscription Tier:** Free
- **Target Glucose Range:** 70-180 mg/dL

## Sample Data

The test user has **20 sample glucose readings** spanning the last 10 days (one reading every 12 hours) with values ranging from 90-170 mg/dL.

This allows you to:
- ✅ See the dashboard with real data
- ✅ View glucose trends and analytics
- ✅ Test eA1C and Time In Range calculations
- ✅ Test all AI features (meal recommendations, pattern analysis)

## Alternative: Register a New User

You can also register a new account using the registration form. All fields are required:
- Email
- Password
- Age
- Weight (kg)
- Height (cm)
- Diabetes Type (Type 1, Type 2, Pre-diabetes, or Gestational)

## Backend Status

- **Backend URL:** https://ai-diet-api.onrender.com
- **Health Check:** https://ai-diet-api.onrender.com/health
- **Deployment:** Automatic via GitHub push (takes 2-3 minutes)

## Next Steps After Login

1. **Dashboard** - View your glucose analytics and trends
2. **Glucose Logging** - Add new glucose readings
3. **Food Analysis** - Log meals and get nutrient information
4. **Meal Recommendations** - Get AI-powered meal suggestions
5. **Pattern Analysis** - Discover patterns in your glucose data

---

**Note:** This is mock data for development/testing. In production, you would use real AWS Cognito authentication and DynamoDB storage.
