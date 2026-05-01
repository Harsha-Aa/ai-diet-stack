# Development Context for AI Diet & Meal Recommendation System

## Project Overview
AI-powered diabetes management platform with glucose tracking, food logging with AI nutrient analysis, and dashboard analytics.

## Current Status (as of 2024)

### ✅ Completed Tasks
- **Tasks 1-8**: Complete infrastructure (CDK, Auth, Database, Storage, Glucose logging, Analytics)
- **Task 9.1-9.6**: Food logging with Bedrock AI integration, pretty printer, portion adjustment
- All core backend APIs are functional

### 🚧 In Progress
- Task 9.8: Property-based tests for food parser (just created)
- Tasks 9.9, 9.10: Additional property-based tests (pending)

### ❌ Not Started
- Tasks 10-14: Usage tracking, API Gateway config, error handling, testing infrastructure
- Tasks 15-40: Advanced features (skipping per constraints)
- React web frontend (not in task list, needs to be created)

## Key Constraints
- **Focus**: Working web application MVP (React), NOT mobile app
- **Skip**: Tasks 15, 20, 21, 24, 26, 40 (advanced features)
- **Skip**: Tasks 37, 38 (heavy testing)
- **Skip**: Tasks 27-33 (React Native mobile app)
- **Priority**: Simplicity, scalability, working MVP

## Architecture Summary

### Backend Stack
- **Infrastructure**: AWS CDK with TypeScript
- **Compute**: Lambda functions (Node.js 20.x)
- **Database**: DynamoDB (on-demand capacity)
- **Storage**: S3 with KMS encryption
- **Auth**: Cognito User Pool with JWT
- **AI**: Amazon Bedrock (Claude 3 Haiku)
- **API**: API Gateway REST API

### Key APIs Implemented
1. **Auth**: POST /auth/register, POST /auth/login, GET /auth/profile, PUT /auth/profile
2. **Glucose**: POST /glucose/readings, GET /glucose/readings
3. **Analytics**: GET /analytics/dashboard (eA1C, TIR, trends)
4. **Food**: POST /food/analyze-text (AI nutrient analysis)

### Project Structure
```
├── lib/stacks/          # CDK infrastructure stacks
├── src/                 # Lambda function source code
│   ├── auth/           # Authentication handlers
│   ├── glucose/        # Glucose logging handlers
│   ├── analytics/      # Dashboard analytics
│   ├── food/           # Food logging with AI
│   └── shared/         # Shared utilities
├── test/               # Unit and integration tests
├── config/             # Environment configuration
└── .kiro/specs/        # Spec files (requirements, design, tasks)
```

## Important Files to Review

### Spec Files
- `.kiro/specs/ai-diet-meal-recommendation-system/requirements.md` - All requirements
- `.kiro/specs/ai-diet-meal-recommendation-system/design.md` - System design
- `.kiro/specs/ai-diet-meal-recommendation-system/tasks.md` - Task list with status

### Key Implementation Files
- `src/food/analyzeText.ts` - Food AI analysis Lambda
- `src/food/bedrockService.ts` - Bedrock integration
- `src/food/foodPrettyPrinter.ts` - Food text formatter
- `src/food/portionAdjustment.ts` - Portion scaling utilities
- `src/analytics/calculators.ts` - eA1C, TIR calculations
- `src/analytics/dashboard.ts` - Dashboard Lambda

### Infrastructure Files
- `lib/stacks/auth-stack.ts` - Cognito setup
- `lib/stacks/data-stack.ts` - DynamoDB tables
- `lib/stacks/storage-stack.ts` - S3 buckets
- `lib/stacks/api-stack.ts` - API Gateway
- `lib/stacks/compute-stack.ts` - Lambda functions

## Next Steps

### Immediate (Current System)
1. Complete Tasks 9.8, 9.9, 9.10 (property-based tests)
2. Commit and push to GitHub
3. Document any remaining context

### On Other System
1. Clone the repository
2. Read this file (DEVELOPMENT_CONTEXT.md)
3. Read NEXT_TASKS.md for specific instructions
4. Continue with remaining backend tasks or start frontend

## Environment Setup

### Prerequisites
- Node.js 20.x
- AWS CDK CLI: `npm install -g aws-cdk`
- AWS credentials configured
- TypeScript: `npm install -g typescript`

### Installation
```bash
git clone https://github.com/YOUR_USERNAME/gluco-guide.git
cd gluco-guide
npm install
```

### Build
```bash
npm run build
```

### Test
```bash
npm test
```

### Deploy
```bash
cdk deploy --all --profile YOUR_AWS_PROFILE
```

## AI Assistant Context

### When Working with AI on Another System
1. **Share this file** with the AI first
2. **Share NEXT_TASKS.md** for specific work items
3. **Share relevant spec files** from `.kiro/specs/`
4. **Reference task summaries** in `TASK_*.md` files

### Key Context to Provide
- "We're building an AI-powered diabetes management system"
- "Backend is AWS serverless (CDK, Lambda, DynamoDB, Bedrock)"
- "Focus on web application MVP, not mobile"
- "Current status: Core backend done, need to complete remaining tasks"

## Testing Strategy
- Unit tests with Jest
- Property-based tests with fast-check
- Integration tests with mocked AWS services
- Target: 80% code coverage

## Deployment Strategy
- Multi-environment: dev, staging, prod
- Environment-specific configuration in `config/environments/`
- CI/CD with GitHub Actions (configured in `.github/workflows/`)

## Important Notes
- All Lambda functions use `withAuth` middleware for authentication
- DynamoDB tables use composite keys (user_id + timestamp/id)
- S3 buckets have lifecycle policies (Intelligent-Tiering after 30 days)
- Bedrock uses Claude 3 Haiku for cost-effectiveness
- CORS is configured for web applications (allowOrigins: '*' in dev)

## Contact & Resources
- Spec files: `.kiro/specs/ai-diet-meal-recommendation-system/`
- Task summaries: `TASK_*.md` files in root
- AWS CDK docs: https://docs.aws.amazon.com/cdk/
- Bedrock docs: https://docs.aws.amazon.com/bedrock/
