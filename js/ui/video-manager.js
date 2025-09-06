/**
 * Video Manager UI for VideoStorage-8
 * Stub UI for encoding/upload controls
 */

import { SteganographyEngine } from '../steganography.js';
import { PlatformManager } from '../platforms/youtube-api.js';
import { extractFrameImageData, embedDataInFrame, extractDataFromFrame, createModifiedVideoBlob, splitPayloadAcrossFrames, embedAcrossFrames, recomposeFramesToBlob, calculateFrameCapacity } from './video-frames.js';
import { assemble } from '../assembler.js';
import { iMaCoMpUtERussyMemory } from '../memory.js';
import { validatePixelCoordinates, validateColor } from '../../lib/validators.js';

// Global variables for assembled .asm programs
let lastAssembledProgram = null;
let lastAssembledOrigin = null;

/**
 * Create animated progress bar with percentage text and cancel button
 * @param {HTMLElement} container - Container element for the progress bar
 * @returns {HTMLElement} Progress bar element
 */
function createProgressBar(container) {
    const progressDiv = document.createElement('div');
    progressDiv.className = 'progress-container';
    progressDiv.innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <div class="progress-text">0%</div>
        <div class="progress-status">Initializing...</div>
        <button class="progress-cancel">Cancel</button>
    `;
    container.appendChild(progressDiv);
    return progressDiv;
}

/**
 * Update progress bar
 * @param {HTMLElement} progressDiv - Progress bar element
 * @param {number} percentage - Progress percentage (0-100)
 * @param {string} status - Status message
 */
function updateProgress(progressDiv, percentage, status) {
    const fill = progressDiv.querySelector('.progress-fill');
    const text = progressDiv.querySelector('.progress-text');
    const statusDiv = progressDiv.querySelector('.progress-status');

    fill.style.width = `${percentage}%`;
    text.textContent = `${Math.round(percentage)}%`;
    statusDiv.textContent = status;
}

/**
 * Remove progress bar
 * @param {HTMLElement} progressDiv - Progress bar element
 */
function removeProgress(progressDiv) {
    if (progressDiv && progressDiv.parentNode) {
        progressDiv.parentNode.removeChild(progressDiv);
    }
}

/**
 * Validate file before processing
 * @param {File} file - File to validate
 * @returns {Promise<{valid: boolean, error?: string, capacity?: number}>}
 */
async function validateFile(file) {
    if (!file) {
        return { valid: false, error: 'No file selected' };
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
        return { valid: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 100MB.` };
    }

    if (file.name.endsWith('.asm')) {
        // Validate .asm syntax by attempting to assemble
        try {
            const text = await file.text();
            const { assemble } = await import('../assembler.js');
            assemble(text, { origin: 0x0600 });
            return { valid: true };
        } catch (error) {
            return { valid: false, error: `Invalid .asm syntax: ${error.message}` };
        }
    } else if (file.type.startsWith('video/')) {
        // Estimate embedding capacity
        try {
            const capacity = await SteganographyEngine.calculateCapacity(file);
            return { valid: true, capacity };
        } catch (error) {
            return { valid: false, error: `Cannot process video: ${error.message}` };
        }
    }

    return { valid: false, error: 'Unsupported file type. Please select a video or .asm file.' };
}

/**
 * Initialize video manager UI
 */
export function initVideoManager() {
    const controlsDiv = document.getElementById('video-controls');

    // Create enhanced controls with file info, progress, and capacity display
    controlsDiv.innerHTML = `
        <div class="control-group">
            <h3>File Selection</h3>
            <input type="file" id="video-file" accept="video/*,.asm" multiple>
            <div id="file-info" class="file-info"></div>
            <div id="capacity-display" class="capacity-display"></div>
        </div>

        <div class="control-group">
            <h3>Operations</h3>
            <button id="encode-btn">Encode Data</button>
            <button id="decode-btn">Decode Data</button>
            <button id="upload-btn">Upload to YouTube</button>
            <button id="download-btn">Download from YouTube</button>
            <button id="load-asm-btn">Load .asm → Memory</button>
            <button id="encode-asm-btn">Encode .asm → Video</button>
            <button id="encode-asm-multi-btn">Encode .asm → Multi‑Frame</button>
            <button id="test-roundtrip-btn">Test Round-trip</button>
        </div>

        <div id="progress-container"></div>
        <div id="status" class="status-display"></div>
    `;

    // Wire up event listeners
    document.getElementById('encode-btn').addEventListener('click', handleEncode);
    document.getElementById('decode-btn').addEventListener('click', handleDecode);
    document.getElementById('upload-btn').addEventListener('click', handleUpload);
    document.getElementById('download-btn').addEventListener('click', handleDownload);
    document.getElementById('video-file').addEventListener('change', handleFileSelect);
    document.getElementById('load-asm-btn').addEventListener('click', handleLoadAsm);
    document.getElementById('encode-asm-btn').addEventListener('click', handleEncodeAsm);
    document.getElementById('encode-asm-multi-btn').addEventListener('click', handleEncodeAsmMultiFrame);
    document.getElementById('test-roundtrip-btn').addEventListener('click', handleTestRoundtrip);
}

/**
 * Handle data encoding into video
 */
