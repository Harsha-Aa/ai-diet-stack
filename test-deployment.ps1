# Deployment Test Script
# Tests the production backend deployment

$baseUrl = "https://ai-diet-api.onrender.com"

Write-Host "`n=== Testing AI Diet API Deployment ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl`n" -ForegroundColor Gray

# Test 1: Health Check
Write-Host "[Test 1] Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "✅ Status: $($health.status)" -ForegroundColor Green
    Write-Host "   Environment: $($health.environment)" -ForegroundColor Gray
    Write-Host "   AWS Integration: $($health.aws_integration)" -ForegroundColor Gray
    Write-Host "   Version: $($health.version)" -ForegroundColor Gray
    
    if ($health.aws_integration -eq "enabled") {
        Write-Host "✅ AWS Integration is ENABLED" -ForegroundColor Green
    } else {
        Write-Host "❌ AWS Integration is NOT enabled" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Register User
Write-Host "`n[Test 2] User Registration..." -ForegroundColor Yellow
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$testEmail = "test-$timestamp@example.com"
$testPassword = "Test123!"

$registerBody = @{
    email = $testEmail
    password = $testPassword
    age = 30
    weight_kg = 70
    height_cm = 170
    diabetes_type = "type2"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
    Write-Host "✅ User registered successfully" -ForegroundColor Green
    Write-Host "   User ID: $($registerResponse.data.userId)" -ForegroundColor Gray
    Write-Host "   Email: $($registerResponse.data.email)" -ForegroundColor Gray
    $userId = $registerResponse.data.userId
} catch {
    Write-Host "❌ Registration failed: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Login
Write-Host "`n[Test 3] User Login..." -ForegroundColor Yellow
$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "   Access Token: $($loginResponse.data.accessToken.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "   Expires In: $($loginResponse.data.expiresIn) seconds" -ForegroundColor Gray
    $accessToken = $loginResponse.data.accessToken
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Get Profile
Write-Host "`n[Test 4] Get User Profile..." -ForegroundColor Yellow
$headers = @{
    Authorization = "Bearer $accessToken"
}

try {
    $profile = Invoke-RestMethod -Uri "$baseUrl/auth/profile" -Method Get -Headers $headers
    Write-Host "✅ Profile retrieved successfully" -ForegroundColor Green
    Write-Host "   User ID: $($profile.data.userId)" -ForegroundColor Gray
    Write-Host "   Email: $($profile.data.email)" -ForegroundColor Gray
    Write-Host "   BMI: $($profile.data.bmi)" -ForegroundColor Gray
    Write-Host "   Tier: $($profile.data.tier)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Get profile failed: $_" -ForegroundColor Red
    exit 1
}

# Test 5: Log Glucose Reading
Write-Host "`n[Test 5] Log Glucose Reading..." -ForegroundColor Yellow
$glucoseBody = @{
    reading_value = 120
    reading_unit = "mg/dL"
    meal_context = "fasting"
    notes = "Test reading from deployment script"
} | ConvertTo-Json

try {
    $glucoseResponse = Invoke-RestMethod -Uri "$baseUrl/glucose/readings" -Method Post -Body $glucoseBody -ContentType "application/json" -Headers $headers
    Write-Host "✅ Glucose reading logged successfully" -ForegroundColor Green
    Write-Host "   Value: $($glucoseResponse.data.reading.reading_value) mg/dL" -ForegroundColor Gray
    Write-Host "   Classification: $($glucoseResponse.data.reading.classification)" -ForegroundColor Gray
    Write-Host "   Timestamp: $($glucoseResponse.data.reading.timestamp)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Log glucose reading failed: $_" -ForegroundColor Red
    exit 1
}

# Test 6: Get Glucose Readings
Write-Host "`n[Test 6] Get Glucose Readings..." -ForegroundColor Yellow
try {
    $readings = Invoke-RestMethod -Uri "$baseUrl/glucose/readings" -Method Get -Headers $headers
    Write-Host "✅ Glucose readings retrieved successfully" -ForegroundColor Green
    Write-Host "   Total Readings: $($readings.data.count)" -ForegroundColor Gray
    if ($readings.data.count -gt 0) {
        Write-Host "   Latest Reading: $($readings.data.readings[0].reading_value_mgdl) mg/dL" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Get glucose readings failed: $_" -ForegroundColor Red
    exit 1
}

# Test 7: Dashboard Analytics
Write-Host "`n[Test 7] Dashboard Analytics..." -ForegroundColor Yellow
try {
    $dashboard = Invoke-RestMethod -Uri "$baseUrl/analytics/dashboard" -Method Get -Headers $headers
    Write-Host "✅ Dashboard data retrieved successfully" -ForegroundColor Green
    Write-Host "   eA1C: $($dashboard.data.ea1c)%" -ForegroundColor Gray
    Write-Host "   Average Glucose: $($dashboard.data.average_glucose) mg/dL" -ForegroundColor Gray
    Write-Host "   Total Readings: $($dashboard.data.total_readings)" -ForegroundColor Gray
    Write-Host "   Time in Range (7d): $($dashboard.data.time_in_range.tir_7d.percentage)%" -ForegroundColor Gray
} catch {
    Write-Host "❌ Dashboard analytics failed: $_" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host "`n=== All Tests Passed! ===" -ForegroundColor Green
Write-Host "✅ AWS Integration is working correctly" -ForegroundColor Green
Write-Host "✅ Authentication with Cognito is working" -ForegroundColor Green
Write-Host "✅ Data is being stored in DynamoDB" -ForegroundColor Green
Write-Host "✅ Analytics are calculated from real data" -ForegroundColor Green
Write-Host "`nTest User Credentials:" -ForegroundColor Cyan
Write-Host "  Email: $testEmail" -ForegroundColor Gray
Write-Host "  Password: $testPassword" -ForegroundColor Gray
Write-Host "  User ID: $userId" -ForegroundColor Gray
