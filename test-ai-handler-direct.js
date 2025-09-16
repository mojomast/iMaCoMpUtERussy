// Direct test of AI Model Handler
import AIModelHandler from './server/ai-model-handler.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Testing AI Model Handler directly...\n');

// Create handler instance
const handler = new AIModelHandler();

// Check configuration
console.log('Configuration Status:');
const config = handler.getConfigStatus();
console.log(JSON.stringify(config, null, 2));

console.log('\nDefault Model:', process.env.DEFAULT_MODEL);
console.log('Default Provider:', handler.defaultProvider);
console.log('Requesty Model:', handler.requestyModel);

// Check available providers
console.log('\nAvailable Providers:', handler.getAvailableProviders());

// Test generation if Requesty is available
if (handler.getAvailableProviders().includes('requesty')) {
  console.log('\n=== Testing AI Generation ===');
  
  try {
    const result = await handler.generateWithBestModel(
      'Write a simple 6502 assembly routine to load 42 into accumulator. Just the code.',
      'generation',
      { temperature: 0.3, maxTokens: 200 }
    );
    
    console.log('\n[SUCCESS] Generation completed!');
    console.log('Provider:', result.provider);
    console.log('Model:', result.model);
    console.log('Content:', result.content);
  } catch (error) {
    console.error('\n[FAIL] Generation failed:', error.message);
    console.error('Stack:', error.stack);
  }
} else {
  console.log('\n[WARNING] Requesty provider not available');
}

process.exit(0);
