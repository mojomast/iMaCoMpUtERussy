/**
 * Video Frame Processing for VideoStorage-8
 * Canvas-based helpers for extracting, modifying, and recomposing video frames
 */

/**
 * Extract ImageData from a video blob using Canvas API
 * @param {Blob} videoBlob - Video file blob
 * @param {number} frameTime - Time in seconds to extract frame (default: 1.0)
 * @returns {Promise<ImageData>} ImageData of the extracted frame
 */
export async function extractFrameImageData(videoBlob, frameTime = 1.0) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.preload = 'metadata';
        video.currentTime = frameTime;

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        };

        video.onseeked = () => {
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve(imageData);
        };

        video.onerror = () => reject(new Error('Failed to load video'));

        video.src = URL.createObjectURL(videoBlob);
    });
}

/**
 * Create a new video blob from modified ImageData using WebCodecs pipeline
 * @param {ImageData|Array<ImageData>} imageData - Modified frame data (single or array)
 * @param {Blob} originalVideoBlob - Original video for metadata
 * @returns {Promise<Blob>} New video blob with embedded data
 */
export async function createModifiedVideoBlob(imageData, originalVideoBlob) {
    if (Array.isArray(imageData)) {
        // Multi-frame: use WebCodecs if available
        if (isWebCodecsSupported() && imageData.length > 0) {
            return encodeFramesToVideo(imageData, originalVideoBlob);
        } else {
            // Fallback to JSON
            const frames = imageData.map(frame => Array.from(frame.data));
            const data = {
                width: imageData[0].width,
                height: imageData[0].height,
                pixelData: frames,
                frameCount: frames.length
            };
            const jsonString = JSON.stringify(data);
            return new Blob([jsonString], { type: 'application/json' });
        }
    } else {
        // Single frame: use WebCodecs if available
        if (isWebCodecsSupported()) {
            return encodeFramesToVideo([imageData], originalVideoBlob);
        } else {
            // Fallback to JSON
            const data = {
                width: imageData.width,
                height: imageData.height,
                pixelData: Array.from(imageData.data)
            };
            const jsonString = JSON.stringify(data);
            return new Blob([jsonString], { type: 'application/json' });
        }
    }
}

/**
 * Apply steganography encoding to a video frame
 * @param {Uint8Array} data - Data to embed
 * @param {ImageData} imageData - Frame to embed into
 * @returns {ImageData} Modified frame with embedded data
 */
export function embedDataInFrame(data, imageData) {
    // Import SteganographyEngine dynamically to avoid circular dependencies
    return import('../steganography.js').then(({ SteganographyEngine }) => {
        const engine = new SteganographyEngine();
        return engine.encodeLSB(data, imageData);
    });
}

/**
 * Extract steganography data from a video frame
 * @param {ImageData} imageData - Frame to extract from
 * @returns {Uint8Array} Extracted data
 */
export function extractDataFromFrame(imageData) {
    // Import SteganographyEngine dynamically
    return import('../steganography.js').then(({ SteganographyEngine }) => {
        const engine = new SteganographyEngine();
        return engine.decodeLSB(imageData);
    });
}

/**
 * Calculate maximum embeddable data size for a video frame
 * @param {ImageData} imageData - Frame to analyze
 * @returns {number} Maximum bytes that can be embedded
 */
export function calculateFrameCapacity(imageData) {
    return import('../steganography.js').then(({ SteganographyEngine }) => {
        const engine = new SteganographyEngine();
        return engine.calculateCapacity(imageData);
    });
}

/**
 * Split payload into chunks for multi-frame embedding
 * @param {Uint8Array} payload - Data to split
 * @param {number} frameCount - Number of frames to use
 * @param {number} capacityPerFrame - Max bytes per frame
 * @returns {Array<Uint8Array>} Array of payload chunks
 */
export function splitPayloadAcrossFrames(payload, frameCount, capacityPerFrame) {
    const chunks = [];
    let start = 0;
    const totalCapacity = frameCount * capacityPerFrame;
    if (payload.length > totalCapacity) {
        throw new Error(`Payload (${payload.length} bytes) exceeds total capacity (${totalCapacity} bytes)`);
    }
    for (let i = 0; i < frameCount; i++) {
        const chunkSize = Math.min(capacityPerFrame, payload.length - start);
        if (chunkSize > 0) {
            chunks.push(payload.slice(start, start + chunkSize));
        } else {
            chunks.push(new Uint8Array(0)); // Empty chunk for unused frame
        }
        start += chunkSize;
    }
    return chunks;
}

/**
 * Embed payload chunks across multiple frames
 * @param {Uint8Array} payload - Full payload data
 * @param {Array<ImageData>} frames - Array of frames to embed into
 * @returns {Promise<Array<ImageData>>} Modified frames with embedded data
 */
