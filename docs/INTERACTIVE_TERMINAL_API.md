# iMaCoMpUtERussy Interactive Terminal & Video Display API Reference

*Created by Kyle Durepos*

## Memory-Mapped I/O System

The iMaCoMpUtERussy emulator provides dual output systems: a text-based interactive terminal and a graphics-capable video display. Both use memory-mapped I/O for program interaction.

### I/O Memory Map

| Address Range | Name | Purpose | Access |
|---------------|------|---------|---------|
| `$F0` | INPUT_REG | Keyboard input register | Read |
| `$F1` | OUTPUT_REG | Terminal output register | Write |
| `$F2` | STATUS_REG | I/O status flags | Read |
| `$0200-$05FF` | VIDEO_BUFFER | Graphics framebuffer (32x24 pixels) | Read/Write |

### Status Register ($F2) Bit Layout

| Bit | Name | Description |
|-----|------|-------------|
| 0 | INPUT_READY | 1 = Character available in input register |
| 1-7 | Reserved | Currently unused, read as 0 |

### System Enhancements (August 2025)

#### Terminal I/O System
- **Read Listener System**: Enhanced memory monitoring with proper event notification
- **Write Listener Conflict Resolution**: Eliminated duplicate listeners that caused I/O malfunctions
- **Automatic Input Buffer Management**: Reliable character-by-character input delivery
- **Streamlined Debug Output**: Console messages shortened to prevent UI layout issues

#### Video Display System (NEW)
- **32x24 Pixel Graphics**: Low-resolution retro display with 4-color palette
- **Memory-Mapped Framebuffer**: Direct pixel manipulation via memory writes at $0200-$05FF
- **Video Instructions**: VST (store), VUP (update), VDL (delay) for graphics programming
- **Real-time Rendering**: Canvas-based display with pixelated retro styling

## Video Display Programming

### Video Memory Layout

The video framebuffer occupies 768 bytes from `$0200` to `$02FF`:
- **Resolution**: 32 columns × 24 rows = 768 pixels
- **Colors**: 2-bit per pixel (4 colors: Black, Green, Yellow, Red)
- **Address Calculation**: `$0200 + (row × 32) + column`

### Video Instructions

| Instruction | Opcode | Description | Example |
|-------------|--------|-------------|---------|
| `VST #addr` | $9B | Store A register to video buffer offset | `VST #$190` |
| `VUP` | $AB | Update display from video buffer | `VUP` |
| `VDL #frames` | $BB | Delay execution by frame count | `VDL #$3C` |

### Color Palette

| Value | Color | Usage |
|-------|-------|-------|
| `$00` | Black | Background, cleared pixels |
| `$01` | Green | Primary graphics color |
| `$02` | Yellow | Highlights, secondary color |
| `$03` | Red | Warnings, special effects |

## Programming Examples

### Basic Output

Send a character to the terminal:

```assembly
LDA #$48       ; Load 'H' (ASCII 72)
STA $F1        ; Send to terminal output
```

### Basic Input

Read a character from the terminal:

```assembly
WAIT_INPUT:
    LDA $F2        ; Check status register
    AND #$01       ; Test input ready bit
    BEQ WAIT_INPUT ; Wait if no input available
    
    LDA $F0        ; Read the character
    ; Character now in accumulator
```

### Basic Graphics Output

Draw a pixel on the video display:

```assembly
LDA #$01       ; Green color
STA $0200      ; Top-left corner (row 0, col 0)
VUP            ; Update display to show change
```

### Graphics Programming Example

Draw a simple pattern:

```assembly
.org $0600

GRAPHICS_DEMO:
    ; Clear screen
    LDX #$00
    LDA #$00       ; Black
CLEAR_LOOP:
    STA $0200,X    ; Clear video memory
    INX
    BNE CLEAR_LOOP
    
    ; Draw corners
    LDA #$01       ; Green
    STA $0200      ; Top-left (0,0)
    STA $021F      ; Top-right (0,31)
    STA $02E0      ; Bottom-left (23,0)
    STA $02FF      ; Bottom-right (23,31)
    
    ; Draw center cross
    LDA #$02       ; Yellow
    STA $0290      ; Center (12,16)
    STA $028F      ; Left
    STA $0291      ; Right
    STA $0270      ; Up
    STA $02B0      ; Down
    
    VUP            ; Display changes
    HLT
```

### Complete Echo Program

A simple program that echoes user input:

