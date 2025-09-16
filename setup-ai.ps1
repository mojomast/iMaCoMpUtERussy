# iMaCoMpUtERussy AI Setup Script
# This script helps configure API keys for AI functionality

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  iMaCoMpUtERussy AI Setup Wizard" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file already exists
$envPath = Join-Path $PSScriptRoot ".env"
$envExamplePath = Join-Path $PSScriptRoot ".env.example"

if (Test-Path $envPath) {
    Write-Host "Existing .env file detected." -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to update it? (y/n)"
    if ($overwrite -ne 'y') {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit
    }
    # Backup existing .env
    $backupPath = "$envPath.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $envPath $backupPath
    Write-Host "Backup created: $backupPath" -ForegroundColor Green
}

# Copy template if .env doesn't exist
if (!(Test-Path $envPath) -and (Test-Path $envExamplePath)) {
    Copy-Item $envExamplePath $envPath
    Write-Host "Created .env file from template." -ForegroundColor Green
}

# Function to validate API key format
function Test-APIKey {
    param(
        [string]$Key,
        [string]$Provider
    )
    
    switch ($Provider) {
        "OpenAI" {
            return $Key -match '^sk-[a-zA-Z0-9]{48}$' -or $Key -match '^sk-proj-[a-zA-Z0-9]{48,}$'
        }
        "Anthropic" {
            return $Key -match '^sk-ant-[a-zA-Z0-9-]{40,}$'
        }
        default {
            return $Key.Length -gt 10
        }
    }
}

# Read current values if they exist
$currentEnv = @{}
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $currentEnv[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
}

Write-Host ""
Write-Host "=== API Key Configuration ===" -ForegroundColor Cyan

# Prompt for OpenAI API Key
Write-Host ""
Write-Host "OpenAI API Key:" -ForegroundColor Yellow
Write-Host "Get your key from: https://platform.openai.com/api-keys" -ForegroundColor Gray
$openaiKey = Read-Host "Enter your OpenAI API key (or press Enter to skip)"

if ($openaiKey -and $openaiKey.Length -gt 0) {
    if (Test-APIKey -Key $openaiKey -Provider "OpenAI") {
        Write-Host "OpenAI API key format looks valid" -ForegroundColor Green
    } else {
        Write-Host "Warning: OpenAI key format may be invalid" -ForegroundColor Yellow
    }
}

# Prompt for Anthropic API Key
Write-Host ""
Write-Host "Anthropic (Claude) API Key:" -ForegroundColor Yellow
Write-Host "Get your key from: https://console.anthropic.com/account/keys" -ForegroundColor Gray
$anthropicKey = Read-Host "Enter your Anthropic API key (or press Enter to skip)"

if ($anthropicKey -and $anthropicKey.Length -gt 0) {
    if (Test-APIKey -Key $anthropicKey -Provider "Anthropic") {
        Write-Host "Anthropic API key format looks valid" -ForegroundColor Green
    } else {
        Write-Host "Warning: Anthropic key format may be invalid" -ForegroundColor Yellow
    }
}

# Prompt for OpenRouter API Key
Write-Host ""
Write-Host "OpenRouter API Key:" -ForegroundColor Yellow
Write-Host "Get your key from: https://openrouter.ai/keys" -ForegroundColor Gray
Write-Host "(Provides access to multiple models including GPT-4, Claude, Gemini, and more)" -ForegroundColor DarkGray
$openrouterKey = Read-Host "Enter your OpenRouter API key (or press Enter to skip)"

if ($openrouterKey -and $openrouterKey.Length -gt 0) {
    if ($openrouterKey -match '^sk-or-v1-[a-zA-Z0-9]{40,}$' -or $openrouterKey.Length -gt 20) {
        Write-Host "OpenRouter API key format looks valid" -ForegroundColor Green
    } else {
        Write-Host "Warning: OpenRouter key format may be invalid" -ForegroundColor Yellow
    }
}

