# Requirements Document

## Introduction

The AI Diet & Meal Recommendation System is a comprehensive diabetes management application designed to help pre-diabetes, Type 1, and Type 2 diabetes patients manage their condition through intelligent food tracking, glucose monitoring, and personalized recommendations. The system leverages AWS serverless architecture and AI services (Amazon Bedrock, Rekognition, Transcribe) to provide real-time insights, predictive analytics, and actionable health guidance. The application operates on a freemium model with usage-based limits for free users and unlimited access for premium subscribers.

## Glossary

- **System**: The AI Diet & Meal Recommendation System
- **User**: A person with pre-diabetes, Type 1, or Type 2 diabetes using the application
- **Free_User**: A user with limited monthly AI feature usage (10-25 requests per feature)
- **Premium_User**: A user with unlimited AI feature usage (₹430/month subscription)
- **Blood_Glucose_Reading**: A measurement of blood glucose level in mg/dL or mmol/L
- **CGM_Device**: Continuous Glucose Monitor device that syncs glucose data
- **eA1C**: Estimated A1C calculated from glucose readings over time
- **TIR**: Time In Range - percentage of time glucose is within target range
- **AGP_Report**: Ambulatory Glucose Profile - visual glucose pattern report
- **Food_Image**: A photograph of food captured for AI recognition
- **Nutrient_Profile**: Nutritional information including carbs, protein, fat, calories, fiber
- **Glucose_Prediction**: AI-generated forecast of future glucose levels
- **Meal_Recommendation**: Personalized food suggestion based on user profile and glucose data
- **Pattern_Insight**: AI-identified trend or correlation in user's health data
- **Voice_Entry**: Audio input converted to text for data logging
- **Insulin_Dose**: Recommended insulin amount based on carb intake and glucose level
- **Activity_Log**: Record of exercise or physical activity
- **Healthcare_Provider**: Medical professional with authorized access to patient data
- **Usage_Limit**: Monthly quota for AI feature requests (free tier)
- **API_Gateway**: AWS service routing HTTP requests to Lambda functions
- **Lambda_Function**: AWS serverless compute function
- **DynamoDB_Table**: AWS NoSQL database table
- **S3_Bucket**: AWS object storage for images and files
- **Cognito_User_Pool**: AWS authentication and user management service
- **Bedrock_Model**: Amazon Bedrock AI model (Claude) for predictions and recommendations
- **Rekognition_Service**: Amazon AI service for image recognition
- **Transcribe_Service**: Amazon AI service for speech-to-text conversion
- **AWS_Textract**: Amazon AI service for extracting text and data from PDF documents
- **Bulk_Upload_File**: A PDF, Excel, or CSV file containing multiple glucose readings for import
- **File_Parser**: Component that extracts glucose readings from uploaded files
- **Glucose_Extract**: A glucose reading and timestamp extracted from a Bulk_Upload_File
- **Duplicate_Reading**: A glucose reading with the same user_id and timestamp as an existing entry

## Requirements

### Requirement 1: User Onboarding and Profile Management

**User Story:** As a new user, I want to create a profile with my diabetes type and health information, so that I can receive personalized recommendations.

#### Acceptance Criteria

1. THE System SHALL allow users to register using email and password through Cognito_User_Pool
2. WHEN a user registers, THE System SHALL collect diabetes type (pre-diabetes, Type 1, Type 2), age, weight, height, and target glucose range
3. THE System SHALL store user profile data in DynamoDB_Table with encryption at rest
4. THE System SHALL allow users to update their profile information at any time
5. WHEN a user updates their profile, THE System SHALL recalculate personalized recommendations based on new data
6. THE System SHALL assign Free_User tier by default upon registration

### Requirement 2: Blood Glucose Logging

**User Story:** As a user, I want to log my blood glucose readings manually or sync from my CGM device, so that I can track my glucose levels over time.

#### Acceptance Criteria

