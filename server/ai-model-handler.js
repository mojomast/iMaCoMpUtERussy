/**
 * Enhanced AI Model Handler for iMaCoMpUtERussy
 * Supports OpenAI, Anthropic, and OpenRouter with actual API calls
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

class AIModelHandler {
  constructor() {
    this.providers = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        endpoint: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k']
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        endpoint: process.env.ANTHROPIC_ENDPOINT || 'https://api.anthropic.com/v1/messages',
        models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-2.1', 'claude-instant-1.2']
      },
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        endpoint: process.env.OPENROUTER_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions',
        models: ['openai/gpt-4-turbo-preview', 'anthropic/claude-3-opus', 'google/gemini-pro', 'meta-llama/llama-2-70b-chat']
      },
      requesty: {
        apiKey: process.env.REQUESTY_API_KEY,
        // Force correct endpoint regardless of env cache
        endpoint: 'https://router.requesty.ai/v1/chat/completions',
        projectId: process.env.REQUESTY_PROJECT_ID,
        routingMode: process.env.REQUESTY_ROUTING_MODE || 'cost-optimized',
        models: ['auto', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 
                 'xai/grok-code-fast-1', 'xai/grok-beta', 'xai/grok-2-1212', 
                 'gemini-pro', 'mixtral-8x7b', 'llama-2-70b']
      }
    };
    
    // Get the configured default model
    let defaultModel = process.env.DEFAULT_MODEL || 'gpt-4';
    
    // Clean up model name - handle both 'xai/grok-code-fast-1' and 'requesty/xai/grok-code-fast-1'
    // Always use xai/grok models through Requesty
    if (defaultModel.includes('xai/') || defaultModel.includes('grok')) {
      this.defaultProvider = 'requesty';
      // Strip 'requesty/' prefix if present
      this.requestyModel = defaultModel.replace('requesty/', '');
      // Ensure we use the clean model name
      defaultModel = this.requestyModel;
    } else if (defaultModel.includes('requesty/')) {
      this.defaultProvider = 'requesty';
      this.requestyModel = defaultModel.replace('requesty/', '');
    } else if (defaultModel.includes('openrouter/')) {
      this.defaultProvider = 'openrouter';
      this.openRouterModel = defaultModel.replace('openrouter/', '');
    } else if (defaultModel.includes('claude')) {
      this.defaultProvider = 'anthropic';
    } else if (defaultModel.includes('gemini') || defaultModel.includes('mixtral') || defaultModel.includes('llama')) {
      // These models are typically accessed via Requesty or OpenRouter
      this.defaultProvider = 'requesty';
      this.requestyModel = defaultModel;
    } else {
      this.defaultProvider = 'openai';
    }
    
    this.defaultModel = defaultModel;
    this.debugMode = process.env.AI_DEBUG === 'true' || process.env.NODE_ENV === 'development';
  }

  /**
   * Generate text using the best available model
   * @param {string} prompt - The prompt to process
   * @param {string} task - Task type (generation, optimization, debugging, etc.)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Generation result
   */
  async generateWithBestModel(prompt, task = 'generation', options = {}) {
    console.log(`🎯 generateWithBestModel called with task: ${task}, prompt length: ${prompt.length}`);
    console.log(`🎯 Options:`, JSON.stringify(options, null, 2));
    console.log(`🎯 Default model: ${this.defaultModel}, Default provider: ${this.defaultProvider}`);

    // Determine which provider to use based on available API keys
    const availableProviders = this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new Error('No AI providers configured. Please set API keys in .env file.');
    }

    // Try providers in order of preference
    const providerOrder = this.getProviderOrder(task);
    console.log(`🔄 Trying providers in order: ${providerOrder.join(', ')}`);

    for (const providerName of providerOrder) {
      if (!availableProviders.includes(providerName)) continue;

      try {
        console.log(`🔄 Attempting provider: ${providerName}`);
        const result = await this.callProvider(providerName, prompt, options);
        if (result.success) {
          console.log(`✅ Provider ${providerName} succeeded with model: ${result.model}`);
          return result;
        } else {
          console.log(`❌ Provider ${providerName} returned success=false`);
        }
      } catch (error) {
        console.error(`❌ Provider ${providerName} failed:`, error.message);
        // Continue to next provider
      }
    }

    throw new Error('All AI providers failed to generate response');
  }

  /**
   * Get available providers based on configured API keys
   * @returns {Array<string>} List of available provider names
   */
  getAvailableProviders() {
    return Object.entries(this.providers)
      .filter(([name, config]) => config.apiKey && config.apiKey !== '' && !config.apiKey.includes('your-'))
      .map(([name]) => name);
  }

  /**
   * Get provider order based on task type
   * @param {string} task - Task type
   * @returns {Array<string>} Ordered list of providers to try
   */
  getProviderOrder(task) {
    // Always try the default provider first
    const providers = [];
    if (this.defaultProvider) {
      providers.push(this.defaultProvider);
    }
    
    // Then add other providers as fallbacks
    const taskPreferences = {
      generation: ['requesty', 'openrouter', 'openai', 'anthropic'],
      optimization: ['requesty', 'anthropic', 'openrouter', 'openai'],
      debugging: ['requesty', 'openai', 'anthropic', 'openrouter'],
      testing: ['requesty', 'openrouter', 'anthropic', 'openai'],
      custom: ['requesty', 'openrouter', 'openai', 'anthropic']
    };
    
    const fallbacks = taskPreferences[task] || taskPreferences.custom;
    for (const provider of fallbacks) {
      if (!providers.includes(provider)) {
        providers.push(provider);
      }
    }
    
    return providers;
  }

  /**
   * Call a specific AI provider
   * @param {string} providerName - Provider name
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Provider response
   */
  async callProvider(providerName, prompt, options = {}) {
    const provider = this.providers[providerName];
    
    if (!provider || !provider.apiKey) {
      throw new Error(`Provider ${providerName} not configured`);
    }
    
    switch (providerName) {
      case 'openai':
        return await this.callOpenAI(prompt, options);
      case 'anthropic':
        return await this.callAnthropic(prompt, options);
      case 'openrouter':
        return await this.callOpenRouter(prompt, options);
      case 'requesty':
        return await this.callRequesty(prompt, options);
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Call OpenAI API
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async callOpenAI(prompt, options = {}) {
    const provider = this.providers.openai;
    const model = options.model || this.defaultModel;
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert 6502 assembly programmer helping with the iMaCoMpUtERussy emulator.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000
    };
    
    if (this.debugMode) {
      console.log('OpenAI request:', JSON.stringify(requestBody, null, 2));
    }
    
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify(requestBody),
      timeout: options.timeout || 30000
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      provider: 'openai',
      model: model,
      content: data.choices[0].message.content,
      tokensUsed: data.usage?.total_tokens || 0,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Call Anthropic API
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async callAnthropic(prompt, options = {}) {
    const provider = this.providers.anthropic;
    const model = options.model || 'claude-3-sonnet-20240229';
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      system: 'You are an expert 6502 assembly programmer helping with the iMaCoMpUtERussy emulator.',
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7
    };
    
    if (this.debugMode) {
      console.log('Anthropic request:', JSON.stringify(requestBody, null, 2));
    }
    
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      timeout: options.timeout || 30000
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      provider: 'anthropic',
      model: model,
      content: data.content[0].text,
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Call OpenRouter API
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async callOpenRouter(prompt, options = {}) {
    const provider = this.providers.openrouter;
    const model = options.model || this.openRouterModel;
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert 6502 assembly programmer helping with the iMaCoMpUtERussy emulator.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      // OpenRouter specific options
      transforms: ['middle-out'],
      route: 'fallback'
    };
    
    if (this.debugMode) {
      console.log('OpenRouter request:', JSON.stringify(requestBody, null, 2));
    }
    
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'HTTP-Referer': 'https://github.com/imacomputerussy',
        'X-Title': 'iMaCoMpUtERussy Emulator'
      },
      body: JSON.stringify(requestBody),
      timeout: options.timeout || 30000
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      provider: 'openrouter',
      model: data.model || model,
      content: data.choices[0].message.content,
      tokensUsed: data.usage?.total_tokens || 0,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Call Requesty.ai API - Unified LLM Gateway with intelligent routing
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async callRequesty(prompt, options = {}) {
    const provider = this.providers.requesty;
    let model = options.model || this.requestyModel || process.env.DEFAULT_MODEL || 'auto';

    // Debug logging
    console.log('Requesty API call starting:', {
      endpoint: provider.endpoint,
      model: model,
      requestyModel: this.requestyModel,
      hasApiKey: !!provider.apiKey
    });

    // Clean up model name for Requesty - remove 'requesty/' prefix if present
    if (model.startsWith('requesty/')) {
      model = model.replace('requesty/', '');
      console.log('Cleaned model name:', model);
    }

    // Enhanced empty content retry logic for all models
    console.log(`🔍 Checking if model "${model}" needs retry logic...`);
    console.log(`🔍 Model includes 'grok': ${model.includes('grok')}`);
    console.log(`🔍 Model includes 'xai': ${model.includes('xai')}`);

    // Apply retry logic to Grok and XAI models
    if (model.includes('grok') || model.includes('xai')) {
      console.log(`🚀 Calling enhanced retry logic for model: ${model}`);
      return await this.callEnhancedEmptyContentRetry(prompt, options, provider, model);
    } else {
      console.log(`➡️ Using normal Requesty call for model: ${model}`);
    }
    
    const requestBody = {
      model: model === 'auto' ? undefined : model, // Let Requesty choose if 'auto'
      messages: [
        {
          role: 'system',
          content: model.includes('grok') 
            ? 'You are an expert 6502 assembly code generator. Generate efficient, well-commented assembly code for the iMaCoMpUtERussy emulator. Focus on clean, optimized code with clear structure.'
            : 'You are an expert 6502 assembly programmer helping with the iMaCoMpUtERussy emulator.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      // Requesty specific options
      routing: {
        mode: provider.routingMode,
        preferences: {
          cost: provider.routingMode === 'cost-optimized' ? 1.0 : 0.5,
          quality: provider.routingMode === 'quality-optimized' ? 1.0 : 0.5,
          speed: provider.routingMode === 'speed-optimized' ? 1.0 : 0.5,
          // Boost speed preference for Grok Code Fast model
          codeGeneration: model.includes('grok-code-fast') ? 1.0 : 0.7
        },
        fallback: true,
        retry: {
          enabled: true,
          maxAttempts: 3
        }
      },
      metadata: {
        projectId: provider.projectId,
        source: 'imacomputerussy',
        task: options.task || 'generation'
      }
    };
    
    // Remove undefined model key if using auto routing
    if (model === 'auto') {
      delete requestBody.model;
    }
    
    if (this.debugMode) {
      console.log('Requesty request:', JSON.stringify(requestBody, null, 2));
    }
    
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'X-Project-Id': provider.projectId || 'default',
        'X-Routing-Mode': provider.routingMode
      },
      body: JSON.stringify(requestBody),
      timeout: options.timeout || 45000 // Longer timeout for potential retries
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Requesty API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      provider: 'requesty',
      model: data.model_used || data.model || 'auto-selected',
      actualProvider: data.provider_used || 'unknown',
      content: data.choices[0].message.content,
      tokensUsed: data.usage?.total_tokens || 0,
      cost: data.usage?.total_cost || 0,
      routingInfo: {
        mode: provider.routingMode,
        selectedProvider: data.provider_used,
        fallbackUsed: data.fallback_used || false,
        latency: data.latency_ms || 0
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Call Requesty API with specialized empty content handling for Grok models
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @param {Object} provider - Provider configuration
   * @param {string} model - Model name
   * @returns {Promise<Object>} API response
   */
  async callRequestyWithEmptyContentRetry(prompt, options = {}, provider, model) {
    const maxRetries = 3;
    let lastError = null;
    let lastResult = null;

    console.log(`🔄 ENTERING Grok retry logic for model: ${model}, prompt length: ${prompt.length}`);
    console.log(`🔍 Model includes 'grok': ${model.includes('grok')}`);
    console.log(`🔍 Current options:`, JSON.stringify(options, null, 2));

    // Adjust initial parameters for better Grok performance
    let currentOptions = { ...options };
    if (!currentOptions.temperature || currentOptions.temperature < 0.3) {
      currentOptions.temperature = 0.3; // Slightly higher temperature for more consistent output
    }

    console.log(`⚙️ Adjusted initial parameters: temperature=${currentOptions.temperature}, maxTokens=${currentOptions.maxTokens}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Grok retry attempt ${attempt}/${maxRetries} with model ${model}`);
        console.log(`📊 Current attempt parameters: temp=${currentOptions.temperature}, maxTokens=${currentOptions.maxTokens}`);

        const result = await this.makeRequestyCall(prompt, currentOptions, provider, model);

        // Check if content is empty or too short
        const content = result.content || '';
        const isEmptyContent = !content.trim() || content.trim().length < 10;

        console.log(`📝 Content analysis: length=${content.length}, trimmed_length=${content.trim().length}, isEmpty=${isEmptyContent}`);
        console.log(`📝 Content preview: "${content.trim().substring(0, 50)}..."`);
        console.log(`📊 Tokens used: ${result.tokensUsed}, Model: ${result.model}`);

        if (isEmptyContent) {
          console.warn(`❌ Grok attempt ${attempt}: Empty or insufficient content (${content.length} chars), tokens used: ${result.tokensUsed}`);

          // If this is the last attempt, try fallback to alternative model
          if (attempt === maxRetries) {
            console.log('🔄 All Grok attempts failed with empty content, trying fallback model...');
            return await this.callRequestyFallback(prompt, options, provider);
          }

          // Adjust parameters for next attempt
          const oldTemp = currentOptions.temperature;
          const oldMaxTokens = currentOptions.maxTokens || 2000;
          currentOptions.temperature = Math.min(currentOptions.temperature + 0.2, 0.8); // Increase temperature
          currentOptions.maxTokens = Math.min((currentOptions.maxTokens || 2000) + 200, 3000); // Increase max tokens

          console.log(`⚙️ Parameter adjustment: temp ${oldTemp} -> ${currentOptions.temperature}, maxTokens ${oldMaxTokens} -> ${currentOptions.maxTokens}`);

          // Add delay before retry
          console.log(`⏱️ Waiting ${1000 * attempt}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

          continue;
        }

        console.log(`✅ Grok attempt ${attempt} successful with ${content.length} characters`);
        return result;

      } catch (error) {
        console.error(`Grok attempt ${attempt} failed with error:`, error.message);
        lastError = error;

        // If it's a network/API error and not the last attempt, continue retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }

    // If we get here, all attempts failed
    if (lastResult) {
      console.warn('Returning last result despite empty content as all retries exhausted');
      return lastResult;
    }

    throw lastError || new Error('All Grok retry attempts failed');
  }

  /**
   * Make the actual Requesty API call (extracted for reuse)
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @param {Object} provider - Provider configuration
   * @param {string} model - Model name
   * @returns {Promise<Object>} API response
   */
  async makeRequestyCall(prompt, options, provider, model) {
    const requestBody = {
      model: model === 'auto' ? undefined : model,
      messages: [
        {
          role: 'system',
          content: model.includes('grok')
            ? 'You are an expert 6502 assembly code generator. Generate efficient, well-commented assembly code for the iMaCoMpUtERussy emulator. Focus on clean, optimized code with clear structure. Always provide meaningful code output.'
            : 'You are an expert 6502 assembly programmer helping with the iMaCoMpUtERussy emulator.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      routing: {
        mode: provider.routingMode,
        preferences: {
          cost: provider.routingMode === 'cost-optimized' ? 1.0 : 0.5,
          quality: provider.routingMode === 'quality-optimized' ? 1.0 : 0.5,
          speed: provider.routingMode === 'speed-optimized' ? 1.0 : 0.5,
          codeGeneration: model.includes('grok-code-fast') ? 1.0 : 0.7
        },
        fallback: true,
        retry: {
          enabled: true,
          maxAttempts: 3
        }
      },
      metadata: {
        projectId: provider.projectId,
        source: 'imacomputerussy',
        task: options.task || 'generation'
      }
    };

    if (model === 'auto') {
      delete requestBody.model;
    }

    if (this.debugMode) {
      console.log('Requesty request:', JSON.stringify(requestBody, null, 2));
    }

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'X-Project-Id': provider.projectId || 'default',
        'X-Routing-Mode': provider.routingMode
      },
      body: JSON.stringify(requestBody),
      timeout: options.timeout || 45000
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Requesty API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      success: true,
      provider: 'requesty',
      model: data.model_used || data.model || 'auto-selected',
      actualProvider: data.provider_used || 'unknown',
      content: data.choices[0].message.content || '',
      tokensUsed: data.usage?.total_tokens || 0,
      cost: data.usage?.total_cost || 0,
      routingInfo: {
        mode: provider.routingMode,
        selectedProvider: data.provider_used,
        fallbackUsed: data.fallback_used || false,
        latency: data.latency_ms || 0
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Enhanced empty content retry logic for all models prone to empty responses
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @param {Object} provider - Provider configuration
   * @param {string} model - Model name
   * @returns {Promise<Object>} API response
   */
  async callEnhancedEmptyContentRetry(prompt, options = {}, provider, model) {
    const maxRetries = 3;
    let lastError = null;
    let lastResult = null;

    console.log(`🔄 ENTERING enhanced retry logic for model: ${model}, prompt length: ${prompt.length}`);
    console.log(`🔍 Current options:`, JSON.stringify(options, null, 2));

    // Adjust initial parameters for better performance
    let currentOptions = { ...options };
    if (!currentOptions.temperature || currentOptions.temperature < 0.3) {
      currentOptions.temperature = 0.3; // Slightly higher temperature for more consistent output
    }

    console.log(`⚙️ Adjusted initial parameters: temperature=${currentOptions.temperature}, maxTokens=${currentOptions.maxTokens}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Enhanced retry attempt ${attempt}/${maxRetries} with model ${model}`);
        console.log(`📊 Current attempt parameters: temp=${currentOptions.temperature}, maxTokens=${currentOptions.maxTokens}`);

        const result = await this.makeRequestyCall(prompt, currentOptions, provider, model);

        // Check if content is empty or too short
        const content = result.content || '';
        const isEmptyContent = !content.trim() || content.trim().length < 5; // Lower threshold for better detection

        console.log(`📝 Content analysis: length=${content.length}, trimmed_length=${content.trim().length}, isEmpty=${isEmptyContent}`);
        console.log(`📝 Content preview: "${content.trim().substring(0, 50)}..."`);
        console.log(`📊 Tokens used: ${result.tokensUsed}, Model: ${result.model}`);

        if (isEmptyContent) {
          console.warn(`❌ Enhanced attempt ${attempt}: Empty or insufficient content (${content.length} chars), tokens used: ${result.tokensUsed}`);

          // If this is the last attempt, try fallback to alternative model
          if (attempt === maxRetries) {
            console.log('🔄 All attempts failed with empty content, trying fallback model...');
            return await this.callRequestyFallback(prompt, options, provider);
          }

          // Adjust parameters for next attempt - more aggressive adjustments
          const oldTemp = currentOptions.temperature;
          const oldMaxTokens = currentOptions.maxTokens || 2000;
          currentOptions.temperature = Math.min(currentOptions.temperature + 0.3, 0.9); // Increase temperature more aggressively
          currentOptions.maxTokens = Math.min((currentOptions.maxTokens || 2000) + 500, 4000); // Increase max tokens more aggressively

          console.log(`⚙️ Enhanced parameter adjustment: temp ${oldTemp} -> ${currentOptions.temperature}, maxTokens ${oldMaxTokens} -> ${currentOptions.maxTokens}`);

          // Add delay before retry
          console.log(`⏱️ Waiting ${1500 * attempt}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));

          continue;
        }

        console.log(`✅ Enhanced attempt ${attempt} successful with ${content.length} characters`);
        return result;

      } catch (error) {
        console.error(`❌ Enhanced attempt ${attempt} failed with error:`, error.message);
        lastError = error;

        // If it's a network/API error and not the last attempt, continue retrying
        if (attempt < maxRetries) {
          console.log(`⏱️ Waiting ${1000 * attempt}ms before retry due to error...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }

    // If we get here, all attempts failed
    if (lastResult) {
      console.warn('Returning last result despite empty content as all retries exhausted');
      return lastResult;
    }

    throw lastError || new Error('All enhanced retry attempts failed');
  }

  /**
   * Fallback Requesty call using alternative model when primary model fails
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @param {Object} provider - Provider configuration
   * @returns {Promise<Object>} API response
   */
  async callRequestyFallback(prompt, options = {}, provider) {
    console.log('Attempting fallback with alternative model...');

    // Try alternative models in order of preference (Requesty format)
    const fallbackModels = ['anthropic/claude-3-sonnet-20240229', 'openai/gpt-4', 'google/gemini-pro', 'auto'];

    for (const fallbackModel of fallbackModels) {
      try {
        console.log(`Trying fallback model: ${fallbackModel}`);
        const result = await this.makeRequestyCall(prompt, { ...options, model: fallbackModel }, provider, fallbackModel);

        const content = result.content || '';
        if (content.trim().length >= 5) { // Lower threshold for fallback success
          console.log(`Fallback successful with ${fallbackModel} (${content.length} characters)`);
          result.model = `fallback-${fallbackModel}`;
          return result;
        } else {
          console.log(`Fallback ${fallbackModel} also returned insufficient content (${content.length} chars)`);
        }
      } catch (error) {
        console.warn(`Fallback model ${fallbackModel} failed:`, error.message);
        continue;
      }
    }

    throw new Error('All fallback models failed to generate meaningful content');
  }

  /**
   * Get available models for a specific provider
   * @param {string} providerName - Provider name
   * @returns {Array<string>} List of available models
   */
  getAvailableModels(providerName = null) {
    if (providerName) {
      return this.providers[providerName]?.models || [];
    }
    
    // Return all available models from configured providers
    const models = [];
    const availableProviders = this.getAvailableProviders();
    
    for (const provider of availableProviders) {
      const providerModels = this.providers[provider].models || [];
      models.push(...providerModels.map(m => ({
        model: m,
        provider: provider
      })));
    }
    
    return models;
  }

  /**
   * Get configuration status
   * @returns {Object} Configuration status
   */
  getConfigStatus() {
    const status = {};
    
    for (const [name, config] of Object.entries(this.providers)) {
      if (config.apiKey && !config.apiKey.includes('your-')) {
        status[name] = 'configured';
      } else {
        status[name] = 'missing-key';
      }
    }
    
    return {
      providers: status,
      defaultModel: this.defaultModel,
      debugMode: this.debugMode,
      availableProviders: this.getAvailableProviders()
    };
  }

  /**
   * Generate assembly code with context awareness
   * @param {string} prompt - The generation prompt
   * @param {Object} context - Additional context (memory state, registers, etc.)
   * @returns {Promise<Object>} Generated assembly code
   */
  async generateAssemblyCode(prompt, context = {}) {
    // Enhance prompt with emulator context
    let enhancedPrompt = `Generate 6502 assembly code for the iMaCoMpUtERussy emulator.\n\n`;
    enhancedPrompt += `Request: ${prompt}\n\n`;
    
    if (context.memoryMap) {
      enhancedPrompt += `Memory Map:\n`;
      enhancedPrompt += `- Zero Page: $0000-$00FF\n`;
      enhancedPrompt += `- Stack: $0100-$01FF\n`;
      enhancedPrompt += `- Video Buffer: $0200-$05FF\n`;
      enhancedPrompt += `- User RAM: $0600-$7FFF\n\n`;
    }
    
    if (context.customInstructions) {
      enhancedPrompt += `Custom Instructions Available:\n`;
      enhancedPrompt += `- VLD: Load video pattern (opcode $8B)\n`;
      enhancedPrompt += `- VST: Store to video buffer (opcode $9B)\n`;
      enhancedPrompt += `- VUP: Update video display (opcode $AB)\n`;
      enhancedPrompt += `- VDL: Video delay (opcode $BB)\n`;
      enhancedPrompt += `- HLT: Halt CPU (opcode $3A)\n\n`;
    }
    
    enhancedPrompt += `Please provide:\n`;
    enhancedPrompt += `1. Complete assembly code starting at $0600\n`;
    enhancedPrompt += `2. Comments explaining each section\n`;
    enhancedPrompt += `3. Use proper 6502 syntax\n`;
    
    const result = await this.generateWithBestModel(enhancedPrompt, 'generation', {
      temperature: 0.5, // Lower temperature for more consistent code
      maxTokens: 3000
    });
    
    // Extract just the assembly code if wrapped in markdown
    if (result.content) {
      const codeMatch = result.content.match(/```(?:asm|assembly)?\n([\s\S]*?)```/);
      if (codeMatch) {
        result.assemblyCode = codeMatch[1].trim();
      } else {
        result.assemblyCode = result.content;
      }
    }
    
    return result;
  }
}

export default AIModelHandler;
