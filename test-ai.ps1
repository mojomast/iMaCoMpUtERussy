# iMaCoMpUtERussy AI Test Script
# Tests the AI configuration and MCP server integration

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Configuration Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
$envPath = Join-Path $PSScriptRoot ".env"
if (!(Test-Path $envPath)) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please run .\setup-ai.ps1 first to configure API keys." -ForegroundColor Yellow
    exit 1
}

# Load environment variables from .env file
Write-Host "Loading configuration..." -ForegroundColor Yellow
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        if ($value -and $value -ne '' -and !$value.Contains('your-')) {
            [Environment]::SetEnvironmentVariable($key, $value, [EnvironmentVariableTarget]::Process)
        }
    }
}

# Check which providers are configured
$providers = @()
if ($env:OPENAI_API_KEY -and !$env:OPENAI_API_KEY.Contains('your-')) {
    $providers += "OpenAI"
    Write-Host "[OK] OpenAI configured" -ForegroundColor Green
}
if ($env:ANTHROPIC_API_KEY -and !$env:ANTHROPIC_API_KEY.Contains('your-')) {
    $providers += "Anthropic"
    Write-Host "[OK] Anthropic configured" -ForegroundColor Green
}
if ($env:OPENROUTER_API_KEY -and !$env:OPENROUTER_API_KEY.Contains('your-')) {
    $providers += "OpenRouter"
    Write-Host "[OK] OpenRouter configured" -ForegroundColor Green
}
if ($env:REQUESTY_API_KEY -and !$env:REQUESTY_API_KEY.Contains('your-')) {
    $providers += "Requesty.ai"
    Write-Host "[OK] Requesty.ai configured" -ForegroundColor Green
}

