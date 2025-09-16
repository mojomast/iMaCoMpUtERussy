# Improved Requesty API Test with better parameters

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

Write-Host "Testing Requesty API with improved parameters..." -ForegroundColor Cyan
Write-Host "API Key: $($apiKey.Substring(0, 10))..." -ForegroundColor Gray

# Test different model configurations
$testConfigs = @(
    @{
        name = "xAI Grok Code Fast (higher max_tokens)"
        model = "xai/grok-code-fast-1"
        max_tokens = 2000
        temperature = 0.5
    },
    @{
        name = "xAI Grok Beta"
        model = "xai/grok-beta"
        max_tokens = 1000
        temperature = 0.7
    },
    @{
        name = "Auto (let Requesty choose)"
        model = $null  # Will be omitted from request
        max_tokens = 1000
        temperature = 0.7
    }
)

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

foreach ($config in $testConfigs) {
    Write-Host "`n=== Testing: $($config.name) ===" -ForegroundColor Yellow
    
    $body = @{
        messages = @(
            @{
                role = "user"
                content = "Write a simple 6502 assembly routine to clear the screen by filling memory from `$0400 to `$07FF with the space character (0x20). Include comments explaining each step."
            }
        )
        temperature = $config.temperature
        max_tokens = $config.max_tokens
    }
    
    # Add model only if specified
    if ($config.model) {
        $body.model = $config.model
    }
    
    $jsonBody = $body | ConvertTo-Json -Depth 10
    
    Write-Host "Request:" -ForegroundColor Gray
    Write-Host "  Model: $(if ($config.model) { $config.model } else { 'auto' })"
    Write-Host "  Max tokens: $($config.max_tokens)"
    Write-Host "  Temperature: $($config.temperature)"
    
    try {
        $response = Invoke-RestMethod `
            -Uri "https://router.requesty.ai/v1/chat/completions" `
            -Method POST `
            -Headers $headers `
            -Body $jsonBody `
            -TimeoutSec 30 `
            -ErrorAction Stop
        
        Write-Host "`n[OK] API call successful!" -ForegroundColor Green
        Write-Host "Used model: $($response.model)" -ForegroundColor Cyan
        Write-Host "Tokens used: $($response.usage.total_tokens)" -ForegroundColor Gray
        Write-Host "Cost: `$$($response.usage.cost)" -ForegroundColor Gray
        
        if ($response.choices -and $response.choices[0].message.content) {
            $content = $response.choices[0].message.content
            if ($content.Length -gt 0) {
                Write-Host "`n=== Generated Code ===" -ForegroundColor Cyan
                Write-Host $content -ForegroundColor White
                Write-Host "`n[SUCCESS] Model generated valid output!" -ForegroundColor Green
                break  # Found a working configuration
            } else {
                Write-Host "[WARNING] Response was empty" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WARNING] No content in response" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[FAIL] API call failed: $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $reader.BaseStream.Position = 0
            $reader.DiscardBufferedData()
            $responseBody = $reader.ReadToEnd()
            Write-Host "Error details: $responseBody" -ForegroundColor Gray
        }
    }
}

Write-Host "`n=== Testing with simple prompt ===" -ForegroundColor Cyan

# Try a very simple prompt
$simpleBody = @{
    model = "xai/grok-beta"
    messages = @(
        @{
            role = "user"
            content = "Write hello world in 6502 assembly"
        }
    )
    max_tokens = 500
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod `
        -Uri "https://router.requesty.ai/v1/chat/completions" `
        -Method POST `
        -Headers $headers `
        -Body $simpleBody `
        -ErrorAction Stop
    
    if ($response.choices -and $response.choices[0].message.content) {
        Write-Host "`n[OK] Simple prompt worked!" -ForegroundColor Green
        Write-Host "Response: $($response.choices[0].message.content)" -ForegroundColor White
    }
} catch {
    Write-Host "[FAIL] Simple prompt failed: $_" -ForegroundColor Red
}
