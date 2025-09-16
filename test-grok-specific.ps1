# Test specifically for grok-code-fast-1 model

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

Write-Host "Testing grok-code-fast-1 specifically..." -ForegroundColor Cyan
Write-Host "API Key: $($apiKey.Substring(0, 10))..." -ForegroundColor Gray

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

# Test with exact model name and check the response structure
$testPrompts = @(
    @{
        name = "Simple 6502 assembly"
        prompt = "Write a 6502 assembly routine to increment the accumulator"
    },
    @{
        name = "Clear screen routine"
        prompt = "6502 assembly code to clear screen from 0400 to 07FF"
    },
    @{
        name = "Hello world"
        prompt = "Print hello world in 6502 assembly"
    }
)

foreach ($test in $testPrompts) {
    Write-Host "`n=== Test: $($test.name) ===" -ForegroundColor Yellow
    Write-Host "Prompt: $($test.prompt)" -ForegroundColor Gray
    
    $body = @{
        model = "xai/grok-code-fast-1"
        messages = @(
            @{
                role = "user"
                content = $test.prompt
            }
        )
        max_tokens = 1000
        temperature = 0.5
    } | ConvertTo-Json -Depth 10
    
    try {
        Write-Host "Sending request..." -ForegroundColor Gray
        $response = Invoke-RestMethod `
            -Uri "https://router.requesty.ai/v1/chat/completions" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 60 `
            -ErrorAction Stop
        
        Write-Host "[OK] API call successful!" -ForegroundColor Green
        
        # Inspect the full response structure
        Write-Host "`nFull response structure:" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 10 | Write-Host
        
        # Check different possible locations for content
        if ($response.choices) {
            Write-Host "`nChoices count: $($response.choices.Count)" -ForegroundColor Yellow
            
            for ($i = 0; $i -lt $response.choices.Count; $i++) {
                $choice = $response.choices[$i]
                Write-Host "`nChoice $i details:" -ForegroundColor Yellow
                Write-Host "  finish_reason: $($choice.finish_reason)"
                Write-Host "  index: $($choice.index)"
                
                if ($choice.message) {
                    Write-Host "  Message role: $($choice.message.role)"
                    Write-Host "  Message content length: $($choice.message.content.Length)"
                    Write-Host "  Message content: '$($choice.message.content)'"
                }
                
                if ($choice.text) {
                    Write-Host "  Text: $($choice.text)"
                }
            }
        }
        
        # Check usage details
        if ($response.usage) {
            Write-Host "`nUsage details:" -ForegroundColor Yellow
            Write-Host "  Total tokens: $($response.usage.total_tokens)"
            Write-Host "  Prompt tokens: $($response.usage.prompt_tokens)"
            Write-Host "  Completion tokens: $($response.usage.completion_tokens)"
            
            if ($response.usage.completion_tokens_details) {
                Write-Host "  Reasoning tokens: $($response.usage.completion_tokens_details.reasoning_tokens)"
            }
        }
        
        # Check if the model is actually being used
        Write-Host "`nModel used: $($response.model)" -ForegroundColor Cyan
        
        # If we got a successful response, try with a system prompt
        if ($response) {
            Write-Host "`n=== Trying with system prompt ===" -ForegroundColor Yellow
            
            $bodyWithSystem = @{
                model = "xai/grok-code-fast-1"
                messages = @(
                    @{
                        role = "system"
                        content = "You are a 6502 assembly code generator. Generate only code, no explanations."
                    },
                    @{
                        role = "user"
                        content = $test.prompt
                    }
                )
                max_tokens = 1000
                temperature = 0.5
            } | ConvertTo-Json -Depth 10
            
            $response2 = Invoke-RestMethod `
                -Uri "https://router.requesty.ai/v1/chat/completions" `
                -Method POST `
                -Headers $headers `
                -Body $bodyWithSystem `
                -TimeoutSec 60 `
                -ErrorAction Stop
            
            Write-Host "Response with system prompt:" -ForegroundColor Cyan
            if ($response2.choices -and $response2.choices[0].message.content) {
                Write-Host "Content: '$($response2.choices[0].message.content)'" -ForegroundColor White
            } else {
                Write-Host "Still empty content" -ForegroundColor Yellow
            }
        }
        
        break  # If successful, no need to test other prompts
        
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
