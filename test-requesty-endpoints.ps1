# Test different Requesty API endpoints
# Checking which endpoint format is correct

$env = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        $env[$matches[1]] = $matches[2]
    }
}

$apiKey = $env["REQUESTY_API_KEY"]
if (-not $apiKey) {
    Write-Host "Error: No Requesty API key found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Testing Requesty API endpoints..." -ForegroundColor Cyan
Write-Host "API Key: $($apiKey.Substring(0, 10))..." -ForegroundColor Gray

# Test different possible endpoints
$endpoints = @(
    "https://api.requesty.ai/v1/chat/completions",
    "https://api.requesty.ai/api/v1/chat/completions",
    "https://requesty.ai/api/v1/chat/completions",
    "https://api.requesty.ai/chat/completions",
    "https://api.requesty.ai/v1/completions"
)

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

# Simple test payload
$body = @{
    model = "xai/grok-code-fast-1"
    messages = @(
        @{
            role = "user"
            content = "Say hello"
        }
    )
    max_tokens = 50
} | ConvertTo-Json -Depth 10

foreach ($endpoint in $endpoints) {
    Write-Host "`nTesting: $endpoint" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest `
            -Uri $endpoint `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 5 `
            -ErrorAction Stop
        
        Write-Host "  [OK] Status: $($response.StatusCode)" -ForegroundColor Green
        
        # Try to parse the response
        $content = $response.Content | ConvertFrom-Json
        if ($content.choices) {
            Write-Host "  Response: $($content.choices[0].message.content)" -ForegroundColor Cyan
        }
        
        Write-Host "`nFound working endpoint: $endpoint" -ForegroundColor Green
        break
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  [FAIL] Status: $statusCode - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Testing with different model formats ===" -ForegroundColor Cyan

# Try different model name formats
$modelFormats = @(
    "xai/grok-code-fast-1",
    "grok-code-fast-1",
    "requesty/xai/grok-code-fast-1",
    "xai:grok-code-fast-1",
    "grok-code-fast"
)

# Use the most likely endpoint
$endpoint = "https://api.requesty.ai/v1/chat/completions"

foreach ($model in $modelFormats) {
    Write-Host "`nTrying model format: $model" -ForegroundColor Yellow
    
    $testBody = @{
        model = $model
        messages = @(
            @{
                role = "user"
                content = "Say hello"
            }
        )
        max_tokens = 50
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-WebRequest `
            -Uri $endpoint `
            -Method POST `
            -Headers $headers `
            -Body $testBody `
            -TimeoutSec 5 `
            -ErrorAction Stop
        
        Write-Host "  [OK] Model format works!" -ForegroundColor Green
        $content = $response.Content | ConvertFrom-Json
        if ($content.choices) {
            Write-Host "  Response: $($content.choices[0].message.content)" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "  [FAIL] $($_.Exception.Message)" -ForegroundColor Red
    }
}
