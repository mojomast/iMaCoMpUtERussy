# iMaCoMpUtERussy Instruction Set Reference

Complete reference for the iMaCoMpUtERussy CPU instruction set, addressing modes, and programming examples.

## Table of Contents
- [Instruction Categories](#instruction-categories)
- [Addressing Modes](#addressing-modes)
- [Instruction Details](#instruction-details)
- [Programming Examples](#programming-examples)
- [Memory Map](#memory-map)

## Instruction Categories

### Data Transfer Instructions
Load and store data between registers and memory.

| Instruction | Description | Example |
|-------------|-------------|---------|
| **LDA** | Load Accumulator | `LDA #$42`, `LDA $00`, `LDA $1000` |
| **LDX** | Load X Register | `LDX #$42`, `LDX $00`, `LDX $1000` |
| **LDY** | Load Y Register | `LDY #$42`, `LDY $00`, `LDY $1000` |
| **STA** | Store Accumulator | `STA $00`, `STA $1000` |
| **STX** | Store X Register | `STX $00`, `STX $1000` |
| **STY** | Store Y Register | `STY $00`, `STY $1000` |

### Arithmetic Instructions
Mathematical operations with carry flag support.

| Instruction | Description | Example |
|-------------|-------------|---------|
| **ADC** | Add with Carry | `ADC #$42`, `ADC $1000` |
| **SBC** | Subtract with Carry | `SBC #$42` |
| **INC** | Increment Memory | `INC $00`, `INC $1000` |
| **DEC** | Decrement Memory | `DEC $00`, `DEC $1000` |
| **INX** | Increment X Register | `INX` |
| **INY** | Increment Y Register | `INY` |
| **DEX** | Decrement X Register | `DEX` |
| **DEY** | Decrement Y Register | `DEY` |

### Logical Instructions
Bitwise operations affecting zero and negative flags.

| Instruction | Description | Example |
|-------------|-------------|---------|
| **AND** | Logical AND | `AND #$42`, `AND $1000` |
| **ORA** | Logical OR | `ORA #$42` |
| **EOR** | Exclusive OR | `EOR #$42` |

### Comparison Instructions
Compare values without storing results, affecting processor flags.

| Instruction | Description | Example | Flags Affected |
|-------------|-------------|---------|----------------|
| **CMP** | Compare Accumulator | `CMP #$42`, `CMP $00,X` | N, Z, C |
| **CPX** | Compare X Register | `CPX #$42`, `CPX $00` | N, Z, C |
| **CPY** | Compare Y Register | `CPY #$42`, `CPY $00` | N, Z, C |

**CMP Operation**: Performs A - operand, setting flags without storing result.
- **Carry (C)**: Set if A ≥ operand (no borrow needed)
- **Zero (Z)**: Set if A = operand
- **Negative (N)**: Set if result bit 7 is set

### Control Flow Instructions
Program flow control and conditional branching.

| Instruction | Description | Example |
|-------------|-------------|---------|
| **JMP** | Jump | `JMP $1000` |
| **BEQ** | Branch if Equal | `BEQ label` |
| **BNE** | Branch if Not Equal | `BNE label` |
| **BCS** | Branch if Carry Set | `BCS label` |

### Stack Instructions
Stack operations for data storage and retrieval.

| Instruction | Description | Example |
|-------------|-------------|---------|
| **PHA** | Push Accumulator | `PHA` |
| **PLA** | Pull Accumulator | `PLA` |

### Special Instructions
System control and execution flow.

| Instruction | Description | Example |
|-------------|-------------|---------|
| **HLT** | Halt execution | `HLT` |

### Video Graphics Extensions
iMaCoMpUtERussy specific instructions for video graphics programming.

| Instruction | Description | Example | Usage |
|-------------|-------------|---------|-------|
| **VST** | Video Store (A to buffer offset) | `VST #$190` | Store accumulator to video buffer at offset |
| **VUP** | Video Update (refresh display) | `VUP` | Update display from video buffer |
| **VDL** | Video Delay (frame timing) | `VDL #$3C` | Wait specified number of frames |

#### Video Memory Layout
- **Buffer Range**: `$0200-$05FF` (1024 bytes)
- **Display Size**: 32×24 pixels (768 pixels used)
- **Colors**: 2-bit per pixel (`$00`=Black, `$01`=Green, `$02`=Yellow, `$03`=Red)
- **Address Formula**: `$0200 + (row × 32) + column`

## Addressing Modes

### Immediate (`#$value`)
Use the literal value directly.
```assembly
LDA #$42        ; Load 42 into accumulator
CMP #$00        ; Compare accumulator with 0
```

### Zero Page (`$address`)
Address in zero page (0-255), faster than absolute.
```assembly
LDA $00         ; Load from address $00
STA $FF         ; Store to address $FF
CMP $80         ; Compare with value at $80
```

### Absolute (`$address`)
16-bit address anywhere in memory.
```assembly
LDA $1000       ; Load from address $1000
JMP $0600       ; Jump to address $0600
CMP $1200       ; Compare with value at $1200
```

### Zero Page,X (`$address,X`)
Zero page address plus X register.
```assembly
LDX #$05        ; Load X with 5
LDA $00,X       ; Load from address $05 ($00 + $05)
CMP $10,X       ; Compare with value at $15 ($10 + $05)
```

### Absolute,X (`$address,X`)
Absolute address plus X register.
```assembly
LDX #$10        ; Load X with 16
LDA $1000,X     ; Load from address $1010 ($1000 + $10)
CMP $2000,X     ; Compare with value at $2010
```

### Absolute,Y (`$address,Y`)
Absolute address plus Y register.
```assembly
LDY #$20        ; Load Y with 32
LDA $1000,Y     ; Load from address $1020 ($1000 + $20)
CMP $3000,Y     ; Compare with value at $3020
```

### Indirect,Y (`($address),Y`)
Indirect zero page address plus Y register.
```assembly
LDY #$05        ; Load Y with 5
LDA ($80),Y     ; Load from (address stored at $80-$81) + Y
CMP ($90),Y     ; Compare with value at (address at $90-$91) + Y
```

## Instruction Details

### CMP - Compare Accumulator

The CMP instruction compares the accumulator with a value by performing subtraction without storing the result.

**Available Addressing Modes:**
- `CMP #$42` (immediate) - Opcode: 0xC9
- `CMP $00` (zero page) - Opcode: 0xC5
- `CMP $1000` (absolute) - Opcode: 0xCD
- `CMP $00,X` (zero page,X) - Opcode: 0xD5
- `CMP ($00),Y` (indirect,Y) - Opcode: 0xD1
- `CMP $1000,X` (absolute,X) - Opcode: 0xDD
- `CMP $1000,Y` (absolute,Y) - Opcode: 0xD9

**Flag Effects:**
- **N (Negative)**: Set if bit 7 of result is set
- **Z (Zero)**: Set if accumulator equals operand
- **C (Carry)**: Set if accumulator ≥ operand

**Usage Examples:**
```assembly
; Compare immediate value
LDA #$50
CMP #$50        ; Z flag set (equal), C flag set (A >= operand)

; Compare with memory
LDA #$30
CMP $00         ; Compare A with value stored at address $00

; Compare with indexed addressing
LDX #$05
CMP $1000,X     ; Compare A with value at $1005
```

## Programming Examples

### Basic Comparison Loop
```assembly
.org $0600

; Compare values in a loop
LDX #$00        ; Initialize counter
LDA #$42        ; Value to search for

loop:
    CMP $1000,X     ; Compare with array element
    BEQ found       ; Branch if equal
    INX             ; Increment counter
    CMP #$10        ; Check if we've searched 16 elements
    BNE loop        ; Continue if not done
    JMP notfound    ; Jump to not found

found:
    LDA #$01        ; Set success flag
    STA $00
    HLT

notfound:
    LDA #$00        ; Set failure flag
    STA $00
    HLT
```

### Interactive Input Validation
```assembly
.org $0600

; Echo program with input validation
input_loop:
    LDA $F2         ; Check input status
    AND #$01        ; Test input ready bit
    BEQ input_loop  ; Wait for input

    LDA $F0         ; Read character
    CMP #$0D        ; Check for Enter (carriage return)
    BEQ done        ; Exit if Enter pressed
    
    CMP #$20        ; Check if printable (>= space)
    BCC input_loop  ; Skip if control character
    
    STA $F1         ; Echo character to terminal
    JMP input_loop  ; Continue reading

done:
    HLT
```

## Memory Map

### Standard Memory Regions
- **$0000-$00FF**: Zero Page (fastest access)
- **$0100-$01FF**: Stack Space
- **$0200-$05FF**: System Reserved
- **$0600-$7FFF**: User RAM (program and data)
- **$8000-$BFFF**: Cartridge ROM (future use)
- **$C000-$FFFF**: System ROM

### Interactive Terminal I/O
- **$F0**: Input Register (read user keyboard input)
- **$F1**: Output Register (write to terminal display)
- **$F2**: Status Register (bit 0 = input ready)

### Programming the Terminal
```assembly
; Send "Hello" to terminal
LDA #'H'
STA $F1
LDA #'e'
STA $F1
LDA #'l'
STA $F1
LDA #'l'
STA $F1
LDA #'o'
STA $F1

; Wait for and read input
wait_input:
    LDA $F2
    AND #$01
    BEQ wait_input
    LDA $F0         ; Read character
```

## Tips and Best Practices

1. **Use Zero Page when possible** - Faster access and smaller code
2. **Initialize registers** - Always set X and Y before using indexed addressing
3. **Check flags after CMP** - Use appropriate branch instructions after comparisons
4. **End programs with HLT** - Prevents runaway execution
5. **Use labels for clarity** - Makes code more readable and maintainable

## Opcode Reference

### CMP Instruction Opcodes
| Addressing Mode | Opcode | Example |
|----------------|--------|---------|
| Immediate | 0xC9 | `CMP #$42` |
| Zero Page | 0xC5 | `CMP $00` |
| Absolute | 0xCD | `CMP $1000` |
| Zero Page,X | 0xD5 | `CMP $00,X` |
| Indirect,Y | 0xD1 | `CMP ($00),Y` |
| Absolute,X | 0xDD | `CMP $1000,X` |
| Absolute,Y | 0xD9 | `CMP $1000,Y` |

---

For complete API documentation, see [Developer API Reference](DEVELOPER_API.md).
For interactive programming examples, see [Interactive Terminal API](INTERACTIVE_TERMINAL_API.md).
