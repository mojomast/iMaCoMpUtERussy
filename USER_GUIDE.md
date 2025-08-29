# iMaCoMpUtERussy Emulator - User Guide

## Getting Started

### Loading Assembly Programs

You now have multiple ways to load assembly programs into the emulator:

#### 1. **Debugger Section - Direct Loading**
- Click "Load Assembly File" and select a `.asm` file from your computer
- Click "Load Sample Program" to load the built-in Fibonacci sample
- Programs are automatically assembled and loaded into memory at the specified origin address

#### 2. **Video Manager Section - File Operations**
- **Load ASM to Emulator**: Load an assembly file directly into the emulator
- **Encode ASM → Video**: Embed an assembly program into a video file using steganography
- **Decode Video File**: Extract an assembly program from an encoded video file
- **Decode from YouTube**: (Coming soon) Extract programs from YouTube videos

### Video Encoding/Decoding

#### Encoding Process:
1. Select an assembly file (.asm)
2. Select a video file to embed data into
3. Click "Encode ASM → Video"
4. The system will:
   - Assemble your code into bytecode
   - Extract a frame from the video
   - Embed the bytecode using LSB steganography
   - Create a new video file with your program hidden inside
   - Download the encoded video

#### Decoding Process:
1. Select a video file that contains encoded data
2. Click "Decode Video File"
3. The system will:
   - Extract frames from the video
   - Decode hidden data using steganography
   - Reconstruct the original assembly program
   - Offer to load it directly into the emulator
   - Download the decoded assembly file

### YouTube Integration

The application includes placeholder support for YouTube video encoding/decoding:

- **YouTube URL field**: Enter a YouTube video URL
- **Decode from YouTube**: Extract programs from YouTube videos (requires API setup)

*Note: YouTube functionality requires proper API credentials and respects YouTube's Terms of Service.*

### Emulator Controls

#### Debugger Controls:
- **Run/Stop**: Start or stop continuous execution
- **Step**: Execute one instruction at a time  
- **Reset**: Reset the CPU to initial state
- **Speed**: Adjust execution speed (1-1000 Hz)

#### Memory Viewer:
- Displays memory contents in hex format
- Shows video buffer region (0x0200-0x05FF) by default
- Updates automatically when programs are loaded

### Sample Programs

The emulator includes several sample programs:

- **fibonacci.asm**: Calculates Fibonacci sequence
- **hello-world.asm**: Basic "Hello World" program
- **video-demo.asm**: Demonstrates video buffer operations
- **test-simple.asm**: Simple addition test program

### File Formats

#### Assembly Files (.asm):
- Standard assembly syntax with labels and comments
- Supports directives like `.org` for setting origin address
- Assembles to 6502-style bytecode

#### Encoded Videos:
- Contain JSON metadata with program information
- Include original filename, origin address, and timestamp
- Use LSB steganography for data hiding

### Error Handling

The application provides clear error messages for:
- Assembly syntax errors
- File format issues
- Video encoding/decoding problems
- Memory loading failures

### Browser Compatibility

- Chrome 94+ (recommended)
- Firefox 85+
- Safari 14+
- Requires modern JavaScript module support

### Tips

1. **Start Simple**: Try loading `test-simple.asm` first
2. **Use Step Mode**: Step through instructions to see how the CPU works
3. **Check Status**: Watch the status messages for feedback
4. **Memory Inspection**: Use the memory viewer to see your program in memory
5. **Video Testing**: Use short video clips for faster encoding/decoding

### Troubleshooting

- **File not loading**: Check file format and assembly syntax
- **Video encoding fails**: Ensure video file is valid and not corrupted  
- **Emulator not responding**: Try resetting the CPU
- **Memory not updating**: Check if the memory viewer is properly initialized
