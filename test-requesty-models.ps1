# Test which models are available on Requesty

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

Write-Host "Testing available models on Requesty..." -ForegroundColor Cyan
Write-Host "API Key: $($apiKey.Substring(0, 10))..." -ForegroundColor Gray

# Test various model formats
$modelsToTest = @(
    # OpenAI models
    "openai/gpt-3.5-turbo",
    "openai/gpt-4",
    "openai/gpt-4-turbo",
    
    # Anthropic models
    "anthropic/claude-3-haiku",
    "anthropic/claude-3-sonnet",
    "anthropic/claude-3-opus",
    "anthropic/claude-2",
    
    # Google models
    "google/gemini-pro",
    "google/gemini-flash",
    
    # Meta models
    "meta/llama-3-8b",
    "meta/llama-3-70b",
    
    # Mistral models
    "mistral/mistral-7b",
    "mistral/mixtral-8x7b",
    
    # xAI models (different formats)
    "xai/grok-2",
    "xai/grok-1",
    "grok/grok-code-fast-1",
    "xai/grok-code-fast",
    
    # Perplexity models
    "perplexity/llama-3-sonar-small",
    "perplexity/llama-3-sonar-large"
)

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

$workingModels = @()
$failedModels = @()

foreach ($model in $modelsToTest) {
    Write-Host "`nTesting model: $model" -ForegroundColor Yellow
    
    $body = @{
        model = $model
        messages = @(
            @{
                role = "user"
                content = "Say 'Hello from $model' and nothing else"
            }
        )
        max_tokens = 50
        temperature = 0.3
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod `
            -Uri "https://router.requesty.ai/v1/chat/completions" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        if ($response.choices -and $response.choices[0].message.content) {
            $content = $response.choices[0].message.content
            if ($content.Length -gt 0) {
                Write-Host "  [OK] Working! Response: $content" -ForegroundColor Green
                $workingModels += @{
                    model = $model
                    actualModel = $response.model
                    response = $content.Substring(0, [Math]::Min(50, $content.Length))
                }
            } else {
                Write-Host "  [EMPTY] Model responded but with empty content" -ForegroundColor Yellow
                $failedModels += @{
                    model = $model
                    error = "Empty response"
                }
            }
        }
    } catch {
        $errorMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $reader.BaseStream.Position = 0
                $reader.DiscardBufferedData()
                $responseBody = $reader.ReadToEnd() | ConvertFrom-Json
                $errorMsg = $responseBody.error.message
            } catch {}
        }
        Write-Host "  [FAIL] $errorMsg" -ForegroundColor Red
        $failedModels += @{
            model = $model
            error = $errorMsg
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SUMMARY OF MODEL TESTING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($workingModels.Count -gt 0) {
    Write-Host "`nWORKING MODELS ($($workingModels.Count)):" -ForegroundColor Green
    foreach ($model in $workingModels) {
        Write-Host "  - $($model.model)" -ForegroundColor Green
        Write-Host "    Actual: $($model.actualModel)" -ForegroundColor Gray
        Write-Host "    Response: $($model.response)" -ForegroundColor Gray
    }
} else {
    Write-Host "`nNo working models found!" -ForegroundColor Red
}

Write-Host "`nFAILED MODELS ($($failedModels.Count)):" -ForegroundColor Red
$failedModels | Group-Object -Property error | ForEach-Object {
    Write-Host "`n  Error: $($_.Name)" -ForegroundColor Yellow
    $_.Group | ForEach-Object {
        Write-Host "    - $($_.model)" -ForegroundColor Gray
    }
}

if ($workingModels.Count -gt 0) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "RECOMMENDED CONFIGURATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    $bestModel = $workingModels[0]
    Write-Host "`nBest working model: $($bestModel.model)" -ForegroundColor Green
    Write-Host "Add this to your .env file:" -ForegroundColor Yellow
    Write-Host "  AI_DEFAULT_MODEL=$($bestModel.model)" -ForegroundColor White
}
