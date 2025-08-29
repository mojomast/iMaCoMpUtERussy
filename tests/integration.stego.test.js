/**
 * Integration Tests for VideoStorage-8 Steganography Pipeline
 * Tests full pipeline: assemble -> compress -> addECC -> encode -> decode -> validate -> decompress
 */

import { assemble } from '../js/assembler.js';
import { SteganographyEngine } from '../js/steganography.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Polyfill global.ImageData for Node.js
if (typeof global.ImageData === 'undefined') {
    global.ImageData = function(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    };
}

// Polyfill global.window for memory load test
if (typeof global.window === 'undefined') {
    global.window = {};
}

export function runIntegrationTests() {
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    function test(name, testFn) {
        try {
            const result = testFn();
            if (result === true || result === undefined) {
                results.passed++;
                results.tests.push({ name, status: 'PASS' });
                console.log(`✓ ${name}`);
            } else {
                results.failed++;
                results.tests.push({ name, status: 'FAIL', error: result });
                console.log(`✗ ${name}: ${result}`);
            }
        } catch (error) {
            results.failed++;
            results.tests.push({ name, status: 'FAIL', error: error.message });
            console.log(`✗ ${name}: ${error.message}`);
        }
    }

    // Test 1: Full steganography pipeline
    test('Full steganography pipeline', () => {
        console.log('\n=== Starting Full Pipeline Test ===');

        // Step 1: Read and assemble hello-world.asm
        console.log('Step 1: Reading samples/hello-world.asm...');
        const asmPath = join(__dirname, '..', 'samples', 'hello-world.asm');
        const source = readFileSync(asmPath, 'utf8');
        console.log('Source content:\n', source);
        console.log('Source lines:', source.split('\n').map((line, i) => `${i + 1}: "${line}"`).join('\n'));

        console.log('Step 2: Assembling source code...');
        const assembled = assemble(source, { origin: 0x0600 });
        console.log(`Assembled ${assembled.length} bytes: [${Array.from(assembled).join(', ')}]`);

        // Step 3: Initialize SteganographyEngine
        console.log('Step 3: Initializing SteganographyEngine with ECC=8, autoCompress=true...');
        const engine = new SteganographyEngine({
            eccSymbols: 8,
            autoCompress: true
        });

        // Step 4: Compress data
        console.log('Step 4: Compressing assembled data...');
        const compressed = engine.compressData(assembled);
        console.log(`Compressed from ${assembled.length} to ${compressed.length} bytes`);

        // Step 5: Add error correction
        console.log('Step 5: Adding Reed-Solomon error correction...');
        const withECC = engine.addErrorCorrection(compressed);
        console.log(`Added ECC, total size: ${withECC.length} bytes`);

        // Step 6: Create fake ImageData frame
        console.log('Step 6: Creating fake ImageData frame (100x100)...');
        const frameWidth = 100;
        const frameHeight = 100;
        const frameData = new Uint8ClampedArray(frameWidth * frameHeight * 4);
        for (let i = 0; i < frameData.length; i++) {
            frameData[i] = 255; // Fill with white
        }
        const fakeImageData = new ImageData(frameData, frameWidth, frameHeight);
        console.log(`Created ${frameWidth}x${frameHeight} frame with ${fakeImageData.data.length} bytes`);

        // Step 7: Encode LSB
        console.log('Step 7: Encoding data using LSB steganography...');
        const embeddedImageData = engine.encodeLSB(withECC, fakeImageData);
        console.log(`Embedded data into frame, output size: ${embeddedImageData.data.length} bytes`);

        // Step 8: Decode LSB
        console.log('Step 8: Decoding data from LSB-embedded image...');
        const extracted = engine.decodeLSB(embeddedImageData);
        console.log(`Extracted ${extracted.length} bytes from frame`);

        // Step 9: Validate data
        console.log('Step 9: Validating data with Reed-Solomon ECC...');
        const validated = engine.validateData(extracted);
        console.log(`Validated data, corrected size: ${validated.length} bytes`);

        // Step 10: Decompress data
        console.log('Step 10: Decompressing data...');
        const decompressed = engine.decompressData(validated);
        console.log(`Decompressed to ${decompressed.length} bytes`);

        // Step 11: Assert equality
        console.log('Step 11: Asserting decompressed equals original assembled bytes...');
        if (decompressed.length !== assembled.length) {
            return `Length mismatch: expected ${assembled.length}, got ${decompressed.length}`;
        }

        for (let i = 0; i < assembled.length; i++) {
            if (decompressed[i] !== assembled[i]) {
                return `Byte mismatch at index ${i}: expected ${assembled[i]}, got ${decompressed[i]}`;
            }
        }

        console.log('✓ Pipeline test passed: assembled data round-trip successful!');
        return true;
    });

    // Test 2: Memory load fallback test
    test('Memory load fallback test', () => {
        console.log('\n=== Starting Memory Load Fallback Test ===');

        // Reset global state
        global._loaded = null;

        // Step 1: Read and assemble hello-world.asm
        console.log('Step 1: Reading and assembling samples/hello-world.asm...');
        const asmPath = join(__dirname, '..', 'samples', 'hello-world.asm');
        const source = readFileSync(asmPath, 'utf8');
        const assembled = assemble(source, { origin: 0x0600 });

        // Step 2: Initialize SteganographyEngine
        const engine = new SteganographyEngine({
            eccSymbols: 8,
            autoCompress: true
        });

        // Step 3: Run full pipeline
        console.log('Step 3: Running compression -> ECC -> LSB pipeline...');
        const compressed = engine.compressData(assembled);
        const withECC = engine.addErrorCorrection(compressed);

        const fakeImageData = new ImageData(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100);
        const embeddedImageData = engine.encodeLSB(withECC, fakeImageData);
        const extracted = engine.decodeLSB(embeddedImageData);
        const validated = engine.validateData(extracted);
        const decompressed = engine.decompressData(validated);

        // Step 4: Setup window.memory mock
        console.log('Step 4: Setting up window.memory mock...');
        global.window.memory = {
            loadProgram: async (buf, addr) => {
                global._loaded = { buf: new Uint8Array(buf), addr };
                console.log(`Mock loadProgram called with ${buf.byteLength} bytes at address 0x${addr.toString(16)}`);
                return Promise.resolve();
            }
        };

        // Step 5: Call memory load
        console.log('Step 5: Calling window.memory.loadProgram...');
        window.memory.loadProgram(decompressed.buffer, 0x0600);

        // Step 6: Assert loaded correctly
        console.log('Step 6: Asserting load results...');
        if (!global._loaded) {
            return 'Memory load was not called';
        }

        if (global._loaded.addr !== 0x0600) {
            return `Wrong address: expected 0x0600, got 0x${global._loaded.addr.toString(16)}`;
        }

        if (global._loaded.buf.byteLength !== decompressed.length) {
            return `Wrong buffer length: expected ${decompressed.length}, got ${global._loaded.buf.byteLength}`;
        }

        console.log('✓ Memory load fallback test passed!');
        return true;
    });

    console.log(`\nIntegration Tests completed: ${results.passed} passed, ${results.failed} failed`);
    return results;
}

// Run tests if this module is executed directly
if (typeof window !== 'undefined' && window.location) {
    // Browser environment
    window.runIntegrationTests = runIntegrationTests;
} else if (typeof process !== 'undefined') {
    // Node.js environment
    if (process.env.NODE_ENV === 'test') {
        runIntegrationTests();
    }
}