export async function embedAcrossFrames(payload, frames) {
    const { SteganographyEngine } = await import('../steganography.js');
    const engine = new SteganographyEngine();

    // Calculate capacities
    const capacities = await Promise.all(frames.map(frame => engine.calculateCapacity(frame)));

    // Split payload
    const chunks = splitPayloadAcrossFrames(payload, frames.length, Math.min(...capacities));

    // Embed each chunk
    const modifiedFrames = [];
    for (let i = 0; i < frames.length; i++) {
        const chunk = chunks[i];
        if (chunk.length > 0) {
            if (chunk.length > capacities[i]) {
                throw new Error(`Insufficient capacity for frame ${i} (needed ${chunk.length}, available ${capacities[i]})`);
            }
            modifiedFrames.push(await engine.encodeLSB(chunk, frames[i]));
        } else {
            modifiedFrames.push(frames[i]); // Unmodified frame
        }
    }
    return modifiedFrames;
}

/**
 * Recompose frames into a blob (alias for multi-frame createModifiedVideoBlob)
 * @param {Array<ImageData>} modifiedFrames - Modified frames
 * @param {Blob} originalVideoBlob - Original video for metadata
 * @returns {Promise<Blob>} Blob containing multi-frame data
 */
export async function recomposeFramesToBlob(modifiedFrames, originalVideoBlob) {
    if (isWebCodecsSupported() && modifiedFrames.length > 0) {
        return encodeFramesToVideo(modifiedFrames, originalVideoBlob);
    } else {
        return createModifiedVideoBlob(modifiedFrames, originalVideoBlob);
    }
}

/**
 * Check if WebCodecs APIs are supported
 * @returns {boolean} True if VideoEncoder, VideoDecoder, EncodedVideoChunk, VideoFrame are available
 */
export function isWebCodecsSupported() {
    return typeof VideoEncoder !== 'undefined' &&
           typeof VideoDecoder !== 'undefined' &&
           typeof EncodedVideoChunk !== 'undefined' &&
           typeof VideoFrame !== 'undefined';
}

/**
 * Decode video blob into frames using canvas API
 * @param {Blob} videoBlob - Video file blob
 * @param {function} onProgress - Optional callback for progress updates (receives progress 0-1)
 * @returns {Promise<Array<ImageData>>} Array of ImageData objects from decoded frames
 */
export async function decodeVideoToFrames(videoBlob, onProgress) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.preload = 'metadata';
        video.currentTime = 0;

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const duration = video.duration;
            const framerate = 30; // Default framerate assumption
            const frameCount = Math.floor(duration * framerate);
            const frames = [];
            let currentFrame = 0;

            const nextFrame = () => {
                if (currentFrame >= frameCount) {
                    URL.revokeObjectURL(video.src);
                    resolve(frames);
                    return;
                }
                const time = currentFrame / framerate;
                video.currentTime = time;
            };

            video.onseeked = () => {
                ctx.drawImage(video, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                frames.push(imageData);
                currentFrame++;
                if (onProgress) onProgress(currentFrame / frameCount);
                nextFrame();
            };

            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('Failed to decode video'));
            };

            nextFrame();
        };

        video.src = URL.createObjectURL(videoBlob);
    });
}

/**
 * Encode frames back to video blob using canvas and MediaRecorder
 * @param {Array<ImageData>} frames - Array of ImageData to encode
 * @param {Blob} originalVideoBlob - Original video for metadata extraction
 * @param {Object} options - Encoding options
 * @param {number} options.bitrate - Bitrate in bps (default: 1Mbps)
 * @param {number} options.framerate - Framerate (default: 30fps)
 * @param {function} onProgress - Optional callback for progress updates (receives progress 0-1)
 * @returns {Promise<Blob>} New video blob in WebM format
 */
export async function encodeFramesToVideo(frames, originalVideoBlob, options = {}, onProgress) {
    const { bitrate = 1000000, framerate = 30 } = options;

    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            const width = video.videoWidth;
            const height = video.videoHeight;
            const duration = video.duration;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const stream = canvas.captureStream(framerate);
            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: bitrate
            });

            const chunks = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                URL.revokeObjectURL(video.src);
                resolve(blob);
            };

            recorder.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('Encoding failed'));
            };

            let currentFrame = 0;
            const startTime = performance.now();
            const frameDuration = 1000 / framerate;
            const totalFrames = frames.length;
            const totalDuration = (totalFrames - 1) / framerate * 1000; // Duration based on frames

            const drawFrame = () => {
                const elapsed = performance.now() - startTime;
                const expectedFrame = Math.floor(elapsed / frameDuration);
                if (expectedFrame >= totalFrames) {
                    recorder.stop();
                    return;
                }
                if (expectedFrame > currentFrame && expectedFrame < totalFrames) {
                    currentFrame = expectedFrame;
                    ctx.putImageData(frames[currentFrame], 0, 0);
                    if (onProgress) onProgress(currentFrame / totalFrames);
                }
                requestAnimationFrame(drawFrame);
            };

            recorder.start();
            drawFrame();
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load original video for metadata'));
        };

        video.src = URL.createObjectURL(originalVideoBlob);
    });
}