async function handleEncode() {
    const fileInput = document.getElementById('video-file');
    const file = fileInput.files[0];

    if (!file || !file.type.startsWith('video/')) {
        updateStatus('Please select a video file first', 'error');
        return;
    }

    if (!lastAssembledProgram) {
        updateStatus('No .asm program assembled yet - select a .asm file first', 'error');
        return;
    }

    // Validate file
    const validation = await validateFile(file);
    if (!validation.valid) {
        updateStatus(validation.error, 'error');
        return;
    }

    const progressContainer = document.getElementById('progress-container');
    const progressDiv = createProgressBar(progressContainer);
    let isCancelled = false;

    // Add cancel handler
    progressDiv.querySelector('.progress-cancel').addEventListener('click', () => {
        isCancelled = true;
        removeProgress(progressDiv);
        updateStatus('Encoding cancelled by user', 'error');
    });

    updateProgress(progressDiv, 0, 'Starting encoding process...');

    try {
        // Step 1: Extract frame from video (20%)
        updateProgress(progressDiv, 10, 'Extracting video frame...');
        if (isCancelled) return;

        const imageData = await extractFrameImageData(file, 1.0);
        updateProgress(progressDiv, 20, 'Video frame extracted successfully');

        // Step 2: Prepare data with compression and ECC (40%)
        updateProgress(progressDiv, 25, 'Compressing data...');
        if (isCancelled) return;

        const engine = new SteganographyEngine();
        const compressed = engine.compressData(lastAssembledProgram);

        updateProgress(progressDiv, 30, 'Adding error correction...');
        if (isCancelled) return;

        const withECC = engine.addErrorCorrection(compressed);
        updateProgress(progressDiv, 40, `Data prepared (${withECC.length} bytes)`);

        // Step 3: Embed data into frame (70%)
        updateProgress(progressDiv, 50, 'Embedding data into frame...');
        if (isCancelled) return;

        const embeddedImageData = await embedDataInFrame(withECC, imageData);
        updateProgress(progressDiv, 70, 'Data embedded successfully');

        // Step 4: Create modified video blob (90%)
        updateProgress(progressDiv, 80, 'Creating modified video...');
        if (isCancelled) return;

        const modifiedBlob = await createModifiedVideoBlob(embeddedImageData, file);
        updateProgress(progressDiv, 90, 'Video created successfully');

        // Step 5: Download (100%)
        updateProgress(progressDiv, 95, 'Preparing download...');
        if (isCancelled) return;

        const url = URL.createObjectURL(modifiedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'encoded_video.json';
        a.click();
        URL.revokeObjectURL(url);

        updateProgress(progressDiv, 100, 'Download started!');
        setTimeout(() => removeProgress(progressDiv), 2000);

        updateStatus(`Video encoded and downloaded! ${withECC.length} bytes embedded`, 'success');

    } catch (error) {
        removeProgress(progressDiv);
        updateStatus(`Encoding failed: ${error.message}`, 'error');
        console.error('Encoding error:', error);
    }
}

/**
 * Handle data decoding from video
 */
async function handleDecode() {
    const fileInput = document.getElementById('video-file');
    const file = fileInput.files[0];

    if (!file || !file.type.startsWith('video/')) {
        updateStatus('Please select a video file first', 'error');
        return;
    }

    // Validate file
    const validation = await validateFile(file);
    if (!validation.valid) {
        updateStatus(validation.error, 'error');
        return;
    }

    const progressContainer = document.getElementById('progress-container');
    const progressDiv = createProgressBar(progressContainer);
    let isCancelled = false;

    // Add cancel handler
    progressDiv.querySelector('.progress-cancel').addEventListener('click', () => {
        isCancelled = true;
        removeProgress(progressDiv);
        updateStatus('Decoding cancelled by user', 'error');
    });

    updateProgress(progressDiv, 0, 'Starting decoding process...');

    try {
        // Step 1: Extract frame from video (30%)
        updateProgress(progressDiv, 10, 'Extracting video frame...');
        if (isCancelled) return;

        const imageData = await extractFrameImageData(file, 1.0);
        updateProgress(progressDiv, 30, 'Video frame extracted successfully');

        // Step 2: Extract embedded data (70%)
        updateProgress(progressDiv, 40, 'Extracting embedded data...');
        if (isCancelled) return;

        const extractedData = await extractDataFromFrame(imageData);
        updateProgress(progressDiv, 70, `Data extracted (${extractedData.length} bytes)`);

        // Step 3: Load into memory (100%)
        updateProgress(progressDiv, 80, 'Loading into memory...');
        if (isCancelled) return;

        if (window.memory && typeof window.memory.loadProgram === 'function') {
            await window.memory.loadProgram(extractedData.buffer, 0x0600);
            updateProgress(progressDiv, 100, 'Loaded into memory successfully');
        } else {
            // Fallback: store globally
            window.decodedProgram = extractedData;
            window.decodedOrigin = 0x0600;
            updateProgress(progressDiv, 100, 'Stored globally successfully');
        }

        setTimeout(() => removeProgress(progressDiv), 2000);
        updateStatus(`Decoded program (${extractedData.length} bytes) loaded successfully`, 'success');

    } catch (error) {
        removeProgress(progressDiv);
        updateStatus(`Decoding failed: ${error.message}. Try checking if the video contains embedded data.`, 'error');
        console.error('Decoding error:', error);
    }
}

/**
 * Handle video upload to YouTube
 */
function handleUpload() {
    // TODO: Implement upload workflow
    console.log('Uploading video to YouTube');
    updateStatus('Uploading video... (stub)');
}

/**
 * Handle video download from YouTube
 */
function handleDownload() {
    // TODO: Implement download workflow
    console.log('Downloading video from YouTube');
    updateStatus('Downloading video... (stub)');
}

/**
 * Update status display
 * @param {string} message - Status message
 * @param {string} type - Message type ('info', 'success', 'error')
 */
function updateStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status-display ${type}`;
}

/**
 * Handle file selection (video or .asm) - supports multiple files for batch processing
 */
async function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const fileInfoDiv = document.getElementById('file-info');
    const capacityDisplayDiv = document.getElementById('capacity-display');

    fileInfoDiv.innerHTML = '';
    capacityDisplayDiv.innerHTML = '';

    // Handle multiple .asm files for batch processing
    const asmFiles = files.filter(f => f.name.endsWith('.asm'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));

    if (asmFiles.length > 0) {
        updateStatus(`Processing ${asmFiles.length} .asm file(s)...`, 'info');

        // Store all assembled programs for batch processing
        window.batchPrograms = [];

        for (let i = 0; i < asmFiles.length; i++) {
            const file = asmFiles[i];
            try {
                const text = await file.text();
                const { assemble } = await import('../assembler.js');
                const assembled = assemble(text, { origin: 0x0600 });

                window.batchPrograms.push({
                    name: file.name,
                    data: assembled,
                    origin: 0x0600
                });

                fileInfoDiv.innerHTML += `<div class="file-item">📄 ${file.name}: ${assembled.length} bytes</div>`;

            } catch (error) {
                fileInfoDiv.innerHTML += `<div class="file-item error">❌ ${file.name}: Assembly failed - ${error.message}</div>`;
                console.error(`Assembly error for ${file.name}:`, error);
            }
        }

        // Use the last successfully assembled program as the primary one
        const lastProgram = window.batchPrograms[window.batchPrograms.length - 1];
        if (lastProgram) {
            lastAssembledProgram = lastProgram.data;
            lastAssembledOrigin = lastProgram.origin;
        }

        updateStatus(`Processed ${window.batchPrograms.length} .asm file(s) successfully`, 'success');

    } else if (videoFiles.length > 0) {
        // Handle video files - show info and capacity
        for (const file of videoFiles) {
            const validation = await validateFile(file);
            fileInfoDiv.innerHTML += `<div class="file-item">🎥 ${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB</div>`;

            if (validation.capacity) {
                capacityDisplayDiv.innerHTML += `<div class="capacity-item">${file.name}: ~${validation.capacity} bytes capacity</div>`;
            } else if (!validation.valid) {
                capacityDisplayDiv.innerHTML += `<div class="capacity-item error">${file.name}: ${validation.error}</div>`;
            }
        }
        updateStatus(`${videoFiles.length} video file(s) selected`, 'info');
    }

    // Add batch processing button if multiple .asm files
    if (asmFiles.length > 1) {
        const batchBtn = document.createElement('button');
        batchBtn.id = 'batch-encode-btn';
        batchBtn.textContent = `Batch Encode ${asmFiles.length} .asm files`;
        batchBtn.addEventListener('click', handleBatchEncode);

        // Remove existing batch button if present
        const existingBatchBtn = document.getElementById('batch-encode-btn');
        if (existingBatchBtn) {
            existingBatchBtn.remove();
        }

        document.getElementById('video-controls').appendChild(batchBtn);
    }
}

/**
 * Handle loading assembled .asm into memory
 */
async function handleLoadAsm() {
    if (!lastAssembledProgram) {
        updateStatus('No .asm file assembled yet');
        return;
    }

    updateStatus('Loading .asm into memory...');
    try {
        if (window.memory && typeof window.memory.loadProgram === 'function') {
            await window.memory.loadProgram(lastAssembledProgram.buffer, lastAssembledOrigin);
            updateStatus(`Loaded ${lastAssembledProgram.length} bytes into memory at 0x${lastAssembledOrigin.toString(16).toUpperCase()}`);
        } else {
            // Fallback: store globally
            window.lastAssembledProgram = lastAssembledProgram;
            window.lastAssembledOrigin = lastAssembledOrigin;
            updateStatus(`Stored ${lastAssembledProgram.length} bytes globally (no memory.loadProgram API found)`);
        }
    } catch (error) {
        updateStatus(`Error loading into memory: ${error.message}`);
        console.error('Memory load error:', error);
    }
}

/**
 * Handle encoding assembled .asm into video
 */
async function handleEncodeAsm() {
    if (!lastAssembledProgram) {
        updateStatus('No .asm file assembled yet', 'error');
        return;
    }

    const fileInput = document.getElementById('video-file');
    const file = fileInput.files[0];

    if (!file || !file.type.startsWith('video/')) {
        updateStatus('Please select a video file first', 'error');
        return;
    }

    // Validate file
    const validation = await validateFile(file);
    if (!validation.valid) {
        updateStatus(validation.error, 'error');
        return;
    }

    const progressContainer = document.getElementById('progress-container');
    const progressDiv = createProgressBar(progressContainer);
    let isCancelled = false;

    // Add cancel handler
    progressDiv.querySelector('.progress-cancel').addEventListener('click', () => {
        isCancelled = true;
        removeProgress(progressDiv);
        updateStatus('Encoding cancelled by user', 'error');
    });

    updateProgress(progressDiv, 0, 'Starting .asm encoding process...');

    try {
        // Step 1: Extract frame from video (15%)
        updateProgress(progressDiv, 5, 'Extracting video frame...');
        if (isCancelled) return;

        const imageData = await extractFrameImageData(file, 1.0);
        updateProgress(progressDiv, 15, 'Video frame extracted successfully');

        // Step 2: Prepare data with compression and ECC (35%)
        updateProgress(progressDiv, 20, 'Compressing .asm data...');
        if (isCancelled) return;

        const engine = new SteganographyEngine();
        const compressed = engine.compressData(lastAssembledProgram);

        updateProgress(progressDiv, 25, 'Adding error correction...');
        if (isCancelled) return;

        const withECC = engine.addErrorCorrection(compressed);
        updateProgress(progressDiv, 35, `Data prepared (${withECC.length} bytes)`);

        // Step 3: Embed data into frame (60%)
        updateProgress(progressDiv, 40, 'Embedding .asm data into frame...');
        if (isCancelled) return;

        const embeddedImageData = await embedDataInFrame(withECC, imageData);
        updateProgress(progressDiv, 60, '.asm data embedded successfully');

        // Step 4: Create modified video blob (85%)
        updateProgress(progressDiv, 70, 'Creating modified video...');
        if (isCancelled) return;

        const modifiedBlob = await createModifiedVideoBlob(embeddedImageData, file);
        updateProgress(progressDiv, 85, 'Video created successfully');

        // Step 5: Download (100%)
        updateProgress(progressDiv, 95, 'Preparing download...');
        if (isCancelled) return;

        const url = URL.createObjectURL(modifiedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'asm_encoded_video.json';
        a.click();
        URL.revokeObjectURL(url);

        updateProgress(progressDiv, 100, 'Download started!');
        setTimeout(() => removeProgress(progressDiv), 2000);

        updateStatus(`.asm encoded and downloaded! ${withECC.length} bytes embedded`, 'success');

    } catch (error) {
        removeProgress(progressDiv);
        updateStatus(`Encoding failed: ${error.message}`, 'error');
        console.error('Encoding error:', error);
    }
}

/**
 * Handle testing the complete round-trip: assemble .asm -> encode -> decode -> verify
 */
async function handleTestRoundtrip() {
    if (!lastAssembledProgram) {
        updateStatus('No .asm file assembled yet - select a .asm file first', 'error');
        return;
    }

    const progressContainer = document.getElementById('progress-container');
    const progressDiv = createProgressBar(progressContainer);
    let isCancelled = false;

    // Add cancel handler
    progressDiv.querySelector('.progress-cancel').addEventListener('click', () => {
        isCancelled = true;
        removeProgress(progressDiv);
        updateStatus('Round-trip test cancelled by user', 'error');
    });

    updateProgress(progressDiv, 0, 'Starting round-trip test...');

    try {
        // Step 1: Prepare data with compression and ECC (20%)
        updateProgress(progressDiv, 5, 'Compressing data...');
        if (isCancelled) return;

        const engine = new SteganographyEngine();
        const compressed = engine.compressData(lastAssembledProgram);

        updateProgress(progressDiv, 10, 'Adding error correction...');
        if (isCancelled) return;

        const withECC = engine.addErrorCorrection(compressed);
        updateProgress(progressDiv, 20, `Data prepared (${withECC.length} bytes)`);

        // Step 2: Create test frame (30%)
        updateProgress(progressDiv, 25, 'Creating test frame...');
        if (isCancelled) return;

        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 100, 100);
        const testImageData = ctx.getImageData(0, 0, 100, 100);
        updateProgress(progressDiv, 30, 'Test frame created');

        // Step 3: Embed data (50%)
        updateProgress(progressDiv, 35, 'Embedding data...');
        if (isCancelled) return;

        const embeddedImageData = await embedDataInFrame(withECC, testImageData);
        updateProgress(progressDiv, 50, 'Data embedded successfully');

        // Step 4: Extract data (70%)
        updateProgress(progressDiv, 55, 'Extracting data...');
        if (isCancelled) return;

        const extractedData = await extractDataFromFrame(embeddedImageData);
        updateProgress(progressDiv, 70, `Data extracted (${extractedData.length} bytes)`);

        // Step 5: Verify data integrity (100%)
        updateProgress(progressDiv, 80, 'Verifying data integrity...');
        if (isCancelled) return;

        if (extractedData.length !== withECC.length) {
            updateProgress(progressDiv, 100, 'FAILED: Length mismatch');
            setTimeout(() => removeProgress(progressDiv), 3000);
            updateStatus(`FAIL: Length mismatch - expected ${withECC.length}, got ${extractedData.length}`, 'error');
            return;
        }

        updateProgress(progressDiv, 90, 'Comparing data...');
        if (isCancelled) return;

        const match = extractedData.every((byte, i) => byte === withECC[i]);
        if (match) {
            updateProgress(progressDiv, 100, 'SUCCESS: All tests passed!');
            setTimeout(() => removeProgress(progressDiv), 3000);
            updateStatus(`SUCCESS: Round-trip test passed! ${extractedData.length} bytes embedded and recovered perfectly`, 'success');
        } else {
            updateProgress(progressDiv, 100, 'FAILED: Data corruption detected');
            setTimeout(() => removeProgress(progressDiv), 3000);
            updateStatus('FAIL: Data corruption detected during round-trip', 'error');
        }

    } catch (error) {
        removeProgress(progressDiv);
        updateStatus(`Round-trip test failed: ${error.message}`, 'error');
        console.error('Round-trip test error:', error);
    }
}

/**
 * Handle batch encoding of multiple .asm files
 */
async function handleBatchEncode() {
    if (!window.batchPrograms || window.batchPrograms.length === 0) {
        updateStatus('No .asm files available for batch processing', 'error');
        return;
    }

    const fileInput = document.getElementById('video-file');
    const videoFiles = Array.from(fileInput.files).filter(f => f.type.startsWith('video/'));

    if (videoFiles.length === 0) {
        updateStatus('Please select at least one video file for batch encoding', 'error');
        return;
    }

    const progressContainer = document.getElementById('progress-container');
    const progressDiv = createProgressBar(progressContainer);
    let isCancelled = false;

    // Add cancel handler
    progressDiv.querySelector('.progress-cancel').addEventListener('click', () => {
        isCancelled = true;
        removeProgress(progressDiv);
        updateStatus('Batch encoding cancelled by user', 'error');
    });

    updateProgress(progressDiv, 0, `Starting batch encoding of ${window.batchPrograms.length} .asm files...`);

    const results = {
        successful: 0,
        failed: 0,
        errors: []
    };

    try {
        for (let i = 0; i < window.batchPrograms.length; i++) {
            if (isCancelled) return;

            const program = window.batchPrograms[i];
            const progressPercent = (i / window.batchPrograms.length) * 100;

            updateProgress(progressDiv, progressPercent, `Processing ${program.name}...`);

            try {
                // Use the first video file for encoding (can be extended to use multiple videos)
                const videoFile = videoFiles[0];

                // Validate video file
                const validation = await validateFile(videoFile);
                if (!validation.valid) {
                    results.failed++;
                    results.errors.push(`${program.name}: ${validation.error}`);
                    continue;
                }

                // Extract frame
                const imageData = await extractFrameImageData(videoFile, 1.0);

                // Prepare data
                const engine = new SteganographyEngine();
                const compressed = engine.compressData(program.data);
                const withECC = engine.addErrorCorrection(compressed);

                // Embed data
                const embeddedImageData = await embedDataInFrame(withECC, imageData);
                const modifiedBlob = await createModifiedVideoBlob(embeddedImageData, videoFile);

                // Create download link
                const url = URL.createObjectURL(modifiedBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${program.name.replace('.asm', '')}_encoded_video.json`;
                a.click();
                URL.revokeObjectURL(url);

                results.successful++;

            } catch (error) {
                results.failed++;
                results.errors.push(`${program.name}: ${error.message}`);
                console.error(`Batch encoding error for ${program.name}:`, error);
            }
        }

        updateProgress(progressDiv, 100, `Batch encoding complete!`);
        setTimeout(() => removeProgress(progressDiv), 3000);

        let statusMessage = `Batch encoding complete: ${results.successful} successful, ${results.failed} failed`;
        let statusType = results.failed === 0 ? 'success' : 'error';

        updateStatus(statusMessage, statusType);

        if (results.errors.length > 0) {
            console.log('Batch encoding errors:', results.errors);
        }

    } catch (error) {
        removeProgress(progressDiv);
        updateStatus(`Batch encoding failed: ${error.message}`, 'error');
        console.error('Batch encoding error:', error);
    }
}