1. THE System SHALL allow users to manually enter Blood_Glucose_Reading with timestamp
2. THE System SHALL validate Blood_Glucose_Reading values are between 20 and 600 mg/dL
3. THE System SHALL support integration with CGM_Device through standard APIs (Dexcom, Freestyle Libre)
4. WHEN a CGM_Device syncs data, THE System SHALL automatically import Blood_Glucose_Reading entries
5. THE System SHALL store all Blood_Glucose_Reading entries in DynamoDB_Table with user_id and timestamp as composite key
6. THE System SHALL allow users to view their glucose history for any date range

### Requirement 2B: Bulk Glucose Upload from Files

**User Story:** As a user, I want to upload glucose readings in bulk from PDF, Excel, or CSV files exported from my glucose meter or CGM device, so that I can import historical data without manual entry.

#### Acceptance Criteria

1. THE System SHALL allow users to upload files in PDF, Excel (.xlsx, .xls), or CSV formats containing glucose readings
2. WHEN a file is uploaded, THE System SHALL store it temporarily in S3_Bucket with user_id prefix and 30-day TTL
3. THE System SHALL parse PDF files using AWS_Textract to extract glucose readings and timestamps
4. THE System SHALL parse Excel files using a spreadsheet parsing library to extract glucose readings and timestamps
5. THE System SHALL parse CSV files using a CSV parsing library to extract glucose readings and timestamps
6. WHEN parsing files, THE System SHALL use Bedrock_Model to intelligently extract glucose values and timestamps from unstructured data
7. THE System SHALL validate all extracted Blood_Glucose_Reading values are between 20 and 600 mg/dL
8. THE System SHALL validate all extracted timestamps are valid ISO 8601 dates
9. THE System SHALL display a preview of extracted readings with count and date range before importing
10. THE System SHALL allow users to review and edit individual extracted readings before final import
11. WHEN duplicate readings exist (same user_id and timestamp), THE System SHALL skip the duplicate and log it in the preview
12. IF a file contains invalid format or no glucose data, THEN THE System SHALL return a descriptive error message indicating the issue
13. THE System SHALL batch insert validated readings into DynamoDB_Table using batch write operations
14. THE System SHALL support common CGM export formats including Dexcom Clarity reports, Freestyle Libre reports, and generic glucose meter exports
15. WHERE Free_User tier, THE System SHALL enforce a limit of 5 file uploads per month
16. WHERE Premium_User tier, THE System SHALL allow unlimited file uploads per month
17. THE System SHALL display upload progress indicator during file processing
18. WHEN file processing completes, THE System SHALL display summary showing total readings extracted, imported, skipped, and any errors

### Requirement 3: Dashboard and Analytics

**User Story:** As a user, I want to see my glucose trends and analytics on a dashboard, so that I can understand my diabetes management progress.

#### Acceptance Criteria

1. THE System SHALL calculate and display eA1C based on average glucose over the past 90 days
2. THE System SHALL calculate and display TIR percentage for the past 7, 14, and 30 days
3. THE System SHALL generate AGP_Report showing glucose patterns across different times of day
4. THE System SHALL display daily, weekly, and monthly glucose trend charts
5. WHEN a user has fewer than 14 days of data, THE System SHALL display a message indicating insufficient data for full analytics
6. THE System SHALL refresh dashboard metrics within 5 seconds of new data entry

### Requirement 4: AI Food Recognition

**User Story:** As a user, I want to take a photo of my food and get automatic nutrient information, so that I can quickly log meals without manual entry.

#### Acceptance Criteria

1. THE System SHALL allow users to capture or upload Food_Image through the mobile app
2. WHEN a Food_Image is uploaded, THE System SHALL store it in S3_Bucket with user_id prefix
3. THE System SHALL send Food_Image to Rekognition_Service for food item identification
4. THE System SHALL send identified food items to Bedrock_Model for Nutrient_Profile estimation
5. THE System SHALL return Nutrient_Profile within 10 seconds of Food_Image upload
6. IF Rekognition_Service cannot identify food items with confidence above 60%, THEN THE System SHALL prompt user for manual food description
7. WHERE Free_User tier, THE System SHALL enforce a limit of 25 food recognition requests per month
8. WHERE Premium_User tier, THE System SHALL allow unlimited food recognition requests

