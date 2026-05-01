# AI Diet Tracker - Frontend

React TypeScript frontend for the AI Diet & Glucose Tracking application.

## 🚀 Quick Start

```bash
# Install dependencies (already done)
npm install

# Start development server
npm start

# Build for production
npm run build
```

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Login, Register
│   ├── dashboard/      # Dashboard with charts
│   ├── glucose/        # Glucose logging
│   ├── food/           # Food analyzer
│   ├── profile/        # User profile
│   └── layout/         # App layout with navigation
├── context/            # React Context (Auth)
├── services/           # API services
│   ├── api.ts          # Axios configuration
│   ├── authService.ts  # Authentication API
│   ├── glucoseService.ts # Glucose API
│   ├── foodService.ts  # Food analysis API
│   └── mockData.ts     # Mock data for development
├── hooks/              # Custom React hooks
├── types/              # TypeScript types
└── utils/              # Utility functions
```

## 🎨 Features Implemented

### ✅ Day 1-2 (Complete)
- [x] React app with TypeScript setup
- [x] Material-UI components installed
- [x] Project structure created
- [x] API service layer with mock data
- [x] AuthContext for authentication
- [x] React Router setup

### ✅ Day 3-4 (Complete)
- [x] Login page
- [x] Register page
- [x] Profile page
- [x] Dashboard with charts (eA1C, TIR, glucose trends)
- [x] Responsive layout with navigation

### ✅ Day 5 (Complete)
- [x] Glucose entry form
- [x] Glucose history list
- [x] Food analyzer component

## 🔧 Configuration

### Mock Data vs Real API

The app currently uses **mock data** for development. To switch to real API:

1. Update `.env` file:
```env
REACT_APP_API_URL=https://your-api-gateway-url.amazonaws.com/prod
REACT_APP_USE_MOCK=false
```

2. Update service files to set `USE_MOCK = false`:
   - `src/services/authService.ts`
   - `src/services/glucoseService.ts`
   - `src/services/foodService.ts`

## 📦 Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Material-UI (MUI)** - UI components
- **React Router** - Navigation
- **Axios** - HTTP client
- **React Query** - Data fetching
- **Recharts** - Charts and graphs

## 🎯 Next Steps

### Day 6-7: Backend Integration
- [ ] Connect to deployed backend API
- [ ] Test authentication flow
- [ ] Test glucose logging
- [ ] Test food analyzer
- [ ] Add loading states
- [ ] Add error handling

### Day 8-10: Advanced Features
- [ ] Glucose prediction charts
- [ ] Meal recommendation cards
- [ ] Pattern insights display
- [ ] Activity logging UI
- [ ] Provider sharing UI

### Day 11-14: Polish & Deploy
- [ ] Component testing
- [ ] E2E testing with Cypress
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Deploy to S3 + CloudFront or Amplify

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## 🚀 Deployment

### Option 1: AWS S3 + CloudFront
```bash
npm run build
aws s3 sync build/ s3://your-bucket-name
```

### Option 2: AWS Amplify
```bash
npm install -g @aws-amplify/cli
amplify init
amplify add hosting
amplify publish
```

## 📝 Notes

- All components use Material-UI for consistent styling
- Mock data is in `src/services/mockData.ts`
- Authentication state is managed via React Context
- Charts use Recharts library
- Responsive design works on mobile and desktop

## 🔐 Environment Variables

Create a `.env` file based on `.env.example`:

```env
REACT_APP_API_URL=https://your-api-url.com
REACT_APP_USE_MOCK=false
```

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill process on port 3000
npx kill-port 3000
```

### Module not found
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📚 Resources

- [React Documentation](https://react.dev)
- [Material-UI Documentation](https://mui.com)
- [React Router Documentation](https://reactrouter.com)
- [TypeScript Documentation](https://www.typescriptlang.org)
