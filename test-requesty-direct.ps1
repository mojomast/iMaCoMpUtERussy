# Direct Requesty API Test
# This script tests the Requesty API directly to debug issues

$env = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        $env[$matches[1]] = $matches[2]
    }
}

$apiKey = $env["REQUESTY_API_KEY"]
$model = "xai/grok-code-fast-1"  # Note: no "requesty/" prefix

if (-not $apiKey) {
    Write-Host "Error: No Requesty API key found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Testing Requesty API directly..." -ForegroundColor Cyan
Write-Host "API Key: $($apiKey.Substring(0, 10))..." -ForegroundColor Gray
Write-Host "Model: $model" -ForegroundColor Gray

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

$body = @{
    model = $model
    messages = @(
        @{
            role = "system"
            content = "You are an expert 6502 assembly programmer. Generate clean, well-commented code."
        },
        @{
            role = "user"
            content = "Write a simple 6502 assembly routine to clear the screen (fill memory from `$0400 to `$07FF with spaces)"
        }
    )
    temperature = 0.7
    max_tokens = 500
} | ConvertTo-Json -Depth 10

Write-Host "`nRequest body:" -ForegroundColor Yellow
Write-Host $body

Write-Host "`nSending request to Requesty API..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "https://router.requesty.ai/v1/chat/completions" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "`n[OK] API call successful!" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
    if ($response.choices -and $response.choices[0].message.content) {
        Write-Host "`n=== Generated Code ===" -ForegroundColor Cyan
        Write-Host $response.choices[0].message.content -ForegroundColor White
    }
} catch {
    Write-Host "`n[FAIL] API call failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "`nResponse body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}