### Requirement 5: Glucose Prediction Engine

**User Story:** As a user, I want to see predictions of my future glucose levels based on my meal and activity, so that I can make informed decisions about food and insulin.

#### Acceptance Criteria

1. WHEN a user logs a meal with Nutrient_Profile, THE System SHALL generate Glucose_Prediction for the next 2-4 hours
2. THE System SHALL use Bedrock_Model with user's historical glucose data, current reading, and meal nutrients to generate Glucose_Prediction
3. THE System SHALL display Glucose_Prediction as a time-series graph with confidence intervals
4. THE System SHALL update Glucose_Prediction when new Blood_Glucose_Reading entries are added
5. WHERE Free_User tier, THE System SHALL enforce a limit of 20 glucose prediction requests per month
6. WHERE Premium_User tier, THE System SHALL allow unlimited glucose prediction requests
7. WHEN a user has fewer than 7 days of glucose data, THE System SHALL display a message indicating predictions may be less accurate

### Requirement 6: Personalized Meal Recommendations

**User Story:** As a user, I want to receive meal suggestions based on my current glucose level and dietary preferences, so that I can maintain stable blood sugar.

#### Acceptance Criteria

1. THE System SHALL generate Meal_Recommendation based on current Blood_Glucose_Reading, time of day, and user preferences
2. THE System SHALL use Bedrock_Model to create Meal_Recommendation with complete Nutrient_Profile
3. THE System SHALL filter Meal_Recommendation based on user's dietary restrictions (vegetarian, vegan, gluten-free, etc.)
4. THE System SHALL include estimated glucose impact for each Meal_Recommendation
5. WHEN current Blood_Glucose_Reading is above target range, THE System SHALL prioritize low-carb Meal_Recommendation options
6. WHEN current Blood_Glucose_Reading is below target range, THE System SHALL prioritize moderate-carb Meal_Recommendation options
7. WHERE Free_User tier, THE System SHALL enforce a limit of 15 meal recommendation requests per month
8. WHERE Premium_User tier, THE System SHALL allow unlimited meal recommendation requests

### Requirement 7: Pattern Recognition and Insights

**User Story:** As a user, I want the system to identify patterns in my glucose data and provide actionable insights, so that I can improve my diabetes management.

#### Acceptance Criteria

1. THE System SHALL analyze Blood_Glucose_Reading entries weekly to identify Pattern_Insight
2. THE System SHALL use Bedrock_Model to detect correlations between meals, activities, and glucose trends
3. THE System SHALL generate Pattern_Insight such as "glucose spikes after breakfast" or "better control on exercise days"
4. THE System SHALL display Pattern_Insight on the dashboard with supporting data visualizations
5. THE System SHALL provide actionable recommendations for each Pattern_Insight
6. WHERE Free_User tier, THE System SHALL generate Pattern_Insight once per month
7. WHERE Premium_User tier, THE System SHALL generate Pattern_Insight weekly

### Requirement 8: Voice-Based Data Entry

**User Story:** As a user, I want to log my meals and glucose readings using voice commands, so that I can quickly enter data hands-free.

#### Acceptance Criteria

1. THE System SHALL allow users to record Voice_Entry through the mobile app
2. WHEN a Voice_Entry is recorded, THE System SHALL send audio to Transcribe_Service for conversion to text
3. THE System SHALL parse transcribed text to extract glucose values, food items, or activity descriptions
4. THE System SHALL use Bedrock_Model to interpret natural language and extract structured data
5. THE System SHALL confirm parsed data with the user before saving to DynamoDB_Table
6. IF Transcribe_Service cannot transcribe with confidence above 70%, THEN THE System SHALL prompt user to repeat or enter manually
7. WHERE Free_User tier, THE System SHALL enforce a limit of 20 voice entry requests per month
8. WHERE Premium_User tier, THE System SHALL allow unlimited voice entry requests

