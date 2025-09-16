import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

class MultiModelMCPServer {
  constructor() {
    this.models = {};
    this.taskDefaults = {};
    this.rateLimits = {};
    this.configPath = path.join(__dirname, 'config', 'models.json');
    this.loadConfig();
  }

  /**
   * Load configuration from file and substitute environment variables
   */
  loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);

      // Process models configuration with environment variable substitution
      this.models = {};
      for (const [key, model] of Object.entries(config.models)) {
        const processedModel = { ...model };
        // Substitute environment variables in API keys
        if (model.apiKey && model.apiKey.startsWith('${') && model.apiKey.endsWith('}')) {
          const envVar = model.apiKey.slice(2, -1);
          processedModel.apiKey = process.env[envVar] || null;
        }
        this.models[key] = processedModel;
      }
      
      // Also add Requesty as a configured model if API key exists
      if (process.env.REQUESTY_API_KEY && !process.env.REQUESTY_API_KEY.includes('your-')) {
        this.models['requesty'] = {
          name: 'Requesty Gateway',
          provider: 'Requesty',
          apiKey: process.env.REQUESTY_API_KEY,
          endpoint: process.env.REQUESTY_ENDPOINT || 'https://api.requesty.ai/v1/chat/completions',
          modelId: process.env.DEFAULT_MODEL || 'auto',
          capabilities: ['generation', 'optimization', 'debugging', 'testing'],
          supported: true
        };
      }

      // Load task defaults and rate limits
      this.taskDefaults = config.task_defaults || {};
      this.rateLimits = config.rate_limits || {};

    } catch (error) {
      console.error('Failed to load MultiModel MCP configuration:', error.message);
      this.models = {};
      this.taskDefaults = {};
      this.rateLimits = {};
    }
  }

  /**
   * Select the best model for a given task based on configuration
   * @param {string} task - Task type (e.g., 'generation', 'optimization')
   * @returns {Object} Selected model configuration
   */
  selectBestModel(task) {
    const taskConfig = this.taskDefaults[task];
    if (!taskConfig) {
      // Default to first available supported model
      const availableModels = Object.values(this.models).filter(m => m.supported && m.apiKey);
      return availableModels[0] || null;
    }

    // Try preferred model first
    const preferredModel = this.models[taskConfig.preferred];
    if (preferredModel && preferredModel.supported && preferredModel.apiKey) {
      return preferredModel;
    }

    // Try fallback models
    for (const fallback of taskConfig.fallback) {
      const fallbackModel = this.models[fallback];
      if (fallbackModel && fallbackModel.supported && fallbackModel.apiKey) {
        return fallbackModel;
      }
    }

    // Last resort - any available model
    const availableModels = Object.values(this.models).filter(m => m.supported && m.apiKey);
    return availableModels[0] || null;
  }

  /**
   * Process a prompt with the specified model
   * @param {string} prompt - The prompt to process
   * @param {Object} model - Model configuration
   * @returns {Promise<Object>} Processing result
   */
  async processWithModel(prompt, model) {
    if (!model || !model.apiKey) {
      throw new Error('Invalid model configuration or API key not available');
    }

    try {
      // Basic processing logic - in practice, this would call the actual AI provider API
      const response = await this.callAIModel(prompt, model);

      return {
        success: true,
        model: model.name,
        response: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        model: model.name,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Main method to generate with best available model for task
   * @param {string} prompt - The prompt to process
   * @param {string} task - Task type
   * @returns {Promise<Object>} Generation result
   */
  async generateWithBestModel(prompt, task = 'generation') {
    const bestModel = this.selectBestModel(task);

    if (!bestModel) {
      throw new Error(`No suitable model available for task: ${task}`);
    }

    return await this.processWithModel(prompt, bestModel);
  }

  /**
   * Get available models for a task
   * @param {string} task - Task type
   * @returns {Array} Array of available models
   */
  getAvailableModels(task) {
    const availableModels = Object.values(this.models)
      .filter(m => m.supported && m.apiKey && (!task || m.capabilities.includes(task)));

    return availableModels;
  }

  /**
   * Simulate calling an AI model (replace with actual API calls)
   * @param {string} prompt - Prompt to send
   * @param {Object} model - Model configuration
   * @returns {Promise<string>} Simulated response
   */
  async callAIModel(prompt, model) {
    // Import the actual AI handler
    const AIModelHandler = (await import('./ai-model-handler.js')).default;
    const handler = new AIModelHandler();
    
    // Map model configuration to provider name
    let providerName = 'openai'; // default
    if (model.name.includes('claude') || model.name.includes('anthropic')) {
      providerName = 'anthropic';
    } else if (model.name.includes('gpt') || model.name.includes('openai')) {
      providerName = 'openai';
    } else if (model.apiKey && model.apiKey.startsWith('sk-or-')) {
      providerName = 'openrouter';
    } else if (model.apiKey && (model.apiKey.startsWith('rq_') || model.apiKey.startsWith('sk-Ko'))) {
      providerName = 'requesty';
    }
    
    try {
      const result = await handler.callProvider(providerName, prompt, { model: model.modelId });
      if (result.success) {
        return result.content || result.assemblyCode || 'No content generated';
      } else {
        throw new Error(result.error || 'AI generation failed');
      }
    } catch (error) {
      // Fallback to placeholder for testing
      console.warn('AI handler failed, using placeholder:', error.message);
      return `[Simulated] ${model.name}: ${prompt.slice(0, 50)}...`;
    }
  }

  /**
   * Refresh configuration
   */
  refreshConfig() {
    this.loadConfig();
  }

  /**
   * Get current configuration status
   * @returns {Object} Configuration status
   */
  getConfigStatus() {
    return {
      loaded: Object.keys(this.models).length > 0,
      modelCount: Object.keys(this.models).length,
      availableModels: this.getAvailableModels().length,
      taskDefaults: Object.keys(this.taskDefaults).length,
      rateLimits: Object.keys(this.rateLimits).length > 0
    };
  }
}

export default MultiModelMCPServer;