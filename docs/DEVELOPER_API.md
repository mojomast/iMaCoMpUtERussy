# iMaCoMpUtERussy Developer API Reference

Complete API documentation for iMaCoMpUtERussy's emulator, interactive terminal, and steganography system components.

## Table of Contents

- [Interactive Emulator API](#interactive-emulator-api)
   - [CPU Emulation](#cpu-emulation)
   - [Memory System](#memory-system)
   - [Assembly System](#assembly-system)
   - [Interactive Terminal](#interactive-terminal)
   - [Interrupt System](#interrupt-system)
- [MCP Server API](#mcp-server-api)
   - [Video API Endpoints](#video-api-endpoints)
   - [CPU Control API](#cpu-control-api)
   - [Queue Management Consolidation](#queue-management-consolidation)
   - [Validation](#validation)
- [SteganographyEngine API](#steganographyengine-api)
   - [Constructor](#constructor)
   - [Core Methods](#core-methods)
   - [Compression & ECC](#compression--ecc)
   - [Capacity Estimation](#capacity-estimation)
- [PlatformManager API](#platformmanager-api)
   - [Authentication](#authentication)
   - [Video Upload](#video-upload)
   - [Video Download](#video-download)
   - [Rate Limiting](#rate-limiting)
- [VideoFrames API](#videoframes-api)
   - [Frame Processing](#frame-processing)
   - [Multi-Frame Operations](#multi-frame-operations)
   - [Encoding & Decoding](#encoding--decoding)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Interactive Emulator API

The core emulation system with interactive capabilities.

### CPU Emulation

```javascript
import { iMaCoMpUtERussyCPU } from './js/cpu.js';

// Create CPU instance
const cpu = new iMaCoMpUtERussyCPU({ memory: memoryInstance });

// CPU control methods
cpu.reset();              // Reset to initial state
cpu.step();               // Execute one instruction
cpu.run(maxSteps);        // Execute multiple instructions

// CPU state access
console.log(cpu.PC);      // Program Counter
console.log(cpu.A);       // Accumulator
console.log(cpu.X);       // X Register  
console.log(cpu.Y);       // Y Register
console.log(cpu.running); // Execution status
```

### Memory System

```javascript
import { iMaCoMpUtERussyMemory } from './js/memory.js';

// Create memory instance
const memory = new iMaCoMpUtERussyMemory();

// Basic memory operations
memory.writeByte(address, value);
const value = memory.readByte(address);
memory.writeWord(address, word);
const word = memory.readWord(address);

// Program loading
memory.loadProgram(startAddress, byteArray);

// I/O monitoring
memory.addWriteListener((address, value) => {
    console.log(`Write to $${address.toString(16)}: $${value.toString(16)}`);
});
```

### Assembly System

```javascript
import { assemble } from './js/assembler.js';

// Assemble source code
const sourceCode = `
.org $0600
LDA #$42
STA $00
HLT
`;

const machineCode = assemble(sourceCode);
// Returns Uint8Array with assembled bytes
```

### iMaCoMpUtERussy Instruction Set

The iMaCoMpUtERussy CPU implements a 6502-inspired instruction set with modern enhancements.

#### Data Transfer Instructions
- **LDA** - Load Accumulator: `LDA #$42`, `LDA $00`, `LDA $1000`
- **LDX** - Load X Register: `LDX #$42`, `LDX $00`, `LDX $1000`
- **LDY** - Load Y Register: `LDY #$42`, `LDY $00`, `LDY $1000`
- **STA** - Store Accumulator: `STA $00`, `STA $1000`
- **STX** - Store X Register: `STX $00`, `STX $1000`
- **STY** - Store Y Register: `STY $00`, `STY $1000`

#### Arithmetic Instructions
- **ADC** - Add with Carry: `ADC #$42`, `ADC $1000`
- **SBC** - Subtract with Carry: `SBC #$42`
- **INC** - Increment Memory: `INC $00`, `INC $1000`
- **DEC** - Decrement Memory: `DEC $00`, `DEC $1000`

#### Logical Instructions
- **AND** - Logical AND: `AND #$42`, `AND $1000`
- **ORA** - Logical OR: `ORA #$42`
- **EOR** - Exclusive OR: `EOR #$42`

#### Comparison Instructions
- **CMP** - Compare Accumulator: `CMP #$42`, `CMP $00`, `CMP $1000`, `CMP $00,X`, `CMP ($00),Y`, `CMP $1000,X`, `CMP $1000,Y`

#### Control Flow Instructions
- **JMP** - Jump: `JMP $1000`
- **BEQ** - Branch if Equal: `BEQ label`
- **BNE** - Branch if Not Equal: `BNE label`  
- **BCS** - Branch if Carry Set: `BCS label`

#### Stack Instructions
- **PHA** - Push Accumulator: `PHA`
- **PLA** - Pull Accumulator: `PLA`

#### Special Instructions
- **HLT** - Halt execution: `HLT`

#### Video Storage Extensions
- **VLD** - Video Load: `VLD #$00` (load video block)
- **VST** - Video Store: `VST #$00` (store video block)
- **VUP** - Video Upload: `VUP` (upload to platform)
- **VDL** - Video Download: `VDL #$10` (download frames)

#### Addressing Modes
- **Immediate**: `#$42` - Use literal value
- **Zero Page**: `$00` - Address in zero page (0-255)
- **Absolute**: `$1000` - 16-bit address
- **Zero Page,X**: `$00,X` - Zero page address + X register
- **Absolute,X**: `$1000,X` - Absolute address + X register
- **Absolute,Y**: `$1000,Y` - Absolute address + Y register
- **Indirect,Y**: `($00),Y` - Indirect zero page + Y register

### Interactive Terminal

The terminal system uses memory-mapped I/O at these addresses:

- **$F0**: Input register (read user input)
- **$F1**: Output register (write to terminal)  
- **$F2**: Status register (bit 0 = input ready)

```javascript
// Example: Send text to terminal from JavaScript
function sendToTerminal(text) {
    for (let i = 0; i < text.length; i++) {
        memory.writeByte(0xF1, text.charCodeAt(i));
    }
}

function hasInput() {
    return (memory.readByte(0xF2) & 0x01) !== 0;
}

### Interrupt System

The CPU supports hardware interrupts for enhanced I/O operations, with interrupt vectors mapped to memory addresses 0xFF00-0xFFFF.

```javascript
import { iMaCoMpUtERussyCPU } from './js/cpu.js';

// Enable interrupts globally
cpu.interruptsEnabled = true;

// Trigger software interrupt at vector 0xFF00
cpu.triggerInterrupt(0xFF00);

// Hardware interrupt vectors
const INTERRUPT_VECTORS = {
    TIMER: 0xFF00,      // Timer interrupt
    KEYBOARD: 0xFF02,    // Keyboard input interrupt
    VIDEO_VSYNC: 0xFF04, // Video vertical sync interrupt
    DISK_IO: 0xFF06      // Disk I/O completion interrupt
};
```

See [Interactive Terminal API Reference](./INTERACTIVE_TERMINAL_API.md) for complete programming guide.

## MCP Server API

The MCP (Machine Control Protocol) Server provides RESTful endpoints for controlling the emulator remotely, built with Express.js and AJV schema validation.

### Video API Endpoints

Control the video display system with the following endpoints:

#### POST `/mcp/video/setPixel`

Set a pixel at specified coordinates with a color value.

```javascript
// Request
fetch('/mcp/video/setPixel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        x: 15,        // 0-31 horizontal position
        y: 10,        // 0-31 vertical position
        color: 2      // 0-15 color index (0=black, 1=green, 2=yellow, 3=red)
    })
});

// Response
{
    "success": true,
    "data": {
        "address": 8207  // Memory address written (0x200F + offset)
    }
}
```

**Parameters:**
- `x` (integer): Horizontal position 0-31
- `y` (integer): Vertical position 0-31
- `color` (integer): Color index 0-15

**Memory Mapping:** Pixels are stored at addresses 0x2000-0x201F (top row) through 0x21E0-0x21FF (bottom row).

#### POST `/mcp/video/clear`

Clear the entire video display.

```javascript
fetch('/mcp/video/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});
```

#### POST `/mcp/video/update`

Trigger a display update (refresh screen).

```javascript
fetch('/mcp/video/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});
```

### CPU Control API

#### POST `/mcp/cpu/reset`

Reset the CPU to initial state.

```javascript
fetch('/mcp/cpu/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});
```

#### POST `/mcp/cpu/step`

Execute one CPU instruction.

```javascript
fetch('/mcp/cpu/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});
```

#### POST `/mcp/cpu/run`

Run CPU for specified number of steps.

```javascript
fetch('/mcp/cpu/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        maxSteps: 1000
    })
});
```

#### GET `/mcp/cpu/state`

Get current CPU state.

```javascript
const response = await fetch('/mcp/cpu/state');
const state = await response.json();
console.log(state); // { PC: 1536, A: 0, X: 0, Y: 0, running: false }
```

### Queue Management Consolidation

Queue management has been consolidated to prevent race conditions and duplicate instances:

- **Single Instance**: Only `mcp_server.js` handles queue operations
- **Server Startup**: `server.js` no longer spawns separate queue server
- **Prevention**: Function `startQueueServer()` returns `Promise.resolve()` with disabled message
- **Benefits**: Eliminates race conditions between concurrent queue operations
- **Location**: Queue logic centralized in [`server/mcp_server.js`](server/mcp_server.js)

### Validation

Centralized validation using AJV JSON schemas in [`lib/validators.js`](lib/validators.js):

```javascript
import { validateRequest } from './lib/validators.js';

// Validate incoming request data
const validatedData = validateRequest(requestData, '/mcp/video/setPixel');

// Custom validators for complex types
const customValidators = {
    dateTime: (value) => !isNaN(Date.parse(value)),  // Custom date-time validator
    uuid: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
};
```

## SteganographyEngine API

The main engine for steganography operations.

```javascript
import { SteganographyEngine } from './js/steganography.js';
```

### Constructor

```javascript
const engine = new SteganographyEngine(options);
```

**Parameters:**
- `options` (Object, optional): Configuration options
  - `eccSymbols` (number, default: 10): Number of Reed-Solomon ECC symbols
  - `defaultMethod` (string, default: 'lsb'): Default steganography method ('lsb', 'dct', 'qr')
  - `autoCompress` (boolean, default: true): Automatically compress data when beneficial
  - `compressionOptions` (Object): Options passed to compression algorithm

**Example:**
```javascript
const engine = new SteganographyEngine({
    eccSymbols: 15,
    autoCompress: true,
    compressionOptions: { dictionarySize: 4096 }
});
```

### Core Methods

#### encodeLSB(data, imageData)

Embed data using Least Significant Bit method.

```javascript
const ImageData modifiedImageData = engine.encodeLSB(data, imageData);
```

**Parameters:**
- `data` (Uint8Array): Data to embed
- `imageData` (ImageData): Target video frame

**Returns:** `ImageData` - Modified frame with embedded data

**Throws:**
- `Error`: Insufficient capacity

**Example:**
```javascript
const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
const embeddedFrame = engine.encodeLSB(data, videoFrame);
// Returns ImageData with hidden "Hello"
```

#### decodeLSB(imageData)

Extract data from LSB-encoded image.

```javascript
const Uint8Array extractedData = engine.decodeLSB(imageData);
```

**Parameters:**
- `imageData` (ImageData): Encoded video frame

**Returns:** `Uint8Array` - Extracted data

**Throws:**
- `Error`: Invalid embedded data length

#### encodeDCT(data, imageData)

Embed data using Discrete Cosine Transform (NOT IMPLEMENTED).

```javascript
const ImageData result = engine.encodeDCT(data, imageData);
```

**Note:** Currently returns placeholder. Implementation planned for future phase.

#### decodeDCT(imageData)

Extract data from DCT-encoded image (NOT IMPLEMENTED).

```javascript
const Uint8Array result = engine.decodeDCT(imageData);
```

**Note:** Currently returns empty Uint8Array. Implementation planned for future phase.

### Compression & ECC

#### compressData(data, force)

Compress data before embedding.

```javascript
const Uint8Array compressedData = engine.compressData(data, force);
```

**Parameters:**
- `data` (Uint8Array): Data to compress
- `force` (boolean, optional): Force compression even if not beneficial

**Returns:** `Uint8Array` - Compressed data with compression flag (1 byte prepended)

**Format:**
```
[compression_flag: 1 byte] + [compressed_data: n bytes]
compression_flag: 0x00 = no compression, 0x01 = LZ77 compressed
```

**Example:**
```javascript
const sourceData = new Uint8Array(1000);
const compressed = engine.compressData(sourceData);
// Output: [0x01, ...compressed_data...]
```

#### decompressData(data)

Decompress data after extraction.

```javascript
const Uint8Array originalData = engine.decompressData(data);
```

**Parameters:**
- `data` (Uint8Array): Compressed data with flag

**Returns:** `Uint8Array` - Decompressed data

**Example:**
```javascript
const compressedData = engine.compressData(sourceData);
// ... store/embed compressedData ...
const restored = engine.decompressData(compressedData);
// restored === sourceData (identical)
```

#### addErrorCorrection(data, eccSymbols)

Add Reed-Solomon error correction.

```javascript
const dataWithECC = engine.addErrorCorrection(data, eccSymbols);
```

**Parameters:**
- `data` (Uint8Array): Original data
- `eccSymbols` (number, optional): ECC symbols (uses instance default if not provided)

**Returns:** `Uint8Array` - Data with ECC symbols appended

#### validateData(dataWithECC, eccSymbols)

Validate and correct data using ECC.

```javascript
const correctedData = engine.validateData(dataWithECC, eccSymbols);
```

**Parameters:**
- `dataWithECC` (Uint8Array): Data with ECC symbols
- `eccSymbols` (number, optional): Number of ECC symbols used

**Returns:** `Uint8Array` - Corrected original data

**Throws:**
- `Error`: Data cannot be corrected

### Capacity Estimation

#### calculateCapacity(imageData)

Calculate maximum embeddable data size.

```javascript
const capacity = engine.calculateCapacity(imageData);
```

**Parameters:**
- `imageData` (ImageData): Target video frame

**Returns:** `number` - Maximum bytes that can be embedded

**Formula:**
```javascript
const pixelCount = imageData.width * imageData.height;
return Math.floor(pixelCount / 8) - 4; // 4 bytes for length header
```

**Example:**
```javascript
// 1920x1080 frame
const frame = { width: 1920, height: 1080 };
const capacity = engine.calculateCapacity(frame);
// Returns: 518388 bytes (~506KB)
```

## PlatformManager API

YouTube platform integration.

```javascript
import { PlatformManager } from './js/platforms/youtube-api.js';
const platform = new PlatformManager();
```

### Authentication

#### initOAuth()

Initialize OAuth client configuration.

```javascript
await platform.initOAuth();
```

**Throws:**
- `Error`: Google Identity Services not loaded
- `Error`: OAuth configuration failed

#### authenticate()

Authenticate with YouTube.

```javascript
await platform.authenticate();
```

**Behavior:**
- Checks existing authentication
- Requests new token if needed
- Stores tokens in sessionStorage

#### isAuthenticated()

Check authentication status.

```javascript
const isAuth = platform.isAuthenticated();
```

**Returns:** `boolean` - True if valid access token exists

#### revokeAccess()

Revoke OAuth access.

```javascript
await platform.revokeAccess();
```

**Effects:**
- Invalidates current tokens
- Clears stored tokens
- Requires re-authentication for future operations

### Video Upload

#### uploadToYouTube(videoBlob, title, description, onProgress)

Upload video to YouTube with resumable upload.

```javascript
const videoId = await platform.uploadToYouTube(blob, title, desc, progressCallback);
```

**Parameters:**
- `videoBlob` (Blob): Video file to upload
- `title` (string): Video title
- `description` (string): Video description
- `onProgress` (Function, optional): Progress callback

**Progress Callback:**
```javascript
function onProgress(progressData) {
    console.log(`${progressData.progress}% complete`);
    console.log(`${progressData.loaded}/${progressData.total} bytes`);
}
```

**Returns:** `string` - YouTube video ID

**Throws:**
- `Error`: Authentication required
- `Error`: Upload initialization failed
- `Error`: Chunk upload failed

### Video Download

#### downloadFromYouTube(videoId)

Download video from YouTube.

```javascript
const videoBlob = await platform.downloadFromYouTube(videoId);
```

**Parameters:**
- `videoId` (string): YouTube video ID

**Returns:** `Blob` - Downloaded video blob

**Throws:**
- `Error`: Video unavailable
- `Error`: No suitable video format found

#### getVideoMetadata(videoId)

Get video metadata.

```javascript
const metadata = await platform.getVideoMetadata(videoId);
```

**Returns:**
```javascript
{
    id: string,
    title: string,
    description: string,
    publishedAt: string,
    channelTitle: string,
    duration: number,      // seconds
    viewCount: number,
    likeCount: number,
    thumbnailUrl: string
}
```

#### searchVideos(query, maxResults)

Search for videos on YouTube.

```javascript
const videos = await platform.searchVideos("VideoStorage data", 10);
```

**Returns:** `Array` - Array of video objects

**Video Object:**
```javascript
{
    id: string,
    title: string,
    description: string,
    publishedAt: string,
    channelTitle: string,
    thumbnailUrl: string
}
```

### Rate Limiting

 PlatformManager includes automatic rate limiting for YouTube API calls.

**Limits:**
- 10,000 quota units per day
- 1 request per second
- 100 requests per 100 seconds

**RateLimiter Methods:**
```javascript
// Called automatically by makeAuthenticatedRequest
await platform.rateLimiter.waitForSlot();
```

## VideoFrames API

Video frame processing and manipulation.

```javascript
import {
    extractFrameImageData,
    embedDataInFrame,
    createModifiedVideoBlob
} from './js/ui/video-frames.js';
```

### Frame Processing

#### extractFrameImageData(videoBlob, frameTime)

Extract ImageData from video frame.

```javascript
const frameData = await extractFrameImageData(videoBlob, 1.0);
```

**Parameters:**
- `videoBlob` (Blob): Video file blob
- `frameTime` (number, optional): Time in seconds (default: 1.0)

**Returns:** `Promise<ImageData>` - Canvas ImageData of the frame

#### createModifiedVideoBlob(imageData, originalBlob)

Create new video blob from modified frame.

```javascript
const newVideoBlob = await createModifiedVideoBlob(imageData, originalBlob);
```

**Parameters:**
- `imageData` (ImageData/Array<ImageData>): Modified frame(s)
- `originalBlob` (Blob): Original video for metadata

**Returns:** `Promise<Blob>` - New video blob

**Implementation:**
- Uses WebCodecs API if supported (returns actual video)
- Falls back to JSON format if WebCodecs unavailable

### Multi-Frame Operations

#### splitPayloadAcrossFrames(payload, frameCount, capacityPerFrame)

Split payload across multiple frames.

```javascript
const chunks = splitPayloadAcrossFrames(data, 3, 32000);
```

**Parameters:**
- `payload` (Uint8Array): Full data payload
- `frameCount` (number): Number of frames to use
- `capacityPerFrame` (number): Bytes per frame

**Returns:** `Array<Uint8Array>` - Array of payload chunks

#### embedAcrossFrames(payload, frames)

Embed chunks across multiple frames.

```javascript
const modifiedFrames = await embedAcrossFrames(data, frameArray);
```

**Parameters:**
- `payload` (Uint8Array): Complete data payload
- `frames` (Array<ImageData>): Target frames

**Returns:** `Promise<Array<ImageData>>` - Modified frames

#### calculateFrameCapacity(imageData)

Calculate embedding capacity for a frame.

```javascript
const capacity = calculateFrameCapacity(frameData);
```

**Parameters:**
- `imageData` (ImageData): Target frame

**Returns:** `number` - Maximum embeddable bytes

### Encoding & Decoding

#### decodeVideoToFrames(videoBlob, onProgress)

Decode entire video to frames.

```javascript
const frames = await decodeVideoToFrames(videoBlob, progressCallback);
```

**Parameters:**
- `videoBlob` (Blob): Video file
- `onProgress` (Function, optional): Progress callback (receives 0-1)

**Returns:** `Promise<Array<ImageData>>` - Array of all frames

#### encodeFramesToVideo(frames, originalBlob, options, onProgress)

Encode frames back to video.

```javascript
const videoBlob = await encodeFramesToVideo(frames, originalBlob, {
    bitrate: 1000000,
    framerate: 30
}, progressCallback);
```

**Parameters:**
- `frames` (Array<ImageData>): Frames to encode
- `originalBlob` (Blob): Original video for metadata
- `options` (Object): Encoding options
  - `bitrate` (number): Bits per second (default: 1Mbps)
  - `framerate` (number): Target framerate (default: 30fps)
- `onProgress` (Function, optional): Progress callback

**Returns:** `Promise<Blob>` - WebM video blob

#### isWebCodecsSupported()

Check WebCodecs API support.

```javascript
const supported = isWebCodecsSupported();
```

**Returns:** `boolean` - True if VideoEncoder/VideoDecoder available

## Error Handling

### Common Error Types

```javascript
class SteganographyError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
```

**Error Codes:**
- `INSUFFICIENT_CAPACITY`: Data too large for frame
- `INVALID_FORMAT`: Unsupported video or data format
- `DECODE_FAILED`: Data extraction failed
- `AUTH_REQUIRED`: YouTube API authentication needed
- `UPLOAD_FAILED`: Video upload error

### Error Handling Patterns

```javascript
// Basic error handling
try {
    const embedded = engine.encodeLSB(data, frame);
} catch (error) {
    if (error.message.includes('capacity')) {
        console.log('Data too large, try compression');
        const compressed = engine.compressData(data);
        // Retry with compressed data...
    }
}
```

```javascript
// Comprehensive error handling
async function safeEncode(data, frame) {
    try {
        const compressed = engine.compressData(data);
        const withECC = engine.addErrorCorrection(compressed);
        return engine.encodeLSB(withECC, frame);
    } catch (error) {
        switch(error.code) {
            case 'INSUFFICIENT_CAPACITY':
                throw new Error('Data exceeds frame capacity');
            case 'INVALID_FORMAT':
                throw new Error('Unsupported frame format');
            default:
                throw error;
        }
    }
}
```

## Examples

### Complete Encode/Decode Cycle

```javascript
import { SteganographyEngine } from './js/steganography.js';
import { extractFrameImageData, createModifiedVideoBlob } from './js/ui/video-frames.js';

// Encode
const engine = new SteganographyEngine();
const frame = await extractFrameImageData(videoFile);
const compressed = engine.compressData(assemblyCode);
const withECC = engine.addErrorCorrection(compressed);
const embeddedFrame = engine.encodeLSB(withECC, frame);
const newVideoBlob = await createModifiedVideoBlob(embeddedFrame, videoFile);

// Decode
const decodedFrame = await extractFrameImageData(newVideoBlob);
const extractedData = engine.decodeLSB(decodedFrame);
const corrected = engine.validateData(extractedData);
const original = engine.decompressData(corrected);
```

### Platform Integration

```javascript
import { PlatformManager } from './js/platforms/youtube-api.js';

const platform = new PlatformManager();
await platform.authenticate();

// Upload
const videoId = await platform.uploadToYouTube(
    videoBlob,
    'iMaCoMpUtERussy Container',
    'Embedded assembly program data',
    (progress) => console.log(`${progress.progress}% uploaded`)
);

// Download and verify
const downloadedBlob = await platform.downloadFromYouTube(videoId);
const metadata = await platform.getVideoMetadata(videoId);
console.log(`Downloaded ${metadata.title} - ${metadata.duration}s`);
```

---

Next: [Setup & Deployment](SETUP_DEPLOYMENT.md) | [Video Embedding Guide](VIDEO_EMBEDDING_GUIDE.md) | [Troubleshooting](TROUBLESHOOTING.md)