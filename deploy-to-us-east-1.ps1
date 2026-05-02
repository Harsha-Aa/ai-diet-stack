# Deploy CDK stacks to us-east-1
$env:CDK_DEFAULT_REGION = 'us-east-1'
$env:CDK_DEFAULT_ACCOUNT = '407902217908'

Write-Host "Deploying all stacks to us-east-1..." -ForegroundColor Green
npx cdk deploy --all --require-approval never --outputs-file cdk-outputs.json

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
    Write-Host "`nOutputs saved to: cdk-outputs.json" -ForegroundColor Cyan
    
    if (Test-Path "cdk-outputs.json") {
        Write-Host "`nReading outputs..." -ForegroundColor Cyan
        Get-Content "cdk-outputs.json" | ConvertFrom-Json | ConvertTo-Json -Depth 10
    }
} else {
    Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
    exit 1
}