if ($providers.Count -eq 0) {
    Write-Host ""
    Write-Host "ERROR: No AI providers configured!" -ForegroundColor Red
    Write-Host "Please run .\setup-ai.ps1 to configure at least one API key." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Default model: $env:DEFAULT_MODEL" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if MCP server is running
Write-Host "=== Test 1: MCP Server Health Check ===" -ForegroundColor Yellow
$headers = @{ "X-API-Key" = "default-api-key-change-in-production" }
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/health" -Method GET -ErrorAction Stop
    $health = $response.Content | ConvertFrom-Json
    Write-Host "[OK] MCP server is running" -ForegroundColor Green
    Write-Host "  Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "[FAIL] MCP server is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Starting MCP server..." -ForegroundColor Yellow
    
    # Try to start the server
    $serverScript = Join-Path $PSScriptRoot "server\mcp_server.js"
    if (Test-Path $serverScript) {
        Start-Process -FilePath "node" -ArgumentList $serverScript -WindowStyle Minimized
        Write-Host "Waiting for server to start..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        # Try again
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/health" -Method GET -ErrorAction Stop
            Write-Host "[OK] MCP server started successfully" -ForegroundColor Green
        } catch {
            Write-Host "[FAIL] Failed to start MCP server" -ForegroundColor Red
            Write-Host "Please start it manually with: npm start" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Please start the MCP server with: npm start" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

# Test 2: Test AI generation
Write-Host "=== Test 2: AI Generation Test ===" -ForegroundColor Yellow
Write-Host "Testing AI generation with a simple assembly code request..." -ForegroundColor Gray

$headers = @{ 
    "X-API-Key" = "default-api-key-change-in-production"
    "Content-Type" = "application/json"
}

$testPrompt = @{
    prompt = "Generate a simple 6502 assembly program that stores the value 42 in memory location 0x00 and then halts"
    task = "generation"
    options = @{
        model = "auto"
        maxTokens = 500
    }
} | ConvertTo-Json

try {
    Write-Host "Sending request to AI endpoint..." -ForegroundColor Gray
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/mcp/ai/generate" `
        -Method POST `
        -Headers $headers `
        -Body $testPrompt `
        -ErrorAction Stop
    
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "[OK] AI generation successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Model used: $($result.data.model)" -ForegroundColor Cyan
        if ($result.data.actualProvider) {
            Write-Host "Provider: $($result.data.actualProvider)" -ForegroundColor Cyan
        }
        Write-Host "Tokens used: $($result.data.tokensUsed)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Generated content:" -ForegroundColor Yellow
        Write-Host "----------------------------------------" -ForegroundColor DarkGray
        $content = $result.data.content
        # Truncate if too long
        if ($content.Length -gt 500) {
            Write-Host $content.Substring(0, 500) -ForegroundColor White
            Write-Host "... (truncated)" -ForegroundColor DarkGray
        } else {
            Write-Host $content -ForegroundColor White
        }
        Write-Host "----------------------------------------" -ForegroundColor DarkGray
    } else {
        Write-Host "[FAIL] AI generation failed" -ForegroundColor Red
        Write-Host "Error: $($result.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "[FAIL] Failed to call AI endpoint" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody -ForegroundColor Gray
    }
}

Write-Host ""

# Test 3: Test queue functionality
Write-Host "=== Test 3: Queue Management Test ===" -ForegroundColor Yellow
Write-Host "Adding a task to the AI queue..." -ForegroundColor Gray

$queueTask = @{
    prompt = "Create a bubble sort algorithm in 6502 assembly"
    type = "generation"
    priority = "normal"
    metadata = @{
        source = "test-script"
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/mcp/queue/add" `
        -Method POST `
        -Headers $headers `
        -Body $queueTask `
        -ErrorAction Stop
    
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "[OK] Task added to queue successfully" -ForegroundColor Green
        Write-Host "  Task ID: $($result.data.taskId)" -ForegroundColor Gray
        Write-Host "  Priority: $($result.data.priority)" -ForegroundColor Gray
        
        # List queue items
        Write-Host ""
        Write-Host "Checking queue status..." -ForegroundColor Gray
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/mcp/queue/list?limit=5" `
            -Method GET `
            -Headers @{ "X-API-Key" = "default-api-key-change-in-production" } `
            -ErrorAction Stop
        
        $queueList = $response.Content | ConvertFrom-Json
        Write-Host "[OK] Queue contains $($queueList.data.count) task(s)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Failed to add task to queue" -ForegroundColor Red
    }
} catch {
    Write-Host "[FAIL] Queue management test failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""

# Test 4: Check available models
Write-Host "=== Test 4: Available Models ===" -ForegroundColor Yellow

$modelsRequest = @{
    task = "generation"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/mcp/ai/models" `
        -Method POST `
        -Headers $headers `
        -Body $modelsRequest `
        -ErrorAction Stop
    
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "[OK] Retrieved available models" -ForegroundColor Green
        Write-Host ""
        Write-Host "Available models:" -ForegroundColor Cyan
        foreach ($model in $result.data.availableModels) {
            Write-Host "  - $($model.name) [$($model.provider)]" -ForegroundColor White
            if ($model.capabilities) {
                Write-Host "    Capabilities: $($model.capabilities -join ', ')" -ForegroundColor Gray
            }
        }
        
        if ($result.data.configStatus) {
            Write-Host ""
            Write-Host "Provider status:" -ForegroundColor Cyan
            $result.data.configStatus.PSObject.Properties | ForEach-Object {
                $status = if ($_.Value -eq "configured") { "[OK]" } else { "[X]" }
                $color = if ($_.Value -eq "configured") { "Green" } else { "DarkGray" }
                Write-Host "  $status $($_.Name): $($_.Value)" -ForegroundColor $color
            }
        }
    }
} catch {
    Write-Host "[FAIL] Failed to retrieve models" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "AI configuration test completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. If tests passed, your AI is ready to use!" -ForegroundColor White
Write-Host "  2. Try the emulator with AI assistance" -ForegroundColor White
Write-Host "  3. Use the MCP API endpoints for AI operations" -ForegroundColor White
Write-Host ""
