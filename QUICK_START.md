# Quick Start Guide - Multi-System Development

## 🚀 Quick Setup on New System

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/gluco-guide.git
cd gluco-guide
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Read Context Files (IN THIS ORDER)
1. **DEVELOPMENT_CONTEXT.md** - Understand the project
2. **NEXT_TASKS.md** - Know what to do next
3. **.kiro/specs/ai-diet-meal-recommendation-system/tasks.md** - See task status

### 4. Verify Setup
```bash
# Build project
npm run build

# Run tests
npm test

# Check task status
cat .kiro/specs/ai-diet-meal-recommendation-system/tasks.md | grep "\[x\]" | wc -l
```

## 📋 Current Status (Quick View)

### ✅ Complete
- Infrastructure (CDK, Auth, Database, Storage)
- Glucose logging APIs
- Dashboard analytics (eA1C, TIR)
- Food logging with AI (Bedrock)
- Food pretty printer
- Portion adjustment

### 🚧 In Progress
- Property-based tests (Task 9.8-9.10)

### ❌ Not Started
- React web frontend
- Usage tracking (optional)
- Deployment to production

## 🔄 Git Workflow

### Before Switching Systems
```bash
git add .
git commit -m "feat: describe what you completed"
git push origin main
```

### On New System
```bash
git pull origin main
# Start working...
```

## 🤖 AI Assistant Quick Context

**Copy-paste this to AI on new system:**

```
I'm working on an AI-powered diabetes management system (GlucoGuide).

Project: AWS serverless backend (CDK, Lambda, DynamoDB, Bedrock) + React web frontend
Status: Backend mostly complete, need to work on [SPECIFY TASK]

Please read:
1. DEVELOPMENT_CONTEXT.md - Full context
2. NEXT_TASKS.md - What's next
3. .kiro/specs/ai-diet-meal-recommendation-system/requirements.md - Requirements

Current task: [SPECIFY WHAT YOU WANT TO DO]
```

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `DEVELOPMENT_CONTEXT.md` | Full project context |
| `NEXT_TASKS.md` | Task distribution guide |
| `.kiro/specs/*/tasks.md` | Task list with status |
| `.kiro/specs/*/requirements.md` | All requirements |
| `.kiro/specs/*/design.md` | System design |
| `TASK_*.md` | Individual task summaries |

## 🛠️ Common Commands

```bash
# Build
npm run build

# Test
npm test

# Test specific file
npm test -- test/food/analyzeText.test.ts --run

# Deploy (requires AWS credentials)
cdk deploy --all --profile YOUR_PROFILE

# Check TypeScript errors
npx tsc --noEmit

# Format code
npm run format
```

## 🎯 Recommended Next Steps

### Option A: Complete Backend (System 1)
1. Finish Tasks 9.8-9.10 (property-based tests)
2. Commit and push
3. Switch to System 2 for frontend

### Option B: Start Frontend (System 2)
1. Create React app in `frontend/` directory
2. Implement authentication UI
3. Implement dashboard UI
4. Connect to backend APIs

## ⚠️ Important Notes

- **Always pull before starting work**: `git pull origin main`
- **Always push after completing work**: `git push origin main`
- **Read context files first** before asking AI for help
- **Update NEXT_TASKS.md** if you change the plan
- **Create TASK_*.md summaries** for completed tasks

## 🔗 Quick Links

- **Spec Files**: `.kiro/specs/ai-diet-meal-recommendation-system/`
- **Source Code**: `src/`
- **Tests**: `test/`
- **Infrastructure**: `lib/stacks/`
- **Config**: `config/`

## 📞 Need Help?

1. Check `DEVELOPMENT_CONTEXT.md` for detailed info
2. Check `NEXT_TASKS.md` for task details
3. Check task summaries (`TASK_*.md`) for implementation details
4. Check spec files for requirements and design

## ✅ Pre-Push Checklist

Before pushing to GitHub:
- [ ] Code builds: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Context files updated (if needed)
- [ ] Task status updated in `.kiro/specs/*/tasks.md`
- [ ] Commit message is descriptive

## 🎉 You're Ready!

Now you can safely work across multiple systems without losing context.