/**
 * Handle encoding assembled .asm into multi-frame video
 */
async function handleEncodeAsmMultiFrame() {
    if (!lastAssembledProgram) {
        updateStatus('No .asm file assembled yet', 'error');
        return;
    }

    const progressContainer = document.getElementById('progress-container');
    const progressDiv = createProgressBar(progressContainer);
    let isCancelled = false;

    // Add cancel handler
    progressDiv.querySelector('.progress-cancel').addEventListener('click', () => {
        isCancelled = true;
        removeProgress(progressDiv);
        updateStatus('Multi-frame encoding cancelled by user', 'error');
    });

    updateProgress(progressDiv, 0, 'Starting multi-frame encoding...');

    try {
        // Step 1: Prepare data with compression and ECC (20%)
        updateProgress(progressDiv, 5, 'Compressing .asm data...');
        if (isCancelled) return;

        const engine = new SteganographyEngine();
        const compressed = engine.compressData(lastAssembledProgram);

        updateProgress(progressDiv, 10, 'Adding error correction...');
        if (isCancelled) return;

        const withECC = engine.addErrorCorrection(compressed);
        updateProgress(progressDiv, 20, `Data prepared (${withECC.length} bytes)`);

        // Step 2: Build test frames (40%)
        updateProgress(progressDiv, 25, 'Building test frames...');
        if (isCancelled) return;

        const frameCount = 3;
        const frames = [];
        for (let i = 0; i < frameCount; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = `rgb(${i * 50 % 255}, ${i * 100 % 255}, ${i * 150 % 255})`;
            ctx.fillRect(0, 0, 100, 100);
            const imageData = ctx.getImageData(0, 0, 100, 100);
            frames.push(imageData);
        }
        updateProgress(progressDiv, 40, `Built ${frameCount} test frames`);

        // Step 3: Calculate capacity and split payload (60%)
        updateProgress(progressDiv, 45, 'Calculating frame capacity...');
        if (isCancelled) return;

        const capacityPerFrame = await calculateFrameCapacity(frames[0]);
        updateProgress(progressDiv, 50, `Capacity: ${capacityPerFrame} bytes/frame`);

        updateProgress(progressDiv, 55, 'Splitting payload across frames...');
        if (isCancelled) return;

        const chunks = splitPayloadAcrossFrames(withECC, frameCount, capacityPerFrame);
        updateProgress(progressDiv, 60, `Split into ${chunks.length} chunks`);

        // Step 4: Embed across frames (80%)
        updateProgress(progressDiv, 65, 'Embedding data across frames...');
        if (isCancelled) return;

        const modifiedFrames = await embedAcrossFrames(withECC, frames);
        updateProgress(progressDiv, 80, 'Data embedded across frames');

        // Step 5: Create final video blob (100%)
        updateProgress(progressDiv, 90, 'Creating multi-frame video...');
        if (isCancelled) return;

        const modifiedBlob = await recomposeFramesToBlob(modifiedFrames, null);
        updateProgress(progressDiv, 95, 'Video created successfully');

        // Trigger download
        const url = URL.createObjectURL(modifiedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'multi-frame-encoded.json';
        a.click();
        URL.revokeObjectURL(url);

        updateProgress(progressDiv, 100, 'Download started!');
        setTimeout(() => removeProgress(progressDiv), 2000);

        updateStatus(`Multi-frame video encoded! ${withECC.length} bytes across ${frameCount} frames`, 'success');

    } catch (error) {
        removeProgress(progressDiv);
        updateStatus(`Multi-frame encoding failed: ${error.message}`, 'error');
        console.error('Multi-frame encoding error:', error);
    }
}

/**
 * Initialize video manager UI
 * @param {string} rootElementId - ID of root element for video manager UI
 */
export function initializeVideoManager(rootElementId) {
    const rootElement = document.getElementById(rootElementId);
    if (!rootElement) {
        console.warn(`Video manager root element '${rootElementId}' not found`);
        return;
    }

    // Create basic video manager controls
    const videoControls = document.getElementById('video-controls') || rootElement.querySelector('#video-controls');
    if (videoControls) {
        videoControls.innerHTML = `
            <div class="file-inputs">
                <label>Assembly File (.asm):
                    <input type="file" id="asm-file-input" accept=".asm,.txt" />
                </label>
                <label>Video File (for encoding):
                    <input type="file" id="video-file-input" accept="video/*" />
                </label>
                <label>YouTube URL (for decoding):
                    <input type="text" id="youtube-url-input" placeholder="https://youtube.com/watch?v=..." />
                </label>
            </div>
            <div class="action-buttons">
                <button id="encode-btn" disabled>Encode ASM → Video</button>
                <button id="decode-file-btn" disabled>Decode Video File</button>
                <button id="decode-youtube-btn" disabled>Decode from YouTube</button>
                <button id="load-asm-to-emulator-btn" disabled>Load ASM to Emulator</button>
            </div>
            <div id="status-display"></div>
        `;

        // Add event listeners for file inputs and buttons
        const asmInput = videoControls.querySelector('#asm-file-input');
        const videoInput = videoControls.querySelector('#video-file-input');
        const youtubeInput = videoControls.querySelector('#youtube-url-input');
        const encodeBtn = videoControls.querySelector('#encode-btn');
        const decodeFileBtn = videoControls.querySelector('#decode-file-btn');
        const decodeYouTubeBtn = videoControls.querySelector('#decode-youtube-btn');
        const loadAsmBtn = videoControls.querySelector('#load-asm-to-emulator-btn');

        // Enable/disable buttons based on file selection
        function updateButtonStates() {
            const hasAsm = asmInput.files.length > 0;
            const hasVideo = videoInput.files.length > 0;
            const hasYouTubeUrl = youtubeInput.value.trim().length > 0 && 
                                 (youtubeInput.value.includes('youtube.com') || youtubeInput.value.includes('youtu.be'));

            encodeBtn.disabled = !hasAsm || !hasVideo;
            decodeFileBtn.disabled = !hasVideo;
            decodeYouTubeBtn.disabled = !hasYouTubeUrl;
            loadAsmBtn.disabled = !hasAsm;
        }

        asmInput.addEventListener('change', updateButtonStates);
        videoInput.addEventListener('change', updateButtonStates);
        youtubeInput.addEventListener('input', updateButtonStates);

        // Add actual functionality
        encodeBtn.addEventListener('click', () => handleEncode(asmInput.files[0], videoInput.files[0]));
        decodeFileBtn.addEventListener('click', () => handleDecodeFile(videoInput.files[0]));
        decodeYouTubeBtn.addEventListener('click', () => handleDecodeYouTube(youtubeInput.value.trim()));
        loadAsmBtn.addEventListener('click', () => handleLoadAsmToEmulator(asmInput.files[0]));
    }
}

/**
 * Handle encoding assembly file into video
 * @param {File} asmFile - Assembly file to encode
 * @param {File} videoFile - Video file to embed data into
 */
async function handleEncode(asmFile, videoFile) {
    if (!asmFile || !videoFile) return;

    try {
        updateStatus('Reading assembly file...', 'info');
        const asmContent = await asmFile.text();
        
        updateStatus('Assembling code...', 'info');
        const assembled = assemble(asmContent);
        
        if (!assembled || !assembled.bytes || assembled.bytes.length === 0) {
            throw new Error('Failed to assemble code');
        }

        updateStatus('Encoding into video...', 'info');
        const stegoEngine = new SteganographyEngine();
        
        // Extract frame from video
        const frameImageData = await extractFrameImageData(videoFile, 1.0);
        
        // Create payload with metadata
        const payload = {
            type: 'imacomputerussy-asm',
            filename: asmFile.name,
            origin: assembled.origin || 0x0600,
            bytes: Array.from(assembled.bytes),
            timestamp: new Date().toISOString()
        };
        
        const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
        
        // Embed data into frame
        const modifiedFrame = embedDataInFrame(payloadBytes, frameImageData);
        
        // Create modified video
        const modifiedVideoBlob = await createModifiedVideoBlob(modifiedFrame, videoFile);
        
        // Download the result
        const url = URL.createObjectURL(modifiedVideoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `encoded-${asmFile.name.replace(/\.[^/.]+$/, "")}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        
        updateStatus(`Successfully encoded ${asmFile.name} into video! Download started.`, 'success');
        
    } catch (error) {
        updateStatus(`Encoding failed: ${error.message}`, 'error');
        console.error('Encoding error:', error);
    }
}

/**
 * Handle decoding video file
 * @param {File} videoFile - Video file to decode
 */
async function handleDecodeFile(videoFile) {
    if (!videoFile) return;

    try {
        updateStatus('Extracting frame from video...', 'info');
        const frameImageData = await extractFrameImageData(videoFile, 1.0);
        
        updateStatus('Decoding data from frame...', 'info');
        const decodedBytes = extractDataFromFrame(frameImageData);
        
        if (!decodedBytes || decodedBytes.length === 0) {
            throw new Error('No encoded data found in video');
        }
        
        // Try to parse as JSON payload
        const payloadText = new TextDecoder().decode(decodedBytes);
        const payload = JSON.parse(payloadText);
        
        if (payload.type !== 'imacomputerussy-asm') {
            throw new Error('Video does not contain VideoStorage-8 assembly data');
        }
        
        // Create downloadable assembly file
        const asmContent = `; Decoded from video: ${payload.filename}\n; Origin: $${payload.origin.toString(16)}\n; Timestamp: ${payload.timestamp}\n\n.org $${payload.origin.toString(16)}\n; Binary data: [${payload.bytes.join(', ')}]\n; TODO: Disassemble bytes back to assembly code`;
        
        const blob = new Blob([asmContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `decoded-${payload.filename}`;
        a.click();
        URL.revokeObjectURL(url);
        
        updateStatus(`Successfully decoded ${payload.filename} from video! Download started.`, 'success');
        
        // Also offer to load into emulator
        if (confirm('Would you like to load the decoded program into the emulator?')) {
            await loadBytesToEmulator(new Uint8Array(payload.bytes), payload.origin, payload.filename);
        }
        
    } catch (error) {
        updateStatus(`Decoding failed: ${error.message}`, 'error');
        console.error('Decoding error:', error);
    }
}

/**
 * Handle decoding from YouTube URL
 * @param {string} youtubeUrl - YouTube video URL
 */
async function handleDecodeYouTube(youtubeUrl) {
    if (!youtubeUrl) return;

    try {
        updateStatus('YouTube decoding is not yet implemented', 'warning');
        updateStatus('YouTube API integration requires authentication setup', 'info');
        
        // TODO: Implement YouTube video download and decoding
        // This would require:
        // 1. YouTube API setup with proper credentials
        // 2. Video download functionality (respecting YouTube ToS)
        // 3. Frame extraction from downloaded video
        // 4. Data decoding from frames
        
    } catch (error) {
        updateStatus(`YouTube decoding failed: ${error.message}`, 'error');
        console.error('YouTube decoding error:', error);
    }
}

/**
 * Handle loading assembly file directly to emulator
 * @param {File} asmFile - Assembly file to load
 */
async function handleLoadAsmToEmulator(asmFile) {
    if (!asmFile) return;

    try {
        updateStatus('Reading assembly file...', 'info');
        const asmContent = await asmFile.text();
        
        updateStatus('Assembling code...', 'info');
        const assembled = assemble(asmContent);
        
        if (!assembled || !assembled.bytes || assembled.bytes.length === 0) {
            throw new Error('Failed to assemble code');
        }

        await loadBytesToEmulator(assembled.bytes, assembled.origin || 0x0600, asmFile.name);
        
    } catch (error) {
        updateStatus(`Failed to load to emulator: ${error.message}`, 'error');
        console.error('Load to emulator error:', error);
    }
}

/**
 * Load bytes into the emulator
 * @param {Uint8Array} bytes - Bytes to load
 * @param {number} origin - Starting address
 * @param {string} filename - Original filename
 */
async function loadBytesToEmulator(bytes, origin, filename) {
    try {
        // Import debugger module to access CPU and memory
        const debuggerModule = await import('./debugger.js');
        
        if (debuggerModule.cpu && debuggerModule.memory) {
            debuggerModule.cpu.reset();
            debuggerModule.memory.loadProgram(bytes, origin);
            
            updateStatus(`Loaded ${filename} to emulator: ${bytes.length} bytes at $${origin.toString(16).toUpperCase()}`, 'success');
            
            // Trigger refresh of debugger display if available
            if (typeof debuggerModule.refreshDisplay === 'function') {
                debuggerModule.refreshDisplay();
            }
        } else {
            throw new Error('Emulator not available');
        }
    } catch (error) {
        updateStatus(`Failed to load to emulator: ${error.message}`, 'error');
        console.error('Load to emulator error:', error);
    }
}

/**
 * TODO: Implement full video manager features:
 * - File selection and validation
 * - Progress indicators
 * - Preview functionality
 * - Batch processing
 * - Error handling
 * - Settings configuration
 */

// Video Manager for emulator display (memory-mapped at 0x8000-0x9FFF)
const VIDEO_BUFFER_START = 0x8000;
const VIDEO_BUFFER_END = 0x9FFF;
const VIDEO_WIDTH = 128; // 128 pixels wide
const VIDEO_HEIGHT = 64; // 64 pixels high (8192 bytes total)
const BYTES_PER_ROW = VIDEO_WIDTH / 8; // 16 bytes per row (128 bits / 8 = 16 bytes)

let videoCanvas = null;
let ctx = null;
let memory = null;

/**
 * VideoManager class for emulator video handling
 */
export class VideoManager {
    constructor(canvasId = 'emulator-video-canvas', memoryInstance) {
        // Create or get canvas
        videoCanvas = document.getElementById(canvasId);
        if (!videoCanvas) {
            videoCanvas = document.createElement('canvas');
            videoCanvas.id = canvasId;
            videoCanvas.width = VIDEO_WIDTH;
            videoCanvas.height = VIDEO_HEIGHT;
            videoCanvas.style.border = '1px solid #00ff00';
            videoCanvas.style.backgroundColor = 'black';
            videoCanvas.style.imageRendering = 'pixelated'; // For crisp pixels
            document.body.appendChild(videoCanvas); // Append to body or specific container
        }
        ctx = videoCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; // Disable smoothing for pixel art

        memory = memoryInstance || new iMaCoMpUtERussyMemory();
    }

    /**
     * Set pixel at coordinates (x, y) to color using fillRect
     * @param {number} x - X coordinate (0-127)
     * @param {number} y - Y coordinate (0-63)
     * @param {number} color - Color value (0-255, treated as grayscale)
     */
    setPixel(x, y, color) {
        try {
            validatePixelCoordinates(x, y);
            const validatedColor = validateColor(color);

            // Convert to RGB (grayscale for simplicity)
            const pixelColor = `rgb(${validatedColor}, ${validatedColor}, ${validatedColor})`;
            
            // Use fillRect for single pixel
            ctx.fillStyle = pixelColor;
            ctx.fillRect(x, y, 1, 1);

            console.log(`Video setPixel: (${x}, ${y}) = 0x${validatedColor.toString(16)}`);
        } catch (error) {
            console.error('Video setPixel error:', error.message);
            throw error;
        }
    }

    /**
     * Update canvas from memory-mapped video buffer at 0x8000-0x9FFF
     * Assumes 128x64 monochrome display, each byte represents 8 vertical pixels
     */
    update() {
        try {
            // Clear canvas to black first
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

            // Read memory buffer
            const bufferSize = VIDEO_BUFFER_END - VIDEO_BUFFER_START + 1;
            const buffer = new Uint8Array(bufferSize);
            for (let i = 0; i < bufferSize; i++) {
                const addr = VIDEO_BUFFER_START + i;
                buffer[i] = memory.readByte(addr);
            }

            // Render pixels (monochrome: bit 0 = on, others off; simple 1bpp)
            for (let row = 0; row < VIDEO_HEIGHT; row++) {
                const byteOffset = Math.floor(row / 8); // Each byte covers 8 rows
                const bitOffset = row % 8;
                const byteAddr = byteOffset * BYTES_PER_ROW + Math.floor(row / 8) * BYTES_PER_ROW; // Simplified mapping
                if (byteAddr >= buffer.length) continue;

                const rowByte = buffer[byteAddr];
                for (let col = 0; col < VIDEO_WIDTH; col++) {
                    const bit = (rowByte >> (7 - (col % 8))) & 1; // MSB first
                    if (bit) {
                        const x = col;
                        const y = row;
                        this.setPixel(x, y, 255); // White pixel
                    }
                }
            }

            console.log('Video buffer updated from memory 0x8000-0x9FFF');
        } catch (error) {
            console.error('Video update error:', error.message);
            throw error;
        }
    }

    /**
     * Clear video display to black
     */
    clear() {
        try {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

            // Also clear memory buffer
            for (let addr = VIDEO_BUFFER_START; addr <= VIDEO_BUFFER_END; addr++) {
                memory.writeByte(addr, 0);
            }

            console.log('Video cleared to black');
        } catch (error) {
            console.error('Video clear error:', error.message);
            throw error;
        }
    }

    /**
     * Alias for update() - callable from CPU
     */
    videoUpdate() {
        return this.update();
    }

    /**
     * Get canvas element for external access
     */
    getCanvas() {
        return videoCanvas;
    }
}

// Export for backward compatibility
export function initVideoManager() {
    const controlsDiv = document.getElementById('video-controls');

    if (controlsDiv) {
        // Create enhanced controls with file info, progress, and capacity display
        controlsDiv.innerHTML = `
            <div class="control-group">
                <h3>File Selection</h3>
                <input type="file" id="video-file" accept="video/*,.asm" multiple>
                <div id="file-info" class="file-info"></div>
                <div id="capacity-display" class="capacity-display"></div>
            </div>

            <div class="control-group">
                <h3>Operations</h3>
                <button id="encode-btn">Encode Data</button>
                <button id="decode-btn">Decode Data</button>
                <button id="upload-btn">Upload to YouTube</button>
                <button id="download-btn">Download from YouTube</button>
                <button id="load-asm-btn">Load .asm → Memory</button>
                <button id="encode-asm-btn">Encode .asm → Video</button>
                <button id="encode-asm-multi-btn">Encode .asm → Multi‑Frame</button>
                <button id="test-roundtrip-btn">Test Round-trip</button>
            </div>

            <div id="progress-container"></div>
            <div id="status" class="status-display"></div>
        `;

        // Wire up event listeners for steganography features
        document.getElementById('encode-btn').addEventListener('click', handleEncode);
        document.getElementById('decode-btn').addEventListener('click', handleDecode);
        document.getElementById('upload-btn').addEventListener('click', handleUpload);
        document.getElementById('download-btn').addEventListener('click', handleDownload);
        document.getElementById('video-file').addEventListener('change', handleFileSelect);
        document.getElementById('load-asm-btn').addEventListener('click', handleLoadAsm);
        document.getElementById('encode-asm-btn').addEventListener('click', handleEncodeAsm);
        document.getElementById('encode-asm-multi-btn').addEventListener('click', handleEncodeAsmMultiFrame);
        document.getElementById('test-roundtrip-btn').addEventListener('click', handleTestRoundtrip);
    }

    // Initialize emulator video manager
    if (typeof window !== 'undefined') {
        // Assume CPU is available globally or import
        let cpuMemory = null;
        if (window.cpu && window.cpu.memory) {
            cpuMemory = window.cpu.memory;
        }
        window.videoManager = new VideoManager('emulator-video-canvas', cpuMemory);
        console.log('✅ VideoManager initialized for emulator display');
    }
}