```assembly
.org $0600

ECHO_LOOP:
    ; Check if input is available
    LDA $F2        ; Load status register
    AND #$01       ; Check input ready bit
    BEQ ECHO_LOOP  ; Loop if no input
    
    ; Read and echo character
    LDA $F0        ; Read character
    STA $F1        ; Echo to output
    
    ; Check for exit condition (ESC = $1B)
    CMP #$1B
    BEQ EXIT
    JMP ECHO_LOOP
    
EXIT:
    HLT            ; Stop program
```

### String Output Function

Output a null-terminated string:

```assembly
; String output subroutine
; String address in X register (low byte) and Y register (high byte)
PRINT_STRING:
    STX $10        ; Store string address in zero page
    STY $11
    LDY #$00       ; Character index
    
PRINT_LOOP:
    LDA ($10),Y    ; Load character from string
    BEQ PRINT_DONE ; Exit if null terminator
    STA $F1        ; Send to output
    INY            ; Next character
    JMP PRINT_LOOP
    
PRINT_DONE:
    RTS            ; Return from subroutine

; Usage example:
MAIN:
    LDX #<HELLO_MSG ; Load string address (low byte)
    LDY #>HELLO_MSG ; Load string address (high byte)
    JSR PRINT_STRING
    HLT

HELLO_MSG:
    .byte "Hello, World!", $0A, $00  ; String with newline and null terminator
```

## Interactive Terminal Features

### Terminal Control Characters

| Character | ASCII | Description |
|-----------|-------|-------------|
| `$0A` | 10 | Line Feed (newline) |
| `$0D` | 13 | Carriage Return |
| `$1B` | 27 | Escape (commonly used for exit) |
| `$20` | 32 | Space |

### Best Practices

1. **Always check status before reading input**:
   ```assembly
   LDA $F2
   AND #$01
   BEQ NOT_READY
   ```

2. **Handle special characters**:
   ```assembly
   LDA $F0
   CMP #$0D      ; Carriage return?
   BEQ HANDLE_ENTER
   CMP #$1B      ; Escape?
   BEQ HANDLE_EXIT
   ```

3. **Provide user feedback**:
   ```assembly
   ; Echo user input so they can see what they typed
   LDA $F0       ; Read input
   STA $F1       ; Echo immediately
   ```

## JavaScript API (For Web Interface)

### Terminal Functions

The web interface provides these functions for terminal interaction:

```javascript
// Write text to terminal (called automatically by programs)
logToConsole(message, type = 'info')

// Send input to running program
sendInput()  // Called when user presses Enter

// Clear terminal display
clearTerminal()

// Check if program is waiting for input
isInputPending()
```

### Memory Access

Direct memory access for debugging:

```javascript
// Read from I/O registers
const inputValue = memory.readByte(0xF0);
const outputValue = memory.readByte(0xF1);
const statusValue = memory.readByte(0xF2);

// Write to I/O registers (for testing)
memory.writeByte(0xF1, 65);  // Send 'A' to output
```

## Debugging Tips

### Using the Console

The system console shows detailed execution information:

- Step-by-step instruction execution
- Memory reads/writes to I/O registers
- Program loading and status messages
- Error conditions and warnings

### Memory Viewer

Watch I/O registers in real-time:

- Zero Page view shows `$F0`, `$F1`, `$F2` values
- Changes highlight during program execution
- Useful for debugging I/O timing issues

### Interactive Testing

1. Load the Echo program
2. Step through instructions to see I/O behavior
3. Type in terminal while stepping to see register changes
4. Use Run mode for real-time interaction

## Sample Programs Reference

### fibonacci.asm
- **Purpose**: Mathematical demonstration
- **Features**: Shows memory usage and calculations
- **I/O**: None (uses memory only)

### hello-terminal.asm
- **Purpose**: Basic terminal output
- **Features**: Demonstrates character output to terminal
- **I/O**: Output only ($F1 register)

### echo.asm
- **Purpose**: Interactive communication
- **Features**: Reads user input and echoes back
- **I/O**: Both input ($F0) and output ($F1)
- **Exit**: Send ESC character to terminate

## Error Handling

### Common Issues

1. **Program doesn't respond to input**:
   - Check that program is reading status register ($F2)
   - Verify input ready bit checking logic
   - Ensure program is running (not halted)

2. **No output appears**:
   - Verify writes to output register ($F1)
   - Check for null characters (ASCII 0)
   - Ensure terminal is not cleared

3. **Input characters missing**:
   - Programs must read input promptly
   - Input buffer has limited capacity
   - Check for proper status register polling

### Debugging Workflow

1. **Load program** and verify it assembles correctly
2. **Step through** I/O instructions to see register changes
3. **Check console output** for detailed execution trace
4. **Use memory viewer** to watch I/O register values
5. **Test with simple input** like single characters first
