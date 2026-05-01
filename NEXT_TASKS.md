# Next Tasks - Work Distribution Guide

## Current Session Summary
**Date**: 2024
**System**: System 1 (Current)
**Work Completed**: Tasks 1-8 (complete), Tasks 9.1-9.6 (complete), Task 9.8 (in progress)

## Immediate Next Steps (System 1 - Current Session)

### Task 9.8: Property-Based Tests for Food Parser ✅ STARTED
**Status**: File created, needs to be run and verified
**File**: `test/food/foodParser.property.test.ts`
**Action**: Run tests and verify they pass
```bash
npm test -- test/food/foodParser.property.test.ts --run
```

### Task 9.9: Property-Based Tests for Multi-Item Extraction (Property 10)
**Status**: Not started
**Description**: Test that food parser correctly extracts multiple food items from a single description
**Estimated Time**: 30-45 minutes
**Files to Create**: `test/food/foodParser.multiItem.property.test.ts`

### Task 9.10: Property-Based Tests for Error Handling (Property 9)
**Status**: Not started
**Description**: Test that food parser handles invalid inputs gracefully
**Estimated Time**: 30-45 minutes
**Files to Create**: `test/food/foodParser.errorHandling.property.test.ts`

## Work Distribution Strategy

### Option 1: Complete Backend First (Recommended)
**System 1 (Current)**: Finish Tasks 9.8-9.10, then commit
**System 2 (Other)**: Start React web frontend

### Option 2: Split Backend Work
**System 1 (Current)**: Finish Tasks 9.8-9.10
**System 2 (Other)**: Work on Tasks 10-14 (usage tracking, error handling, etc.)

### Option 3: Parallel Development
**System 1 (Current)**: Backend tasks
**System 2 (Other)**: Frontend development

## Recommended Approach: Option 1

### Phase 1: System 1 (Current) - Complete Backend
1. ✅ Finish Task 9.8 (verify tests pass)
2. ⬜ Complete Task 9.9 (multi-item extraction tests)
3. ⬜ Complete Task 9.10 (error handling tests)
4. ⬜ Run full test suite: `npm test`
5. ⬜ Build project: `npm run build`
6. ⬜ Commit and push to GitHub

### Phase 2: System 2 (Other) - React Web Frontend
1. ⬜ Clone repository
2. ⬜ Read DEVELOPMENT_CONTEXT.md
3. ⬜ Create React web application
4. ⬜ Implement authentication UI
5. ⬜ Implement glucose logging UI
6. ⬜ Implement dashboard UI
7. ⬜ Implement food logging UI
8. ⬜ Connect to backend APIs

## Task Details

### Task 9.9: Multi-Item Extraction Property Tests
**Property 10**: For any food description containing multiple items, the parser SHALL extract all items separately with individual nutrient profiles.

**Test Cases**:
- Generate descriptions with 2-5 food items
- Verify all items are extracted
- Verify each item has its own nutrient profile
- Verify total nutrients equal sum of individual items

**Example**:
```typescript
// Input: "chicken breast with rice and broccoli"
// Expected: 3 separate food items
// Property: items.length >= 2
// Property: totalNutrients = sum(item.nutrients)
```

### Task 9.10: Error Handling Property Tests
**Property 9**: For any invalid food description, the parser SHALL return a descriptive error message without crashing.

**Test Cases**:
- Empty strings
- Very long strings (>2000 chars)
- Special characters only
- Non-food words
- Ambiguous descriptions

**Example**:
```typescript
// Input: ""
// Expected: ValidationError with message
// Property: error.message.length > 0
// Property: error.code === 'VALIDATION_ERROR'
```

## Git Workflow for Multi-System Development

### Before Switching Systems

**On System 1 (Current):**
```bash
# 1. Commit all work
git add .
git commit -m "feat: complete tasks 9.1-9.8 - food logging with AI"

# 2. Push to GitHub
git push origin main

# 3. Create a branch for next work (optional)
git checkout -b feature/property-based-tests
git push -u origin feature/property-based-tests
```

### On System 2 (Other)

**Initial Setup:**
```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/gluco-guide.git
cd gluco-guide

# 2. Install dependencies
npm install

# 3. Verify build works
npm run build

# 4. Run tests to verify everything works
npm test
```

**Start Working:**
```bash
# Option A: Continue on main branch
git checkout main
git pull origin main

# Option B: Create feature branch
git checkout -b feature/react-frontend
```

**After Completing Work:**
```bash
# Commit and push
git add .
git commit -m "feat: implement React web frontend"
git push origin feature/react-frontend

# Create pull request on GitHub (optional)
```

### Syncing Between Systems

**If working on same branch:**
```bash
# Before starting work on any system
git pull origin main

# After completing work
git push origin main
```

**If using feature branches:**
```bash
# System 1 works on: feature/backend-tasks
# System 2 works on: feature/frontend

# Merge when ready:
git checkout main
git merge feature/backend-tasks
git merge feature/frontend
git push origin main
```

