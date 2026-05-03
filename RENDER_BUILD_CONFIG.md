# Render Build Configuration

## Current Issue

The deployed server is still running the old mock version instead of the new AWS-integrated version.

**Symptoms**:
- Health endpoint returns `"environment": "local"` instead of `"production"`
- Health endpoint doesn't show `"aws_integration": "enabled"`
- Health endpoint doesn't show `"version": "2.0.0"`

---

## Required Render Configuration

### In Render Dashboard

1. Go to https://dashboard.render.com/
2. Click on **ai-diet-api** service
3. Click on **Settings** tab
4. Scroll to **Build & Deploy** section

### Build Command
```
npm install
```

**Why**: This installs all dependencies including TypeScript. The `postinstall` script in package.json will automatically run `npm run build` to compile TypeScript.

### Start Command
```
npm start
```

**Why**: This runs `node server.js` which uses the AWS-integrated version.

### Root Directory
```
local-server
```

**Why**: The server code is in the `local-server` folder.

---

## Verify Configuration

After updating the configuration:

1. Click **Save Changes**
2. Click **Manual Deploy** → **Deploy latest commit**
3. Wait 2-3 minutes for deployment
4. Check logs for these messages:
   ```
   > postinstall
   > npm run build
   
   > build
   > tsc
   
   ✅ AWS SDK configured for region: us-east-1
   ✅ AWS credentials: Configured
   Server running on port 3001
   AWS Integration: ENABLED
   ```

---

## Test After Deployment

```powershell
curl https://ai-diet-api.onrender.com/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-03T...",
  "environment": "production",
  "aws_integration": "enabled",
  "version": "2.0.0"
}
```

---

## Alternative: Use render.yaml

If manual configuration doesn't work, create a `render.yaml` file in the project root:

```yaml
services:
  - type: web
    name: ai-diet-api
    env: node
    region: oregon
    plan: free
    rootDir: local-server
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: AWS_REGION
        value: us-east-1
      - key: ENABLE_AWS_SERVICES
        value: true
      - key: USE_MOCK_DATA
        value: false
```

Then commit and push:
```bash
git add render.yaml
git commit -m "Add Render configuration file"
git push origin main
```

---

## Troubleshooting

### Issue: Build fails with "tsc: command not found"
**Solution**: TypeScript is in dependencies, not devDependencies. Check package.json.

### Issue: "Cannot find module './dist/services/auth.service'"
**Solution**: The postinstall script didn't run. Check build logs.

### Issue: Still showing old version after deployment
**Solution**: 
1. Clear Render cache: Settings → Clear build cache
2. Manual deploy: Manual Deploy → Clear build cache & deploy

### Issue: "AWS credentials not configured"
**Solution**: Check environment variables in Render dashboard.

---

## Current package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node server.js",
    "postinstall": "npm run build"
  }
}
```

**Flow**:
1. Render runs `npm install`
2. `postinstall` hook runs `npm run build`
3. `npm run build` runs `tsc` (compiles TypeScript)
4. Compiled JS files are in `dist/` folder
5. Render runs `npm start`
6. `npm start` runs `node server.js`
7. `server.js` imports from `dist/` folder

---

## Manual Deployment Steps

If automatic deployment isn't working:

1. **Clear Build Cache**:
   - Settings → Clear build cache
   
2. **Manual Deploy**:
   - Manual Deploy → Clear build cache & deploy
   
3. **Watch Logs**:
   - Logs tab → Look for TypeScript compilation
   
4. **Verify Environment Variables**:
   - Environment tab → Check all AWS variables are set

---

## Expected Build Log Output

```
==> Cloning from https://github.com/Harsha-Aa/ai-diet-stack
==> Checking out commit 9a628c9...
==> Using Node.js version 24.14.1
==> Running build command 'npm install'...

added 398 packages

> local-server@1.0.0 postinstall
> npm run build

> local-server@1.0.0 build
> tsc

==> Build successful 🎉
==> Deploying...
==> Running 'npm start'

> local-server@1.0.0 start
> node server.js

✅ AWS SDK configured for region: us-east-1
✅ AWS credentials: Configured
Server running on port 3001
Environment: production
AWS Region: us-east-1
AWS Integration: ENABLED
```

---

## Next Steps

1. Check Render dashboard configuration
2. Update Build Command and Start Command if needed
3. Clear build cache
4. Manual deploy
5. Run test script: `./test-deployment.ps1`

---

**Status**: Waiting for correct Render configuration  
**Action Required**: Update Render build settings  
**Expected Time**: 5 minutes to configure + 3 minutes to deploy
