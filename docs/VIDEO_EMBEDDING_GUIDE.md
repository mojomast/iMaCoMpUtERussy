# Video Embedding Guide

This guide explains how to embed assembly programs into video files using iMaCoMpUtERussy's steganography system.

**Note:** This guide covers **video file steganography** (hiding programs in video files). For information about the **video graphics display system** (creating graphics programs), see the main documentation and samples like `graphics-demo.asm`.

## Table of Contents

- [Overview](#overview)
- [Supported File Formats](#supported-file-formats)
- [Basic Workflow](#basic-workflow)
- [Example: Hello World](#example-hello-world)
- [Example: Upload to YouTube](#example-upload-to-youtube)
- [Multi-Frame Embedding](#multi-frame-embedding)
- [Capacity Calculations](#capacity-calculations)
- [Performance Considerations](#performance-considerations)

## Overview

iMaCoMpUtERussy uses **steganography** to hide assembly programs inside video files. The system embeds data in the **least significant bits (LSB)** of video frame pixels, making the changes virtually invisible to the human eye. Data is compressed and protected with error correction before embedding.

### Two Video Systems

iMaCoMpUtERussy includes two distinct video-related systems:

1. **Video Graphics Display** (32×24 pixel graphics output)
   - Create graphics programs with VST/VUP/VDL instructions
   - Memory-mapped framebuffer at $0200-$05FF
   - 4-color palette: Black, Green, Yellow, Red
   - See `samples/graphics-demo.asm` for examples

2. **Video File Steganography** (this guide)
   - Hide assembly programs inside video files
   - Store and retrieve from YouTube
   - Compression and error correction
   - Cross-platform data storage

### Key Features

- **Invisible embedding**: Data hidden in video pixels
- **Compression**: LZ77 algorithm reduces file sizes automatically
- **Error correction**: Reed-Solomon ECC protects against data corruption
- **YouTube integration**: Store and retrieve videos from YouTube
- **Multi-frame support**: Large programs can span multiple video frames

## Supported File Formats

### Input Files

- **Assembly programs** (`.asm`): 6502 assembly code
- **Video files**: MP4, WebM, AVI, MOV (browsers support varies)
- **File size limit**: 100MB maximum per file

### Output Files

- **Modified videos**: Same format as input (when WebCodecs supported)
- **Fallback format**: JSON files containing frame data (when WebCodecs unavailable)

## Basic Workflow

### 1. Prepare Your Assembly Program

Create or load a `.asm` file:

```51:55:samples/hello-world.asm
start:
    lda #$48        ; 'H'
    jsr $FFD2
    lda #$45        ; 'E'
```

### 2. Assemble and Embed

1. Open iMaCoMpUtERussy at http://localhost:8000
2. Select your `.asm` file
3. Select a base video file
4. Click **"Encode .asm → Video"**
5. Download the encoded video

### 3. Extract and Run

1. Select the encoded video file
2. Click **"Decode Data"**
3. Click **"Load .asm → Memory"**
4. Run the program in the emulator

## Example: Hello World

Complete walkthrough for the Hello World program.

### Step 1: Prepare Files

1. Create `hello-world.asm`:
```asm
start:
    lda #$48        ; 'H'
    jsr $FFD2
    lda #$45        ; 'E'
    jsr $FFD2
    lda #$4C        ; 'L'
    jsr $FFD2
    lda #$4C        ; 'L'
    jsr $FFD2
    lda #$4F        ; 'O'
    jsr $FFD2
    lda #$0D        ; Carriage return
    jsr $FFD2
    rts
```

2. Prepare a base video file (1-2 minutes recommended)

### Step 2: Encode

```bash
# Open in browser
python -m http.server 8000
# Navigate to http://localhost:8000

# In the web interface:
1. Click file input → Select hello-world.asm
2. Click video input → Select your base video
3. Click "Encode .asm → Video"
4. Wait for encoding to complete
5. Download: hello_encoded_video.json or .mp4/.webm
```

### Step 3: Decode and Verify

```bash
# In the web interface:
1. Select the encoded video file
2. Click "Decode Data"
3. Click "Load .asm → Memory"
4. Click "Run" in the CPU debugger
5. Check output: Should display "HELLO"
```

### Expected File Sizes

| Component | Size |
|-----------|------|
| Original .asm | ~24 bytes |
| Compressed | ~18 bytes |
| With ECC | ~38 bytes |
| Final video | Same as input + ~38 bytes |

## Example: Upload to YouTube

### Prerequisites

1. Google Cloud Console project (see [Setup Guide](SETUP_DEPLOYMENT.md))
2. YouTube API credentials configured
3. OAuth consent completed

### Step-by-Step

1. **Complete basic encoding** (follow Hello World example above)

2. **Set up YouTube integration**:
```javascript
// This is handled automatically in the web interface
// Click "Upload to YouTube" after encoding
```

3. **Upload encoded video**:
```
Title: "iMaCoMpUtERussy Data Container"
Description: "Assembly program embedded using steganography"
Privacy: Private (recommended)
Category: People & Blogs
```

4. **Download and decode**:
```bash
# Get video ID from YouTube URL
# Example: https://youtu.be/dQw4w9WgXcQ → Video ID: dQw4w9WgXcQ

# In web interface:
1. Enter YouTube video ID
2. Click "Download from YouTube"
3. Click "Decode Data"
4. Verify program integrity
```

## Multi-Frame Embedding

For programs larger than single frame capacity (~10-50KB depending on video resolution).

### When to Use

- Assembly programs > 10KB
- High-fidelity video embedding
- Critical data requiring redundancy

### Process

1. **Select multi-frame option**:
```
In web interface:
1. Select large .asm file
2. Select high-resolution video
3. Click "Encode .asm → Multi‑Frame"
```

2. **Automatic splitting**:
```
System automatically:
- Calculates frame capacities
- Splits payload across frames
- Embeds each chunk separately
- Maintains data integrity
```

3. **Reconstruction**:
```
All frames are needed to reconstruct the original program.
Missing frames will result in corrupted data.
```

### Capacity Examples

| Resolution | Frame Capacity | Total (30fps × 60s) |
|------------|----------------|-------------------|
| 480p | ~15KB | ~27MB |
| 720p | ~35KB | ~63MB |
| 1080p | ~75KB | ~135MB |

*Approximate values; actual capacity varies by video content and compression*

## Capacity Calculations

### Basic Formula

```
Capacity = (Width × Height × 3) / 8 - 4 bytes
```

- **Width × Height**: Pixel dimensions
- **× 3**: RGB channels per pixel
- **/ 8**: 1 bit per color channel
- **- 4 bytes**: Length header

### Real-World Examples

```javascript
// 1080p video frame (1920×1080)
const capacity = (1920 * 1080 * 3) / 8 - 4;
// Result: ~74,880 bytes (~73KB)

// 720p video frame (1280×720)
const capacity = (1280 * 720 * 3) / 8 - 4;
// Result: ~33,177 bytes (~32KB)
```

### Factors Affecting Capacity

| Factor | Impact |
|--------|--------|
| Resolution | Higher = more capacity |
| Compression | H.264/AVC has lower capacity than uncompressed |
| Color depth | 24-bit RGB optimal; 32-bit RGBA wastes capacity |
| Video artifacts | Motion blur, compression artifacts reduce reliability |

### Testing Capacity

Use the built-in capacity estimator:

```bash
# In web interface:
1. Select video file
2. System displays: "~XX KB capacity"
3. Compare with your .asm file size
```

## Performance Considerations

### Encoding Times

| Video Length | Encoding Time | Multi-Frame |
|-------------|---------------|-------------|
| 30 seconds | ~5-15 seconds | ~10-30 seconds |
| 2 minutes | ~20-60 seconds | ~40-120 seconds |
| 10 minutes | ~2-5 minutes | ~4-10 minutes |

### Optimization Tips

1. **Use shorter videos** for faster encoding/decoding
2. **Choose higher resolution** for larger programs
3. **Pre-compress assembly code** to reduce final size
4. **Test with sample data** before encoding large programs

### Browser Compatibility

| Browser | WebCodecs | Fallback | Recommended |
|---------|-----------|----------|-------------|
| Chrome 94+ | ✅ | JSON | ⭐ Best |
| Firefox 93+ | ⚠️ Partial | JSON | ⚠️ Limited |
| Safari 15+ | ⚠️ Partial | JSON | ⚠️ Limited |
| Edge | ✅ | JSON | ✅ Good |

### Memory Requirements

- **RAM**: 2-4× video file size during processing
- **Storage**: 3× space for temporary files during encoding
- **GPU**: Hardware acceleration recommended for large videos

---

Next: [Developer API Reference](DEVELOPER_API.md) | [Setup & Deployment](SETUP_DEPLOYMENT.md) | [Troubleshooting](TROUBLESHOOTING.md)