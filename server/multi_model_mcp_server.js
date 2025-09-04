import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // This is a placeholder - actual implementation would call the specific provider's API
    return new Promise((resolve, reject) => {
      // Simulate API call delay
      setTimeout(() => {
        if (Math.random() > 0.9) { // 10% failure rate for testing
          reject(new Error(`API call failed for ${model.name}`));
        } else {
          resolve(`Processed by ${model.name}: ${prompt.slice(0, 50)}...`);
        }
      }, 100 + Math.random() * 200);
    });
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