## Context Preservation Checklist

### Before Switching Systems ✅
- [ ] All code is committed
- [ ] All code is pushed to GitHub
- [ ] DEVELOPMENT_CONTEXT.md is up to date
- [ ] NEXT_TASKS.md is up to date
- [ ] Task summaries (TASK_*.md) are created
- [ ] .kiro/specs/tasks.md has correct task status
- [ ] Build succeeds: `npm run build`
- [ ] Tests pass: `npm test`

### On New System ✅
- [ ] Repository cloned
- [ ] Dependencies installed: `npm install`
- [ ] Read DEVELOPMENT_CONTEXT.md
- [ ] Read NEXT_TASKS.md
- [ ] Read relevant spec files
- [ ] Build succeeds: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Understand current task status

## AI Assistant Instructions

### When Starting on System 2

**Provide this context to AI:**
```
I'm working on an AI-powered diabetes management system. 
I've been working on System 1 and now switching to System 2.

Please read these files to understand the context:
1. DEVELOPMENT_CONTEXT.md - Overall project context
2. NEXT_TASKS.md - What needs to be done next
3. .kiro/specs/ai-diet-meal-recommendation-system/requirements.md - Requirements
4. .kiro/specs/ai-diet-meal-recommendation-system/tasks.md - Task list

Current status: Backend is mostly complete (Tasks 1-9.8 done).
Next: [Specify what you want to work on]
```

### Useful Commands for AI

**Check current status:**
```bash
# See what tasks are complete
cat .kiro/specs/ai-diet-meal-recommendation-system/tasks.md | grep "\[x\]"

# See what tasks are in progress
cat .kiro/specs/ai-diet-meal-recommendation-system/tasks.md | grep "\[-\]"

# See what tasks are pending
cat .kiro/specs/ai-diet-meal-recommendation-system/tasks.md | grep "\[ \]"
```

**Run specific tests:**
```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/food/analyzeText.test.ts --run

# Run tests with coverage
npm test -- --coverage
```

## Frontend Development Guide (For System 2)

### React Web App Structure
```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProfileForm.tsx
│   │   ├── glucose/
│   │   │   ├── GlucoseEntryForm.tsx
│   │   │   ├── GlucoseHistory.tsx
│   │   │   └── GlucoseChart.tsx
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── EA1CCard.tsx
│   │   │   ├── TIRCard.tsx
│   │   │   └── TrendChart.tsx
│   │   ├── food/
│   │   │   ├── FoodAnalyzer.tsx
│   │   │   ├── FoodHistory.tsx
│   │   │   └── NutrientDisplay.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Layout.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── storage.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useGlucose.ts
│   │   └── useFood.ts
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── App.tsx
│   └── index.tsx
├── package.json
└── tsconfig.json
```

### Frontend Tech Stack (Recommended)
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: React Context + React Query
- **UI Library**: Material-UI (MUI) or Tailwind CSS
- **Charts**: Recharts or Chart.js
- **HTTP Client**: Axios
- **Form Handling**: React Hook Form
- **Validation**: Zod (same as backend)

### API Integration
```typescript
// src/services/api.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url';

export const api = {
  auth: {
    register: (data) => axios.post(`${API_BASE_URL}/auth/register`, data),
    login: (data) => axios.post(`${API_BASE_URL}/auth/login`, data),
    getProfile: () => axios.get(`${API_BASE_URL}/auth/profile`),
  },
  glucose: {
    create: (data) => axios.post(`${API_BASE_URL}/glucose/readings`, data),
    list: (params) => axios.get(`${API_BASE_URL}/glucose/readings`, { params }),
  },
  analytics: {
    dashboard: (period) => axios.get(`${API_BASE_URL}/analytics/dashboard`, { params: { period } }),
  },
  food: {
    analyze: (data) => axios.post(`${API_BASE_URL}/food/analyze-text`, data),
  },
};
```

## Troubleshooting

### If Tests Fail on System 2
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Jest cache
npm test -- --clearCache

# Run tests again
npm test
```

### If Build Fails on System 2
```bash
# Check Node version (should be 20.x)
node --version

# Rebuild TypeScript
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

### If Git Conflicts Occur
```bash
# Pull latest changes
git pull origin main

# If conflicts, resolve manually then:
git add .
git commit -m "fix: resolve merge conflicts"
git push origin main
```

## Summary

**Current System (System 1)**: Complete Tasks 9.8-9.10, commit, push
**Other System (System 2)**: Clone repo, read context files, start frontend or remaining backend tasks

**Key Files to Sync**:
- DEVELOPMENT_CONTEXT.md (this file)
- NEXT_TASKS.md (this file)
- .kiro/specs/ai-diet-meal-recommendation-system/tasks.md (task status)
- All TASK_*.md summary files

**Communication Between Systems**: Use Git commits and these markdown files to maintain context.