# Prompt for Requesty.ai API Key
Write-Host ""
Write-Host "Requesty.ai API Key:" -ForegroundColor Yellow
Write-Host "Get your key from: https://requesty.ai" -ForegroundColor Gray
Write-Host "(Unified LLM Gateway with intelligent routing and cost optimization)" -ForegroundColor DarkGray
$requestyKey = Read-Host "Enter your Requesty.ai API key (or press Enter to skip)"

$projectId = ""
if ($requestyKey -and $requestyKey.Length -gt 0) {
    if ($requestyKey -match '^rq_[a-zA-Z0-9]{20,}$' -or $requestyKey.Length -gt 15) {
        Write-Host "Requesty API key format looks valid" -ForegroundColor Green
        # Also prompt for Project ID if using Requesty
        $projectId = Read-Host "Enter your Requesty Project ID (optional, press Enter to skip)"
        if ($projectId) {
            Write-Host "Project ID set: $projectId" -ForegroundColor Green
        }
    } else {
        Write-Host "Warning: Requesty key format may be invalid" -ForegroundColor Yellow
    }
}

# Check if at least one key was provided
if (!$openaiKey -and !$anthropicKey -and !$openrouterKey -and !$requestyKey) {
    Write-Host ""
    Write-Host "No API keys provided. AI features will not work." -ForegroundColor Red
    Write-Host "You can run this script again later to add keys." -ForegroundColor Yellow
} else {
    # Update .env file
    $envContent = Get-Content $envExamplePath
    
    # Replace API keys
    if ($openaiKey) {
        $envContent = $envContent -replace 'OPENAI_API_KEY=.*', "OPENAI_API_KEY=$openaiKey"
    }
    if ($anthropicKey) {
        $envContent = $envContent -replace 'ANTHROPIC_API_KEY=.*', "ANTHROPIC_API_KEY=$anthropicKey"
    }
    if ($openrouterKey) {
        $envContent = $envContent -replace 'OPENROUTER_API_KEY=.*', "OPENROUTER_API_KEY=$openrouterKey"
    }
    if ($requestyKey) {
        $envContent = $envContent -replace 'REQUESTY_API_KEY=.*', "REQUESTY_API_KEY=$requestyKey"
        if ($projectId) {
            $envContent = $envContent -replace 'REQUESTY_PROJECT_ID=.*', "REQUESTY_PROJECT_ID=$projectId"
        }
    }
    
    # Prompt for default model
    Write-Host ""
    Write-Host "=== Model Selection ===" -ForegroundColor Cyan
    $availableModels = @()
    if ($openaiKey) {
        $availableModels += "gpt-4", "gpt-4-turbo-preview", "gpt-3.5-turbo", "gpt-3.5-turbo-16k"
        Write-Host "OpenAI models available: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, GPT-3.5 16K" -ForegroundColor Green
    }
    if ($anthropicKey) {
        $availableModels += "claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-2.1", "claude-instant"
        Write-Host "Anthropic models available: Claude 3 (Opus, Sonnet, Haiku), Claude 2.1, Claude Instant" -ForegroundColor Green
    }
    if ($openrouterKey) {
        $availableModels += "openrouter/auto"
        $availableModels += "openrouter/openai/gpt-4-turbo", "openrouter/openai/gpt-3.5-turbo"
        $availableModels += "openrouter/anthropic/claude-3-opus", "openrouter/anthropic/claude-3-sonnet"
        $availableModels += "openrouter/google/gemini-pro", "openrouter/meta-llama/llama-2-70b"
        Write-Host "OpenRouter models available:" -ForegroundColor Green
        Write-Host "  - 100+ models including GPT-4, Claude 3, Gemini, Llama 2, Mixtral" -ForegroundColor Gray
    }
    if ($requestyKey) {
        # Requesty provides access to many models
        $availableModels += "requesty/auto", "requesty/gpt-4", "requesty/gpt-4-turbo", "requesty/gpt-3.5-turbo"
        $availableModels += "requesty/claude-3-opus", "requesty/claude-3-sonnet", "requesty/claude-3-haiku"
        $availableModels += "requesty/xai/grok-code-fast-1", "requesty/xai/grok-beta", "requesty/xai/grok-2-1212"
        $availableModels += "requesty/gemini-pro", "requesty/mixtral-8x7b", "requesty/llama-2-70b"
        Write-Host "Requesty.ai models available:" -ForegroundColor Green
        Write-Host "  - Auto routing (cost/quality optimized)" -ForegroundColor Gray
        Write-Host "  - OpenAI: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo" -ForegroundColor Gray
        Write-Host "  - Anthropic: Claude 3 Opus, Sonnet, Haiku" -ForegroundColor Gray
        Write-Host "  - xAI: Grok Code Fast, Grok Beta, Grok 2" -ForegroundColor Gray
        Write-Host "  - Google: Gemini Pro" -ForegroundColor Gray
        Write-Host "  - Open models: Mixtral, Llama 2" -ForegroundColor Gray
    }
    
    if ($availableModels.Count -gt 0) {
        Write-Host ""
        Write-Host "Select your preferred AI model:" -ForegroundColor Yellow
        Write-Host "(This will be used for all AI operations by default)" -ForegroundColor Gray
        Write-Host ""
        
        # Group models by category for better display
        $modelCategories = @{
            "Automatic/Optimized" = $availableModels | Where-Object { $_ -match "auto|cost-optimized|quality-optimized" }
            "xAI Grok Models" = $availableModels | Where-Object { $_ -match "grok" }
            "GPT-4 Models" = $availableModels | Where-Object { $_ -match "gpt-4" }
            "GPT-3.5 Models" = $availableModels | Where-Object { $_ -match "gpt-3.5" }
            "Claude 3 Models" = $availableModels | Where-Object { $_ -match "claude-3" }
            "Claude 2/Instant" = $availableModels | Where-Object { $_ -match "claude-2|claude-instant" }
            "Google Models" = $availableModels | Where-Object { $_ -match "gemini" }
            "Open Models" = $availableModels | Where-Object { $_ -match "llama|mixtral" }
        }
        
        $displayIndex = 1
        $indexToModel = @{}
        
        foreach ($category in $modelCategories.Keys | Sort-Object) {
            $models = $modelCategories[$category]
            if ($models.Count -gt 0) {
                Write-Host "`n$category`:" -ForegroundColor Cyan
                foreach ($model in $models) {
                    $displayName = $model
                    # Make display names more user-friendly
                    $displayName = $displayName -replace "requesty/", ""
                    $displayName = $displayName -replace "openrouter/", ""
                    $displayName = $displayName -replace "anthropic/", ""
                    $displayName = $displayName -replace "openai/", ""
                    $displayName = $displayName -replace "google/", ""
                    $displayName = $displayName -replace "meta-llama/", ""
                    $displayName = $displayName -replace "xai/", ""
                    
                    # Add cost/speed indicators
                    $indicator = ""
                    if ($model -match "grok-code-fast") { $indicator = " (Ultra-fast code, $$)" }
                    elseif ($model -match "grok-beta") { $indicator = " (Advanced, $$)" }
                    elseif ($model -match "grok-2") { $indicator = " (Latest, $$$)" }
                    elseif ($model -match "gpt-4-turbo") { $indicator = " (Fast, $$)" }
                    elseif ($model -match "gpt-4") { $indicator = " (Best, $$$)" }
                    elseif ($model -match "gpt-3.5") { $indicator = " (Fast, $)" }
                    elseif ($model -match "claude-3-opus") { $indicator = " (Best, $$$)" }
                    elseif ($model -match "claude-3-sonnet") { $indicator = " (Balanced, $$)" }
                    elseif ($model -match "claude-3-haiku") { $indicator = " (Fast, $)" }
                    elseif ($model -match "gemini-pro") { $indicator = " (Balanced, $$)" }
                    elseif ($model -match "mixtral") { $indicator = " (Open, $)" }
                    elseif ($model -match "llama") { $indicator = " (Open, $)" }
                    elseif ($model -match "auto") { $indicator = " (Smart routing)" }
                    
                    Write-Host "  $displayIndex. $displayName$indicator" -ForegroundColor White
                    $indexToModel[$displayIndex] = $model
                    $displayIndex++
                }
            }
        }
        
        Write-Host ""
        Write-Host "Tip: 'auto' lets the system choose the best model for each task" -ForegroundColor DarkGray
        Write-Host "     $ = Low cost, $$ = Medium cost, $$$ = High cost" -ForegroundColor DarkGray
        Write-Host ""
        
        $selection = Read-Host "Enter number (1-$($displayIndex-1))"
        if ($selection -match '^\d+$' -and [int]$selection -ge 1 -and [int]$selection -lt $displayIndex) {
            $defaultModel = $indexToModel[[int]$selection]
            $envContent = $envContent -replace 'DEFAULT_MODEL=.*', "DEFAULT_MODEL=$defaultModel"
            Write-Host "Default model set to: $defaultModel" -ForegroundColor Green
            
            # Also update routing mode if using Requesty
            if ($defaultModel -match "requesty/") {
                if ($defaultModel -match "grok-code-fast") {
                    $envContent = $envContent -replace 'REQUESTY_ROUTING_MODE=.*', "REQUESTY_ROUTING_MODE=speed-optimized"
                    Write-Host "Routing mode set to: speed-optimized (for fastest code generation)" -ForegroundColor Cyan
                } elseif ($defaultModel -match "gpt-4|opus|grok-2") {
                    $envContent = $envContent -replace 'REQUESTY_ROUTING_MODE=.*', "REQUESTY_ROUTING_MODE=quality-optimized"
                    Write-Host "Routing mode set to: quality-optimized (for best results)" -ForegroundColor Cyan
                } elseif ($defaultModel -match "3.5|haiku|mixtral|llama") {
                    $envContent = $envContent -replace 'REQUESTY_ROUTING_MODE=.*', "REQUESTY_ROUTING_MODE=cost-optimized"
                    Write-Host "Routing mode set to: cost-optimized (for efficiency)" -ForegroundColor Cyan
                } else {
                    $envContent = $envContent -replace 'REQUESTY_ROUTING_MODE=.*', "REQUESTY_ROUTING_MODE=balanced"
                    Write-Host "Routing mode set to: balanced" -ForegroundColor Cyan
                }
            }
        } else {
            Write-Host "Invalid selection, keeping existing model configuration" -ForegroundColor Yellow
        }
    }
    
    # Save the .env file
    Set-Content -Path $envPath -Value $envContent
    Write-Host ""
    Write-Host "Configuration saved to .env file" -ForegroundColor Green
}

# Test the configuration
Write-Host ""
Write-Host "=== Testing Configuration ===" -ForegroundColor Cyan
Write-Host "Starting MCP server to test AI functionality..." -ForegroundColor Yellow

# Check if Node.js is installed
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Cannot test the server." -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
} else {
    # Install dependencies if needed
    $packagePath = Join-Path $PSScriptRoot "package.json"
    if (Test-Path $packagePath) {
        if (!(Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
            Write-Host "Installing dependencies..." -ForegroundColor Yellow
            npm install
        }
    }
    
    Write-Host ""
    Write-Host "Would you like to test the AI configuration now? (y/n)" -ForegroundColor Cyan
    $testNow = Read-Host
    if ($testNow -eq 'y') {
        Write-Host "Starting test..." -ForegroundColor Green
        & "$PSScriptRoot\test-ai.ps1"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now:" -ForegroundColor Yellow
Write-Host "  1. Start the MCP server: npm start" -ForegroundColor White
Write-Host "  2. Test AI functionality: .\test-ai.ps1" -ForegroundColor White
Write-Host "  3. Update configuration: .\setup-ai-clean.ps1" -ForegroundColor White
Write-Host ""
