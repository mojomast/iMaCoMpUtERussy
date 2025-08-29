# Troubleshooting Guide

Common issues and solutions for iMaCoMpUtERussy steganography system.

## Table of Contents

- [Quick Diagnostic](#quick-diagnostic)
- [Common Error Messages](#common-error-messages)
  - [Encoding Errors](#encoding-errors)
  - [Decoding Errors](#decoding-errors)
  - [YouTube API Errors](#youtube-api-errors)
  - [Browser Compatibility Issues](#browser-compatibility-issues)
- [Interactive Emulator Issues](#interactive-emulator-issues)
  - [UI Layout Problems](#ui-layout-problems)
  - [I/O and Terminal Issues](#io-and-terminal-issues)
  - [Assembly Loading Problems](#assembly-loading-problems)
  - [Video Graphics Issues](#video-graphics-issues)
- [Performance Issues](#performance-issues)
- [Capacity Estimation Issues](#capacity-estimation-issues)
- [Debug Procedures](#debug-procedures)
- [FAQ](#faq)

## Quick Diagnostic

Run this checklist before deep troubleshooting:

### Browser Check

```javascript
// Open browser console and paste:
console.table({
    webcodecs: typeof VideoEncoder !== 'undefined',
    fileapi: 'showOpenFilePicker' in window,
    canvas: !!document.createElement('canvas').getContext('2d'),
    video: !!document.createElement('video').canPlayType,
    esmodules: true, // If this runs, yes
    websockets: typeof WebSocket !== 'undefined'
});
```

### Memory and Performance Check

```javascript
// Check available memory
const memory = performance.memory;
if (memory) {
    console.log(`Heap used: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`);
    console.log(`Heap total: ${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`);
    console.log(`Heap limit: ${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`);
} else {
    console.log('Memory info not available in this browser');
}
```

### Network Test

```bash
# Test connectivity to YouTube
curl -I https://www.youtube.com/get_video_info?video_id=dQw4w9WgXcQ

# Test localhost server
curl -I http://localhost:8000
```

## Common Error Messages

### Encoding Errors

#### "Insufficient capacity" / "Data too large"

**Symptoms:**
- Encoding fails with capacity error
- Progress bar stops at 30-40%
- Large .asm files fail while small ones succeed

**Solutions:**

1. **Check file size vs. capacity**
   ```javascript
   // Get actual capacity
   const frame = await extractFrameImageData(videoFile, 1.0);
   const engine = new SteganographyEngine();
   const capacity = engine.calculateCapacity(frame);

   // Compare with your data size
   console.log(`Frame capacity: ${capacity} bytes`);
   console.log(`File size: ${assemblyFile.size} bytes`);
   ```

2. **Compress data automatically**
   ```javascript
   const engine = new SteganographyEngine();
   const data = new Uint8Array(await assemblyFile.arrayBuffer());
   const compressed = engine.compressData(data);

   console.log(`Original: ${data.length} bytes`);
   console.log(`Compressed: ${compressed.length} bytes`);
   console.log(`Compression ratio: ${(compressed.length / data.length * 100).toFixed(1)}%`);
   ```

3. **Use larger video or multiple frames**
   ```
   HD (1280x720): ~35KB capacity per frame
   Full HD (1920x1080): ~75KB capacity per frame
   4K (3840x2160): ~300KB capacity per frame
   ```

4. **Split large files**
   ```bash
   # Split large .asm file into smaller chunks
   split -b 20k large.asm chunk_
   # Encode each chunk separately
   ```

#### "Invalid embedded length"

**Symptoms:**
- Decoding fails with negative or invalid length
- Extracted data is garbage
- Console shows "Invalid payload length"

**Solutions:**

1. **Verify video integrity**
   - Confirm the video contains embedded data
   - Check if video was transcoded (loses steganography data)
   - Try different frame timestamps

2. **Check for video compression artifacts**
   ```javascript
   // Test with different video formats
   const supportedFormats = [
       'video/mp4; codecs="avc1.42E01E"',
       'video/webm; codecs="vp8, vorbis"',
       'video/mp4; codecs="hvc1"'
   ];

   supportedFormats.forEach(format => {
       const supported = document.createElement('video').canPlayType(format);
       console.log(`${format}: ${supported}`);
   });
   ```

3. **Use lossless compression**
   ```javascript
   // Configure engine for lossless mode
   const losslessEngine = new SteganographyEngine({
       autoCompress: false  // Disable compression to avoid artifacts
   });
   ```

### Decoding Errors

#### "Cannot decode LSB from image"

**Symptoms:**
- "No embedded data found" error
- Decoded data is empty array
- Frame extraction succeeds but decoding fails

**Debug Steps:**

1. **Verify LSB data presence**
   ```javascript
   const frame = await extractFrameImageData(videoFile);
   const dataView = new Uint8Array(frame.data.buffer);

   // Check for LSB patterns (should see variation in LSB if data embedded)
   let lsbSum = 0;
   for (let i = 0; i < 1000; i += 4) {
       lsbSum += dataView[i] & 1;  // Red channel LSB
   }
   console.log(`LSB variation: ${lsbSum}/250 possible`);
   ```

2. **Test with multiple frames**
   ```javascript
   // Try different frame timestamps
   const timestamps = [0.1, 0.5, 1.0, 2.0, 5.0];
   for (const time of timestamps) {
       try {
           const frame = await extractFrameImageData(videoFile, time);
           const engine = new SteganographyEngine();
           const data = engine.decodeLSB(frame);
           if (data.length > 0) {
               console.log(`Success at ${time}s: ${data.length} bytes`);
               break;
           }
       } catch (error) {
           console.log(`Frame ${time}s: ${error.message}`);
       }
   }
   ```

3. **Check video resolution compatibility**
   ```javascript
   const video = document.createElement('video');
   await new Promise(resolve => {
       video.onloadedmetadata = () => {
           const resolution = `${video.videoWidth}x${video.videoHeight}`;
           console.log(`Video resolution: ${resolution}`);
           resolve();
       };
       video.src = URL.createObjectURL(videoFile);
   });
   ```

#### "Data corruption detected"

**Symptoms:**
- Decoded data is corrupted
- ECC validation fails
- Round-trip tests fail

**Causes and Solutions:**

1. **Video compression artifacts**
   ```bash
   # Check video codec information
   ffprobe -v quiet -print_format json -show_format -show_streams input.mp4

   # Recommended codecs for minimal artifacting:
   # MP4: H.264 High Profile
   # WebM: VP9 lossless
   ```

2. **Insufficient ECC symbols**
   ```javascript
   // Try with more ECC symbols
   const robustEngine = new SteganographyEngine({
       eccSymbols: 20  // Increase from default 10
   });

   // Test ECC effectiveness
   const testData = new Uint8Array(100);
   for (let i = 0; i < testData.length; i++) {
       testData[i] = i;
   }

   const withECC = robustEngine.addErrorCorrection(testData);
   console.log(`ECC overhead: ${(withECC.length - testData.length) / testData.length * 100}%`);
   ```

3. **Frame alignment issues**
   ```javascript
   // Ensure same frame used for encode/decode
   const REFERENCE_FRAME_TIME = 1.0;  // Always use same timestamp
   ```

### YouTube API Errors

#### "Authentication required"

**Symptoms:**
- Upload/download buttons show login required
- OAuth popup doesn't appear
- Token expired errors

**Solution Steps:**

1. **Refresh OAuth tokens**
   ```javascript
   // Force token refresh
   await platformManager.authenticate();
   ```

2. **Check OAuth configuration**
   ```bash
   # Verify Google Cloud Console settings:
   # 1. YouTube Data API v3 enabled
   # 2. OAuth 2.0 client configured
   # 3. Redirect URI matches: http://localhost:8000
   # 4. Scopes include youtube.upload and youtube.readonly
   ```

3. **Clear browser storage**
   ```javascript
   // Clear stored tokens
   sessionStorage.removeItem('youtube_access_token');
   sessionStorage.removeItem('youtube_refresh_token');
   sessionStorage.removeItem('youtube_token_expiry');

   // Then re-authenticate
   await platformManager.authenticate();
   ```

#### "quotaExceeded"

**Symptoms:**
- Upload/download fails
- Error: "YouTube API quota exceeded"
- Works after period of time

**Solutions:**

1. **Check usage status**
   ```bash
   # YouTube API Quotas:
   # Default: 10,000 units/day
   # Upload: 1600 units per upload
   # Download: 1 unit per request
   # Metadata: 2 units per request
   ```

2. **Implement exponential backoff**
   ```javascript
   function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

   async function retryWithBackoff(operation, maxRetries = 3) {
       for (let i = 0; i < maxRetries; i++) {
           try {
               return await operation();
           } catch (error) {
               if (error.message.includes('quotaExceeded') && i < maxRetries - 1) {
                   const delayMs = Math.pow(2, i) * 1000; // 1s, 2s, 4s
                   console.log(`Quota exceeded, retrying in ${delayMs}ms...`);
                   await delay(delayMs);
               } else {
                   throw error;
               }
           }
       }
   }
   ```

3. **Request quota increase**
   - Go to Google Cloud Console
   - APIs & Services → YouTube Data API v3 → Quotas
   - Request increase (requires billing enabled)

#### "Video upload failed"

**Symptoms:**
- Upload progresses then fails
- HTTP 4xx/5xx errors
- Resumable upload stalls

**Debug Steps:**

1. **Check file size limits**
   ```bash
   # YouTube limits:
   # Maximum file size: 2GB (unlisted/private)
   # Minimum file size: 0 bytes (must have content)
   # Recommended chunk size: 256KB
   ```

2. **Verify video format**
   ```javascript
   // Check MIME type
   const validTypes = [
       'video/mp4',
       'video/webm',
       'video/quicktime',
       'video/x-msvideo'
   ];

   if (!validTypes.includes(videoFile.type)) {
       console.warn(`Unsupported type: ${videoFile.type}`);
   }
   ```

3. **Network connectivity test**
   ```bash
   # Test upload endpoint
   curl -X POST \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"snippet":{"title":"Test"}}' \
     https://www.googleapis.com/youtube/v3/videos?uploadType=resumable&part=snippet,status
   ```

### Browser Compatibility Issues

#### "VideoEncoder/Decoder undefined"

**Symptoms:**
- WebCodecs API not available
- Fallback to JSON but limited functionality
- Performance warnings in console

**Solutions:**

1. **Update browser**
   ```
   Chrome: Version 94 or later (best support)
   Edge: Version 94 or later
   Firefox: Version 93+ (partial support)
   ```

2. **Enable experimental features**
   ```
   Chrome://flags → #enable-experimental-web-platform-features
   Chrome://flags → #enable-webcodecs
   ```

3. **Use polyfill fallback**
   ```javascript
   // Detect and warn about missing features
   if (typeof VideoEncoder === 'undefined') {
       alert('WebCodecs not supported. Video processing will be slower.');
   }
   ```

## Interactive Emulator Issues

### UI Layout Problems

#### Interface stretches horizontally when loading samples

**Symptoms:**
- Console output extends beyond screen width
- Terminal panels become too wide to fit on screen
- Horizontal scrolling required after loading assembly programs

**Solutions:**

1. **Check console message length**
   ```javascript
   // Console messages are now automatically truncated
   // Long assembly output is summarized as "Sample assembled: X bytes"
   ```

2. **Verify text wrapping CSS**
   ```css
   #terminal-display, #console-display {
       white-space: pre-wrap;
       word-wrap: break-word;
       overflow-wrap: break-word;
       overflow-x: hidden;
   }
   ```

3. **Use collapsible panels**
   - Click panel headers to collapse/expand sections
   - Adjust panel sizes as needed for your screen

#### Panels too small to view content

**Symptoms:**
- Need to scroll within terminal/console panels
- Memory viewer cut off
- Cannot see full program output

**Solutions:**

1. **Adjust panel heights** (panels now sized optimally)
   - Console: 300px max height
   - Memory viewer: 500px max height
   - Terminal: Automatically sized for content

2. **Use panel collapse feature**
   - Collapse unused panels to give more space to active ones
   - Toggle panels on/off as needed

### I/O and Terminal Issues

#### Echo program not responding to input

**Symptoms:**
- Type in terminal but nothing appears
- Program seems to hang
- No response from interactive programs

**Solutions:**

1. **Check I/O listener setup**
   ```javascript
   // Only one write listener should be active per I/O register
   // Duplicate listeners have been removed
   ```

2. **Verify memory-mapped I/O addresses**
   ```
   $F0 (IO_INPUT): Input buffer
   $F1 (IO_OUTPUT): Output buffer  
   $F2 (IO_STATUS): Status flags
   ```

3. **Reset and reload**
   - Click "Reset CPU" button
   - Reload the echo.asm sample
   - Try typing single characters first

#### Input/Output corruption

**Symptoms:**
- Characters appear incorrectly
- Input buffer gets stuck
- Terminal shows garbled text

**Solutions:**

1. **Clear input buffer**
   ```javascript
   // Input buffer is automatically managed
   // Send ESC character to reset
   ```

2. **Check character encoding**
   - ASCII values 32-126 are printable
   - CR (13) ends input lines
   - ESC (27) typically exits programs

### Assembly Loading Problems

#### Sample programs fail to load

**Symptoms:**
- "Failed to load" error messages
- Assembly produces no bytes
- Programs don't run after loading

**Solutions:**

1. **Check file format**
   ```
   Files must be in /samples/ directory
   Must have .asm extension
   Must contain valid assembly syntax
   ```

2. **Verify origin directive**
   ```assembly
   .org $0600    ; Program loads at this address
   LDA #$48      ; First instruction
   ```

3. **Check assembly syntax**
   - All labels must be defined
   - Instructions must be valid iMaCoMpUtERussy opcodes
   - Memory addresses must be in valid ranges

### Video Graphics Issues

#### Graphics demo shows no output

**Symptoms:**
- Video display panel is black
- Graphics program runs but nothing appears
- VUP instruction doesn't update display

**Solutions:**

1. **Expand Video Display panel**
   ```
   Click "📺 Video Display" panel header to expand
   Panel may be collapsed by default
   ```

2. **Check video instructions**
   ```assembly
   ; Correct sequence
   LDA #$01      ; Load color
   STA $0200     ; Write to video buffer
   VUP           ; Update display (required!)
   ```

3. **Verify video buffer addresses**
   ```
   Valid range: $0200-$05FF
   Display area: $0200-$02FF (first 768 bytes)
   Address formula: $0200 + (row × 32) + column
   ```

#### Colors appear wrong

**Symptoms:**
- Expected colors don't appear
- All pixels show as black
- Random colors displayed

**Solutions:**

1. **Check color values**
   ```
   Valid colors: $00=Black, $01=Green, $02=Yellow, $03=Red
   Values > $03 will wrap around
   ```

2. **Verify pixel address calculation**
   ```assembly
   ; For pixel at row 12, column 16:
   ; Address = $0200 + (12 × 32) + 16 = $0200 + $180 + $10 = $0390
   LDA #$01
   STA $0390
   VUP
   ```

#### Video instructions not recognized

**Symptoms:**
- "Unknown mnemonic: VST" errors
- "Unknown mnemonic: VUP" errors
- "Unknown mnemonic: VDL" errors

**Solutions:**

1. **Use correct instruction syntax**
   ```assembly
   VST #$190     ; Store A to video buffer offset $190
   VUP           ; Update display (no operand)
   VDL #$3C      ; Delay 60 frames (immediate operand)
   ```

2. **Check addressing modes**
   ```
   VST requires immediate addressing (#)
   VUP is implied addressing (no operand)
   VDL requires immediate addressing (#)
   ```

#### Register operation errors

**Symptoms:**
- "Unknown mnemonic: INX" errors
- "Unknown mnemonic: CPX" errors
- Increment/decrement operations not working

**Solutions:**

1. **Use correct register operations**
   ```assembly
   INX           ; Increment X register
   INY           ; Increment Y register
   DEX           ; Decrement X register
   DEY           ; Decrement Y register
   CPX #$10      ; Compare X with immediate value
   CPY #$20      ; Compare Y with immediate value
   ```

2. **Check flags after operations**
   ```
   INX/INY/DEX/DEY set Zero and Negative flags
   CPX/CPY set Zero, Negative, and Carry flags
   ```

## Performance Issues

### Slow Encoding/Decoding

**Symptoms:**
- Encoding takes > 30 seconds
- Browser becomes unresponsive
- Memory usage spikes

**Optimization Strategies:**

1. **Enable hardware acceleration**
   ```javascript
   // Check hardware acceleration
   const canvas = document.createElement('canvas');
   const gl = canvas.getContext('webgl');
   const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

   if (debugInfo) {
       console.log('Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
       console.log('Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
   }
   ```

2. **Reduce video resolution for testing**
   ```javascript
   // Lower resolution for faster processing
   const MAX_PROCESSING_RESOLUTION = 1280 * 720; // HD ready
   ```

3. **Increase chunk sizes**
   ```javascript
   // Larger chunks = fewer operations
   const OPTIMAL_CHUNK_SIZE = 512 * 1024; // 512KB
   ```

### Memory Leaks

**Detection:**
```javascript
// Monitor memory usage
setInterval(() => {
    if (performance.memory) {
       console.log(`Memory: ${performance.memory.usedJSHeapSize / 1024 / 1024}MB`);
    }
}, 5000);
```

**Prevention:**
```javascript
// Clean up resources
function cleanupResources() {
    // Revoke object URLs
    if (videoUrl) URL.revokeObjectURL(videoUrl);

    // Clear large arrays
    if (frameData) frameData.length = 0;

    // Remove event listeners
    videoElement.removeEventListener('loadeddata', onLoad);

    // Force garbage collection
    if (window.gc) window.gc();
}
```

### YouTube Upload Speed

**Expected Performance:**
- Small files: < 10 seconds
- Large files: 2-5 minutes
- 1GB files: 10-15 minutes

**Speed Optimization:**
```javascript
// Use optimal chunk size
const CHUNK_SIZE = 256 * 1024; // 256KB (YouTube recommended)

// Enable resumable upload
const uploadOptions = {
    chunkSize: CHUNK_SIZE,
    resume: true
};
```

## Capacity Estimation Issues

### Inaccurate Capacity Calculations

**Symptoms:**
- "Insufficient capacity" despite calculations showing enough space
- Success rate varies between similar videos

**Factors Affecting Capacity:**

1. **Video compression artifacts**
   ```javascript
   // Test actual usable capacity
   async function testRealCapacity(videoFile, testData) {
       const engine = new SteganographyEngine();
       const frame = await extractFrameImageData(videoFile);

       try {
           const embedded = engine.encodeLSB(testData, frame);
           const recovered = engine.decodeLSB(embedded);
           return recovered.length === testData.length;
       } catch (error) {
           return false;
       }
   }
   ```

2. **Color space and bit depth**
   ```javascript
   // Check video pixel format
   function analyzeVideoFrame(frame) {
       const data = frame.data;
       const pixels = data.length / 4;

       let rCount = 0, gCount = 0, bCount = 0;
       for (let i = 0; i < pixels; i++) {
           if (data[i * 4] & 1) rCount++;     // Red LSB
           if (data[i * 4 + 1] & 1) gCount++; // Green LSB
           if (data[i * 4 + 2] & 1) bCount++; // Blue LSB
       }

       console.log(`Red LSB variation: ${(rCount / pixels * 100).toFixed(1)}%`);
       console.log(`Green LSB variation: ${(gCount / pixels * 100).toFixed(1)}%`);
       console.log(`Blue LSB variation: ${(bCount / pixels * 100).toFixed(1)}%`);
   }
   ```

### Estimating for Multiple Frames

**Multi-frame capacity formula:**
```
Total capacity = Σ(frame_capacity) - overhead_per_frame
Overhead per frame = 4 bytes (length header) + fragments_metadata
```

**Estimation script:**
```javascript
function estimateMultiFrameCapacity(frames, dataSize) {
    const engine = new SteganographyEngine();
    const capacities = frames.map(f => engine.calculateCapacity(f));

    const avgCapacity = capacities.reduce((a, b) => a + b, 0) / capacities.length;
    const overheadPerFrame = 4; // length header
    const numFramesNeeded = Math.ceil(dataSize / (avgCapacity - overheadPerFrame));

    console.log(`Average capacity per frame: ${avgCapacity} bytes`);
    console.log(`Frames needed: ${numFramesNeeded}`);
    console.log(`Efficiency: ${(dataSize / (numFramesNeeded * avgCapacity) * 100).toFixed(1)}%`);

    return { avgCapacity, numFramesNeeded };
}
```

## Debug Procedures

### Creating Debug Logs

```javascript
// Enable verbose logging
const DEBUG_MODE = true;

function debugLog(message, data) {
    if (DEBUG_MODE) {
        console.group(`🔍 ${message}`);
        if (data) console.table(data);
        console.groupEnd();
    }
}

// Use throughout application
debugLog('Starting encoding process', {
    fileSize: file.size,
    videoResolution: `${video.videoWidth}x${video.videoHeight}`,
    timestamp: Date.now()
});
```

### Round-trip Testing

```javascript
async function testRoundTrip(originalData, videoFile) {
    const engine = new SteganographyEngine();
    const startTime = performance.now();

    try {
        // Step 1: Encode
        const frame = await extractFrameImageData(videoFile);
        const compressed = engine.compressData(originalData);
        const withECC = engine.addErrorCorrection(compressed);
        const embeddedFrame = engine.encodeLSB(withECC, frame);

        // Step 2: Create video blob
        const tempVideoBlob = await createModifiedVideoBlob(embeddedFrame, videoFile);

        // Step 3: Decode
        const decodedFrame = await extractFrameImageData(tempVideoBlob);
        const extractedData = engine.decodeLSB(decodedFrame);
        const corrected = engine.validateData(extractedData);
        const finalData = engine.decompressData(corrected);

        // Step 4: Verify
        const success = finalData.length === originalData.length &&
                       finalData.every((byte, i) => byte === originalData[i]);

        const endTime = performance.now();
        const duration = endTime - startTime;

        return {
            success,
            duration: `${duration.toFixed(2)}ms`,
            originalSize: originalData.length,
            finalSize: finalData.length,
            compressionRatio: (compressed.length / originalData.length).toFixed(2)
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}
```

### Collecting System Information

```javascript
function collectSystemInfo() {
    return {
        browser: {
            name: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled
        },
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
        },
        memory: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        } : null,
        timing: {
            navigation: performance.getEntriesByType('navigation')[0],
            timing: performance.timing
        },
        features: {
            webcodecs: typeof VideoEncoder !== 'undefined',
            webgl: !!document.createElement('canvas').getContext('webgl'),
            websockets: typeof WebSocket !== 'undefined',
            serviceWorker: 'serviceWorker' in navigator
        }
    };
}
```

## FAQ

### Q: Why does encoding fail for large files?
**A:** Video frame capacity is limited (typically 30-70KB). Use compression, split large files, or use higher resolution videos.

### Q: Can I use any video format?
**A:** Most modern formats work, but MP4 with H.264 is most reliable. Avoid heavily compressed or low-quality videos.

### Q: Is steganography data permanent?
**A:** Yes, but data may be lost if video is re-encoded or processed with lossy compression.

### Q: How do I debug failed decodings?
**A:** Use the debug procedures above. Check frame alignment, video integrity, and error correction settings.

### Q: Can mobile browsers run iMaCoMpUtERussy?
**A:** Yes, Chrome Mobile 94+ has full support. Performance may be slower due to hardware limitations.

### Q: Is my data secure?
**A:** Basic steganography provides obscurity, not encryption. Add encryption before embedding for security.

---

Next: [Setup & Deployment](SETUP_DEPLOYMENT.md) | [Developer API](DEVELOPER_API.md) | [Video Embedding Guide](VIDEO_EMBEDDING_GUIDE.md)