### Requirement 9: AI-Based Food Nutrient Analysis

**User Story:** As a user, I want to describe my food in text and get detailed nutrient information, so that I can log meals without taking photos.

#### Acceptance Criteria

1. THE System SHALL allow users to enter food descriptions as free text
2. WHEN a food description is submitted, THE System SHALL send it to Bedrock_Model for Nutrient_Profile estimation
3. THE System SHALL return Nutrient_Profile including carbs, protein, fat, calories, and fiber within 5 seconds
4. THE System SHALL allow users to adjust portion sizes and recalculate Nutrient_Profile
5. THE System SHALL store food descriptions and Nutrient_Profile in DynamoDB_Table for future reference
6. WHERE Free_User tier, THE System SHALL enforce a limit of 25 text-based nutrient analysis requests per month
7. WHERE Premium_User tier, THE System SHALL allow unlimited text-based nutrient analysis requests

### Requirement 10: Insulin Dose Recommendation

**User Story:** As a Type 1 diabetes user, I want to receive insulin dose suggestions based on my meal and current glucose, so that I can dose accurately.

#### Acceptance Criteria

1. WHERE user profile indicates Type 1 diabetes, THE System SHALL provide Insulin_Dose recommendations
2. WHEN a user logs a meal, THE System SHALL calculate Insulin_Dose based on carb count and insulin-to-carb ratio
3. THE System SHALL adjust Insulin_Dose based on current Blood_Glucose_Reading and correction factor
4. THE System SHALL use Bedrock_Model to refine Insulin_Dose based on historical response patterns
5. THE System SHALL display Insulin_Dose with clear disclaimer that it is a suggestion and user should consult healthcare provider
6. THE System SHALL allow users to configure their insulin-to-carb ratio and correction factor in profile settings
7. WHERE Free_User tier, THE System SHALL enforce a limit of 20 insulin dose recommendation requests per month
8. WHERE Premium_User tier, THE System SHALL allow unlimited insulin dose recommendation requests

### Requirement 11: Exercise and Activity Integration

**User Story:** As a user, I want to log my exercise and see how it affects my glucose levels, so that I can optimize my activity routine.

#### Acceptance Criteria

1. THE System SHALL allow users to log Activity_Log with type (walking, running, cycling, etc.), duration, and intensity
2. THE System SHALL store Activity_Log entries in DynamoDB_Table with timestamp
3. THE System SHALL correlate Activity_Log with Blood_Glucose_Reading to show glucose impact
4. THE System SHALL use Bedrock_Model to generate insights about exercise effects on glucose control
5. THE System SHALL adjust Glucose_Prediction when Activity_Log is entered
6. THE System SHALL support integration with fitness trackers (Fitbit, Apple Health, Google Fit) for automatic Activity_Log import

### Requirement 12: Healthcare Provider Integration

**User Story:** As a user, I want to share my glucose data and reports with my healthcare provider, so that they can monitor my progress remotely.

#### Acceptance Criteria

1. THE System SHALL allow users to invite Healthcare_Provider by email
2. WHEN a Healthcare_Provider accepts invitation, THE System SHALL grant read-only access to user's data
3. THE System SHALL allow Healthcare_Provider to view Blood_Glucose_Reading history, AGP_Report, and Pattern_Insight
4. THE System SHALL generate exportable PDF reports with glucose trends and analytics
5. THE System SHALL allow users to revoke Healthcare_Provider access at any time
6. THE System SHALL log all Healthcare_Provider access for audit purposes in DynamoDB_Table

### Requirement 13: Security and Compliance

**User Story:** As a user, I want my health data to be secure and private, so that I can trust the system with sensitive information.

#### Acceptance Criteria

1. THE System SHALL encrypt all data at rest in DynamoDB_Table and S3_Bucket using AWS KMS
2. THE System SHALL encrypt all data in transit using TLS 1.2 or higher
3. THE System SHALL implement HIPAA-compliant access controls and audit logging
4. THE System SHALL authenticate all API requests through Cognito_User_Pool with JWT tokens
5. THE System SHALL expire user sessions after 60 minutes of inactivity
6. THE System SHALL implement rate limiting on API_Gateway to prevent abuse (100 requests per minute per user)
7. THE System SHALL perform input validation on all Lambda_Function inputs to prevent injection attacks

