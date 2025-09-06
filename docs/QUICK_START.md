# iMaCoMpUtERussy Quick Start Guide

Get up and running with the iMaCoMpUtERussy interactive emulator in minutes!

## 🚀 Installation & Setup

### Method 1: Node.js (Recommended)

1. **Clone or download** the project to your computer
2. **Open terminal/command prompt** in the project directory
3. **Run the server**:
   ```bash
   npm start
   ```
4. **Open your browser** to: http://localhost:8000

### Method 2: Python Server

1. **Open terminal/command prompt** in the project directory
2. **Start Python server**:
   ```bash
   python -m http.server 8000
   ```
3. **Open your browser** to: http://localhost:8000

## 🎮 First Steps

### 1. Load Your First Program

1. **Select a sample program** from the dropdown:
   - **"Fibonacci"** for a math demonstration
   - **"Hello World"** for terminal output
   - **"Echo"** for interactive communication

2. **Click "Load Selected Sample"**

3. **Watch the interface update**:
   - Memory viewer shows the loaded program
   - Registers display shows CPU state
   - Console shows loading confirmation

### 2. Run the Program

**Option A: Step Through (Recommended for Learning)**
1. **Click "Step"** to execute one instruction at a time
2. **Watch the changes**:
   - PC (Program Counter) advances
   - Memory values change
   - Register values update
3. **Continue stepping** until the program completes

**Option B: Run Continuously**
1. **Click "Run"** to execute at full speed
2. **Adjust speed** with the slider (1-1000 Hz)
3. **Program stops automatically** when complete

### 3. Try Interactive Programs

**Load the Echo Program:**
1. Select **"Echo"** from the dropdown
2. **Load and Run** the program
3. **Type in the Interactive Terminal** at the bottom
4. **Press Enter** and watch the program echo your input!
5. **Send ESC** to exit the program

## 🖥️ Understanding the Interface

![Emulator debugger UI with highlighted controls](images/emulator-debugger-ui-screenshot.png)
### Debugger Section (Top Left)
- **File loading controls** for your own .asm files
- **Sample program selector** with educational examples
- **Execution controls**: Step, Run, Reset
- **Speed control** for continuous execution

### Memory Viewer (Top Right)
- **Zero Page (0x0000-0x00FF)**: Variables and I/O registers
- **Program Area (0x0600-0x06FF)**: Your loaded program code
- **Live updates** during execution

### Registers Display
- **PC**: Program Counter (current instruction address)
- **A, X, Y**: CPU registers
- **Status**: RUNNING or HALTED
- **Flags**: CPU status flags (Carry, Zero, etc.)

### Console Output (Bottom Left)
- **System messages** and loading information
- **Step-by-step execution trace** showing each instruction
- **Error messages** and debugging information

### Interactive Terminal (Bottom Right)
- **Program output** appears here automatically
- **Input field** to type commands/text to programs
- **Send button** or press Enter to transmit input
- **Clear button** to reset terminal display

## 📝 Writing Your Own Programs

### Basic Program Structure

```assembly
; Comments start with semicolon
.org $0600          ; Program starts at address $0600

MAIN:
    LDA #$42        ; Load value 66 into accumulator
    STA $00         ; Store in memory location $00
    HLT             ; Halt program
```

### Interactive Program Template

```assembly
.org $0600

LOOP:
    ; Check for input
    LDA $F2         ; Load I/O status
    AND #$01        ; Check input ready bit
    BEQ LOOP        ; Wait if no input
    
    ; Process input
    LDA $F0         ; Read character
    STA $F1         ; Echo to output
    
    ; Check for exit (ESC key)
    CMP #$1B
    BEQ EXIT
    JMP LOOP

EXIT:
    HLT             ; Stop program
```

### Loading Your Program

1. **Save your code** as a `.asm` file
2. **Click "Load Assembly File"** and select your file
3. **Watch it load** into memory
4. **Run or step through** your program

## 🎯 Learning Path

### Beginner
1. **Start with Fibonacci** - understand basic execution
2. **Try Hello World** - see terminal output
3. **Experiment with Echo** - interactive communication
4. **Modify samples** - change values and see results

### Intermediate
1. **Write simple programs** using the template above
2. **Learn the instruction set** - See [Instruction Set Reference](INSTRUCTION_SET.md) for complete details
3. **Use memory viewer** to understand data storage
4. **Create interactive programs** using I/O registers

### Advanced
1. **Study the sample programs** source code
2. **Write complex interactive software**
3. **Explore the video steganography features**
4. **Contribute to the project** on GitHub

## 🔧 Troubleshooting

### Program Won't Load
- **Check file format**: Must be `.asm` or `.txt`
- **Verify syntax**: Look for assembly errors in console
- **Try samples first**: Ensure system is working

### No Terminal Output
- **Verify program writes to $F1**: Output register
- **Check program is running**: Should show "RUNNING" status
- **Try Hello World sample**: Known working output program

### Input Not Working
- **Ensure program reads $F2**: Status register first
- **Check input ready bit**: AND with #$01
- **Try Echo sample**: Known working input program

### Program Stops Immediately
- **Look for HLT instruction**: Programs should end with HLT
- **Check for infinite loops**: Use Step mode to debug
- **Verify origin address**: Should be .org $0600

## 🎓 Next Steps

- **Read the API documentation** for advanced programming
- **Explore video steganography features** for hiding code in videos
- **Join the community** and share your programs
- **Check out the source code** to understand the implementation

## 📚 Additional Resources

- [Interactive Terminal API](./docs/INTERACTIVE_TERMINAL_API.md) - Complete I/O programming guide
- [Developer API Reference](./docs/DEVELOPER_API.md) - Full system API documentation
- [Sample Programs](./samples/) - Educational example code
- [Test Suite](./tests/) - Understanding system behavior

Happy coding with iMaCoMpUtERussy! 🎮
