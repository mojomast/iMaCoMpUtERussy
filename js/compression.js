/**
 * Compression module for VideoStorage-8
 * Implements LZ77 compression algorithm optimized for assembly program compression
 */

/**
 * LZ77 Compression/Decompression implementation
 * Uses sliding window approach with length/distance encoding
 */
export class LZ77Compressor {
    constructor(windowSize = 4096, minMatchLength = 3, maxMatchLength = 258) {
        this.windowSize = windowSize;
        this.minMatchLength = minMatchLength;
        this.maxMatchLength = maxMatchLength;
    }

    /**
     * Find the longest match for a sequence starting at position
     * @param {Uint8Array} data - Input data
     * @param {number} pos - Current position
     * @param {number} windowStart - Start of sliding window
     * @returns {Object} Match result {distance, length, nextPos}
     */
    findLongestMatch(data, pos, windowStart) {
        let bestDistance = 0;
        let bestLength = 0;
        let searchStart = Math.max(windowStart, pos - this.windowSize);

        // Try different window positions
        for (let i = searchStart; i < pos; i++) {
            let length = 0;
            let maxPossibleLength = Math.min(this.maxMatchLength, data.length - pos);

            // Count matching bytes
            while (length < maxPossibleLength && data[i + length] === data[pos + length]) {
                length++;
            }

            // Update best match if this is longer
            if (length >= this.minMatchLength && length > bestLength) {
                bestDistance = pos - i;
                bestLength = length;
            }
        }

        if (bestLength >= this.minMatchLength) {
            return {
                distance: bestDistance,
                length: bestLength,
                nextPos: pos + bestLength
            };
        }

        // No match found, return literal
        return {
            distance: 0,
            length: 0,
            nextPos: pos + 1
        };
    }

    /**
     * Compress data using LZ77 algorithm
     * @param {Uint8Array} data - Data to compress
     * @returns {Uint8Array} Compressed data
     */
    compress(data) {
        if (data.length === 0) return new Uint8Array(0);

        const output = [];
        let pos = 0;

        while (pos < data.length) {
            const match = this.findLongestMatch(data, pos, Math.max(0, pos - this.windowSize));

            if (match.distance > 0) {
                // Encode as length/distance pair
                const distance = match.distance;
                const length = match.length;

                // Simple encoding: match flag + length byte + distance bytes
                output.push(0xFF); // Match flag
                output.push(length);
                output.push(distance & 0xFF);
                if (distance > 255) {
                    output.push(distance >> 8);
                }

                pos = match.nextPos;
            } else {
                // Literal byte
                output.push(data[pos]);
                pos++;
            }
        }

        return new Uint8Array(output);
    }

    /**
     * Decompress LZ77 compressed data
     * @param {Uint8Array} compressedData - Compressed data
     * @returns {Uint8Array} Decompressed data
     */
    decompress(compressedData) {
        if (compressedData.length === 0) return new Uint8Array(0);

        const output = [];
        let pos = 0;

        while (pos < compressedData.length) {
            const byte = compressedData[pos++];

            if (byte === 0xFF) {
                // Match: length byte + distance bytes
                const length = compressedData[pos++];
                const distance = compressedData[pos++];

                // Handle 2-byte distance if needed
                let fullDistance = distance;
                if (distance === 0xFF && pos < compressedData.length) {
                    fullDistance = (compressedData[pos++] << 8) | compressedData[pos++];
                }

                // Copy from output buffer
                const copyStart = output.length - fullDistance;
                for (let i = 0; i < length; i++) {
                    if (copyStart + i >= 0 && copyStart + i < output.length) {
                        output.push(output[copyStart + i]);
                    } else {
                        // Invalid copy - this shouldn't happen with correct compression
                        output.push(0);
                    }
                }
            } else {
                // Literal byte
                output.push(byte);
            }
        }

        return new Uint8Array(output);
    }
}

/**
 * Convenience functions for easy integration
 */

/**
 * Compress data using LZ77 algorithm
 * @param {Uint8Array} data - Data to compress
 * @param {Object} options - Compression options
 * @returns {Uint8Array} Compressed data
 */
export function compressData(data, options = {}) {
    const compressor = new LZ77Compressor(
        options.windowSize || 4096,
        options.minMatchLength || 3,
        options.maxMatchLength || 258
    );
    return compressor.compress(data);
}

/**
 * Decompress LZ77 compressed data
 * @param {Uint8Array} compressedData - Compressed data
 * @param {Object} options - Decompression options
 * @returns {Uint8Array} Decompressed data
 */
export function decompressData(compressedData, options = {}) {
    const compressor = new LZ77Compressor(
        options.windowSize || 4096,
        options.minMatchLength || 3,
        options.maxMatchLength || 258
    );
    return compressor.decompress(compressedData);
}

/**
 * Calculate compression ratio
 * @param {Uint8Array} original - Original data
 * @param {Uint8Array} compressed - Compressed data
 * @returns {number} Compression ratio (compressed/original)
 */
export function getCompressionRatio(original, compressed) {
    if (original.length === 0) return 0;
    return compressed.length / original.length;
}

/**
 * Estimate if data is worth compressing
 * @param {Uint8Array} data - Data to analyze
 * @returns {boolean} True if compression is likely beneficial
 */
export function shouldCompress(data) {
    if (data.length < 100) return false; // Too small to benefit

    // Simple heuristic: check for repetitive patterns
    const sampleSize = Math.min(256, data.length);
    const uniqueBytes = new Set();

    for (let i = 0; i < sampleSize; i++) {
        uniqueBytes.add(data[i]);
    }

    // If low entropy (few unique bytes), compression likely beneficial
    return uniqueBytes.size < sampleSize * 0.7;
}