### Requirement 14: Notifications and Alerts

**User Story:** As a user, I want to receive alerts when my glucose is out of range or when I need to log data, so that I can stay on top of my diabetes management.

#### Acceptance Criteria

1. WHEN Blood_Glucose_Reading is above user's target range, THE System SHALL send a high glucose alert via Amazon SNS
2. WHEN Blood_Glucose_Reading is below user's target range, THE System SHALL send a low glucose alert via Amazon SNS
3. THE System SHALL send daily reminders to log meals and glucose if no data entered for 24 hours
4. THE System SHALL allow users to configure notification preferences (email, SMS, push notification)
5. THE System SHALL allow users to set custom alert thresholds for high and low glucose
6. THE System SHALL send weekly summary reports via Amazon SES with key metrics and Pattern_Insight

### Requirement 15: Freemium Access Control

**User Story:** As a system administrator, I want to enforce usage limits for free users and track premium subscriptions, so that the business model is sustainable.

#### Acceptance Criteria

1. THE System SHALL track monthly usage counts for each AI feature per user in DynamoDB_Table
2. WHEN Free_User reaches Usage_Limit for any feature, THE System SHALL display upgrade prompt and block further requests
3. THE System SHALL reset Usage_Limit counters on the first day of each month
4. THE System SHALL allow users to upgrade to Premium_User tier through payment integration
5. WHEN a user upgrades to Premium_User, THE System SHALL immediately remove all Usage_Limit restrictions
6. THE System SHALL display remaining usage counts for each AI feature in the user dashboard
7. THE System SHALL send notification when Free_User reaches 80% of Usage_Limit for any feature

### Requirement 16: Food Image and Text Parser with Pretty Printer

**User Story:** As a developer, I want to parse food descriptions and images into structured nutrient data with round-trip capability, so that the system can reliably process and display food information.

#### Acceptance Criteria

1. WHEN a food description or Food_Image is provided, THE Food_Parser SHALL parse it into a structured Food_Entry object with Nutrient_Profile
2. WHEN an invalid food description is provided, THE Food_Parser SHALL return a descriptive error message
3. THE Food_Pretty_Printer SHALL format Food_Entry objects back into human-readable text descriptions
4. FOR ALL valid Food_Entry objects, parsing then printing then parsing SHALL produce an equivalent Food_Entry object (round-trip property)
5. THE Food_Parser SHALL extract food name, portion size, and preparation method from text descriptions
6. THE Food_Parser SHALL handle multiple food items in a single description (e.g., "chicken breast with rice and broccoli")

## Usage Limits Summary

| Feature | Free User Limit | Premium User Limit |
|---------|----------------|-------------------|
| Food Recognition (Image) | 25/month | Unlimited |
| Glucose Prediction | 20/month | Unlimited |
| Meal Recommendations | 15/month | Unlimited |
| Voice Entry | 20/month | Unlimited |
| Text-Based Nutrient Analysis | 25/month | Unlimited |
| Insulin Dose Recommendations | 20/month | Unlimited |
| Pattern Insights | 1/month | Weekly |
| Bulk Glucose File Uploads | 5/month | Unlimited |

## Non-Functional Requirements

### Performance
- API response time for non-AI features: < 1 second
- AI feature response time: < 10 seconds
- Dashboard load time: < 3 seconds
- Support for 10,000 concurrent users

### Scalability
- DynamoDB_Table configured with on-demand capacity
- Lambda_Function with auto-scaling enabled
- S3_Bucket with lifecycle policies for cost optimization

### Availability
- System uptime: 99.5% monthly
- Graceful degradation when AI services are unavailable

### Usability
- Mobile-first responsive design
- Support for English and Hindi languages
- Accessibility compliance with WCAG 2.1 Level AA guidelines
