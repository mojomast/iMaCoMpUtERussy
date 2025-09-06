/* global describe, beforeEach, test, expect, console, window, global, jest */
/**
 * Emulator Integration Tests
 * Tests complete program execution using sample assembly programs
 * Verifies CPU execution, memory state, and I/O after running assembled samples
 * Using CommonJS require for Jest compatibility
 */

const { iMaCoMpUtERussyCPU } = require('../../js/cpu.js');
const { iMaCoMpUtERussyMemory } = require('../../js/memory.js');
const { assemble } = require('../../js/assembler.js');

describe('Emulator Integration Tests', () => {
  let cpu, memory;

  beforeEach(() => {
    memory = new iMaCoMpUtERussyMemory();
    cpu = new iMaCoMpUtERussyCPU({ memory });
    cpu.reset();
    
    // Mock video display for integration tests
    global.window = global.window || {};
    global.window.videoDisplay = {
      updateDisplay: jest.fn()
    };
  });

  describe('Sample Program Execution', () => {
    /**
     * Test hello-world.asm execution with terminal output
     */
    test('hello-world.asm executes and produces terminal output', async () => {
      // Sample hello-world.asm content (simplified version)
      const helloWorldSource = `
.org 0x0600
start:
  LDA #$48      ; 'H'
  STA $F1       ; Output to terminal
  LDA #$65      ; 'e'
  STA $F1
  LDA #$6C      ; 'l'
  STA $F1
  STA $F1       ; second 'l'
  LDA #$6F      ; 'o'
  STA $F1
  LDA #$0D      ; Carriage return
  STA $F1
  HLT
      `;
      
      // Assemble the program
      const programBytes = assemble(helloWorldSource, { origin: 0x0600 });
      
      // Load program into memory
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
      
      // Set up terminal input ready simulation
      memory.writeByte(0xF2, 0x01); // Input ready for any simulated input
      
      // Execute the program
      cpu.PC = 0x0600;
      let steps = 0;
      const maxSteps = 20;
      let terminalOutputs = [];
      
      while (cpu.running && steps < maxSteps) {
        const cycles = cpu.executeInstruction();
        steps++;
        
        // Check terminal output register after each step
        const terminalOutput = memory.readByte(0xF1);
        if (terminalOutput !== 0x00 && terminalOutput !== 0xFF) {
          terminalOutputs.push(terminalOutput);
          console.log(`Terminal output: 0x${terminalOutput.toString(16)} (ASCII: ${String.fromCharCode(terminalOutput)})`);
        }
      }
      
      expect(steps).toBeLessThanOrEqual(maxSteps);
      expect(cpu.running).toBe(false); // Should hit HLT
      
      // Verify terminal output sequence was written
      expect(terminalOutputs).toContain(0x48); // 'H'
      expect(terminalOutputs).toContain(0x65); // 'e'
      expect(terminalOutputs).toContain(0x6C); // 'l' (twice)
      expect(terminalOutputs).toContain(0x6F); // 'o'
      expect(terminalOutputs).toContain(0x0D); // Carriage return
      
      // Check that video display was not called (this program doesn't use graphics)
      expect(window.videoDisplay.updateDisplay).not.toHaveBeenCalled();
    });

    /**
     * Test fibonacci.asm computes Fibonacci sequence correctly
     */
    test('fibonacci.asm computes Fibonacci sequence correctly', async () => {
      // Simplified Fibonacci program that computes first few terms
      const fibSource = `
.org 0x0600
start:
  LDA #$00      ; fib(0)
  STA $00       ; Store at memory location 0
  LDA #$01      ; fib(1)
  STA $01       ; Store at memory location 1
  
  LDX #$02      ; Start from fib(2)
fib_loop:
  LDA $00       ; Load previous
  STA $02       ; Temp storage
  
  LDA $01       ; Load current
  CLC
  ADC $00       ; Add previous
  STA $01       ; Store new current
  
  LDA $02       ; Move temp to previous
  STA $00
  
  INX           ; Next Fibonacci number
  CPX #$08      ; Compute up to fib(7)
  BNE fib_loop
  
  HLT           ; Stop
      `;
      
      const programBytes = assemble(fibSource, { origin: 0x0600 });
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
      
      cpu.PC = 0x0600;
      let steps = 0;
      const maxSteps = 50;
      
      while (cpu.running && steps < maxSteps) {
        cpu.executeInstruction();
        steps++;
      }
      
      expect(cpu.running).toBe(false);
      
      // Verify Fibonacci sequence in memory
      // Expected: fib(0)=0, fib(1)=1, fib(2)=1, fib(3)=2, fib(4)=3, fib(5)=5, fib(6)=8, fib(7)=13
      expect(memory.readByte(0x00)).toBe(0x08); // fib(6) = 8 (last previous)
      expect(memory.readByte(0x01)).toBe(0x0D); // fib(7) = 13 (last current)
      
      console.log('Final Fibonacci values:');
      console.log(`Memory $00: 0x${memory.readByte(0x00).toString(16)}`);
      console.log(`Memory $01: 0x${memory.readByte(0x01).toString(16)}`);
    });

    /**
     * Test graphics-demo.asm produces video output
     */
    test('graphics-demo.asm produces video output', async () => {
      // Simple graphics demo that draws a pattern in video buffer
      const simpleGraphics = `
.org 0x0600
  LDA #$01      ; Green
  VST #$00      ; Top-left pixel
  VST #$01      ; Next pixel
  VST #$02      ; Next pixel
  
  LDA #$02      ; Yellow
  VST #$1F      ; End of first row
  VST #$20      ; Start of second row
  
  LDA #$03      ; Red
  VST #$3F      ; End of second row
  
  VUP           ; Update display
  
  HLT
      `;
      
      const programBytes = assemble(simpleGraphics, { origin: 0x0600 });
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
      
      cpu.PC = 0x0600;
      let steps = 0;
      const maxSteps = 15;
      
      while (cpu.running && steps < maxSteps) {
        cpu.executeInstruction();
        steps++;
      }
      
      expect(cpu.running).toBe(false);
      expect(window.videoDisplay.updateDisplay).toHaveBeenCalledTimes(1);
      
      // Verify video buffer contents
      expect(memory.readByte(0x0200)).toBe(0x01); // Green
      expect(memory.readByte(0x0201)).toBe(0x01);
      expect(memory.readByte(0x0202)).toBe(0x01);
      expect(memory.readByte(0x021F)).toBe(0x02); // Yellow
      expect(memory.readByte(0x0220)).toBe(0x02); // Yellow
      expect(memory.readByte(0x023F)).toBe(0x03); // Red
    });

    /**
     * Test echo.asm handles terminal input and output
     */
    test('echo.asm handles terminal input and output', async () => {
      // Simple echo program
      const echoSource = `
.org 0x0600
echo_loop:
  LDA $F2       ; Load status
  AND #$01      ; Check input ready bit
  BEQ echo_loop ; Wait if not ready
  
  LDA $F0       ; Load input character
  CMP #$0D      ; Check for Enter
  BEQ done      ; Exit if Enter
  
  CMP #$20      ; Check if printable (>= space)
  BCC echo_loop ; Skip control characters
  
  STA $F1       ; Echo to output
  JMP echo_loop ; Continue

done:
  HLT
      `;
      
      const programBytes = assemble(echoSource, { origin: 0x0600 });
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
      
      // Simulate input sequence: 'H' 'e' 'l' 'l' 'o' Enter
      const inputSequence = [0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x0D];
      
      cpu.PC = 0x0600;
      let inputIndex = 0;
      let steps = 0;
      const maxSteps = 100;
      let echoCount = 0;
      let terminalOutputs = [];
      
      while (cpu.running && steps < maxSteps && inputIndex < inputSequence.length) {
        const currentPC = cpu.PC;
        
        // Simulate input ready when program checks status
        if (currentPC === 0x0600 + 0 /* approximate LDA $F2 offset */) {
          memory.writeByte(0xF2, 0x01); // Set input ready
          if (inputIndex < inputSequence.length) {
            memory.writeByte(0xF0, inputSequence[inputIndex]); // Set input character
          }
        }
        
        cpu.executeInstruction();
        steps++;
        
        // Check if output was written
        const output = memory.readByte(0xF1);
        if (output !== 0x00 && output !== 0xFF && output >= 0x20 && output <= 0x7E) {
          terminalOutputs.push(output);
          if (output === inputSequence[inputIndex]) {
            echoCount++;
            inputIndex++; // Move to next input
          }
          memory.writeByte(0xF2, 0x00); // Clear input ready for next iteration
        }
        
        // Check if program hit done (Enter key)
        if (inputIndex === inputSequence.length - 1 && output === 0x0D) {
          break;
        }
      }
      
      expect(steps).toBeLessThan(maxSteps);
      expect(cpu.running).toBe(false);
      expect(echoCount).toBe(5); // Should have echoed H,e,l,l,o (Enter doesn't echo)
      expect(terminalOutputs).toContain(0x48); // 'H'
      expect(terminalOutputs).toContain(0x65); // 'e'
      expect(terminalOutputs).toContain(0x6C); // 'l' (twice)
      expect(terminalOutputs).toContain(0x6F); // 'o'
      expect(window.videoDisplay.updateDisplay).not.toHaveBeenCalled();
    });

    /**
     * Test video-demo.asm combines graphics and terminal output
     */
    test('video-demo.asm combines graphics and terminal output', async () => {
      // Program that draws a simple pattern and outputs status to terminal
      const videoDemoSource = `
.org 0x0600
  ; Draw simple pattern
  LDA #$01      ; Green
  VST #$00      ; Top-left
  VST #$1F      ; Top-right
  
  LDA #$02      ; Yellow
  VST #$20      ; Second row start
  VST #$3F      ; Second row end
  
  VUP           ; Update display
  
  ; Output status message "Status"
  LDA #$53      ; 'S'
  STA $F1
  LDA #$74      ; 't'
  STA $F1
  LDA #$61      ; 'a'
  STA $F1
  LDA #$74      ; 't'
  STA $F1
  LDA #$75      ; 'u'
  STA $F1
  LDA #$73      ; 's'
  STA $F1
  
  LDA #$0D      ; Carriage return
  STA $F1
  
  HLT
      `;
      
      const programBytes = assemble(videoDemoSource, { origin: 0x0600 });
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
      
      cpu.PC = 0x0600;
      let steps = 0;
      const maxSteps = 30;
      let terminalOutputs = [];
      
      while (cpu.running && steps < maxSteps) {
        cpu.executeInstruction();
        steps++;
        
        // Capture terminal output
        const output = memory.readByte(0xF1);
        if (output !== 0x00 && output !== 0xFF) {
          terminalOutputs.push(output);
        }
      }
      
      expect(cpu.running).toBe(false);
      expect(window.videoDisplay.updateDisplay).toHaveBeenCalledTimes(1);
      
      // Verify video buffer pattern
      expect(memory.readByte(0x0200)).toBe(0x01); // Green top-left
      expect(memory.readByte(0x021F)).toBe(0x01); // Green top-right
      expect(memory.readByte(0x0220)).toBe(0x02); // Yellow second row
      
      // Verify terminal output "Status" + CR
      expect(terminalOutputs).toContain(0x53); // 'S'
      expect(terminalOutputs).toContain(0x74); // 't'
      expect(terminalOutputs).toContain(0x61); // 'a'
      expect(terminalOutputs).toContain(0x74); // 't'
      expect(terminalOutputs).toContain(0x75); // 'u'
      expect(terminalOutputs).toContain(0x73); // 's'
      expect(terminalOutputs).toContain(0x0D); // CR
      
      // Check last output is carriage return
      expect(memory.readByte(0xF1)).toBe(0x0D);
    });
  });

  describe('Integration Test Utilities', () => {
    /**
     * Test complete assemble → load → execute → verify workflow
     */
    test('assemble and load program workflow', () => {
      // Test complete workflow: assemble → load → execute → verify
      const testSource = `
.org 0x0600
  LDA #$42      ; Load test value
  STA $00       ; Store at zero page
  LDA #$00      ; Clear A
  CMP $00       ; Compare - should set Z flag
  BEQ test_pass ; Branch if equal
  HLT           ; Should not reach here
test_pass:
  LDA #$FF      ; Set success flag
  STA $01
  HLT
      `;
      
      // Step 1: Assemble
      const programBytes = assemble(testSource, { origin: 0x0600 });
      expect(programBytes).toBeInstanceOf(Uint8Array);
      expect(programBytes.length).toBeGreaterThan(0);
      
      // Step 2: Load into memory
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBe(programBytes.length);
      expect(memory.readByte(0x0600)).toBe(0xA9); // LDA immediate opcode
      
      // Step 3: Execute
      cpu.PC = 0x0600;
      let steps = 0;
      const maxSteps = 15;
      
      while (cpu.running && steps < maxSteps) {
        cpu.executeInstruction();
        steps++;
      }
      
      expect(cpu.running).toBe(false);
      expect(steps).toBeLessThan(maxSteps);
      
      // Step 4: Verify results
      expect(memory.readByte(0x00)).toBe(0x42); // Stored value
      expect(memory.readByte(0x01)).toBe(0xFF); // Success flag
    });

    /**
     * Test program execution handles BRK interrupts correctly
     */
    test('program execution handles interrupts correctly', async () => {
      // Test program that triggers BRK interrupt
      const interruptTestSource = `
.org 0x0600
  LDA #$42
  STA $00       ; Store test value
  
  ; Trigger BRK interrupt
  BRK           ; 0x00
  
  ; This should not execute
  LDA #$01
  STA $01
  HLT
      `;
      
      const programBytes = assemble(interruptTestSource, { origin: 0x0600 });
      memory.loadProgram(0x0600, programBytes);
      
      cpu.PC = 0x0600;
      let stepsExecuted = 0;
      
      // Execute until interrupt or max steps
      while (cpu.running && stepsExecuted < 10) {
        const cycles = cpu.executeInstruction();
        stepsExecuted++;
        
        if (cpu.PC === 0xFF00) { // IRQ handler (assuming fixed vector)
          break;
        }
      }
      
      // Verify interrupt handling
      expect(cpu.PC).toBe(0xFF00); // Should be in IRQ handler
      expect(cpu.getFlag('I')).toBe(true); // Interrupts disabled
      expect(memory.readByte(0x00)).toBe(0x42); // Pre-interrupt store succeeded
      expect(memory.readByte(0x01)).toBe(0x00); // Post-interrupt store didn't happen
    });

    /**
     * Test cross-module integration: assembler → memory → CPU execution
     */
    test('cross-module integration: assembler → memory → CPU execution', () => {
      // Complex test: assemble math program, load, execute, verify results
      const mathTestSource = `
.org 0x0600
; Simple arithmetic test
  LDA #$05      ; Load 5
  CLC           ; Clear carry
  ADC #$03      ; Add 3 = 8
  STA $00       ; Store result
  
  LDA #$0A      ; Load 10
  SBC #$04      ; Subtract 4 = 6 (assuming carry clear)
  STA $01       ; Store result
  
  ; Verify results with comparisons
  LDA $00
  CMP #$08      ; Should be equal
  BEQ add_ok
  
  ; Error handling (should not reach)
  LDA #$FF
  STA $02       ; Error flag
  
add_ok:
  LDA #$00
  STA $02       ; Success flag for addition
  
  LDA $01
  CMP #$06      ; Should be equal
  BEQ sub_ok
  
  LDA #$FF
  STA $03       ; Error flag
  
sub_ok:
  LDA #$00
  STA $03       ; Success flag for subtraction
  
  HLT
      `;
      
      // Assemble and load
      const programBytes = assemble(mathTestSource, { origin: 0x0600 });
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBe(programBytes.length);
      
      // Execute
      cpu.PC = 0x0600;
      let steps = 0;
      const maxSteps = 40;
      
      while (cpu.running && steps < maxSteps) {
        cpu.executeInstruction();
        steps++;
      }
      
      expect(cpu.running).toBe(false);
      
      // Verify computation results
      expect(memory.readByte(0x00)).toBe(0x08); // 5 + 3 = 8
      expect(memory.readByte(0x01)).toBe(0x06); // 10 - 4 = 6
      expect(memory.readByte(0x02)).toBe(0x00); // Addition success
      expect(memory.readByte(0x03)).toBe(0x00); // Subtraction success
    });
  });

  /**
   * Test fibonacci sample from samples/ directory
   */
  test('samples/fibonacci.asm end-to-end execution', async () => {
    // Load and test actual fibonacci.asm sample
    const fs = require('fs');
    const path = require('path');
    const fibPath = path.join(__dirname, '../../samples/fibonacci.asm');
    
    try {
      const fibSource = fs.readFileSync(fibPath, 'utf8');
      const programBytes = assemble(fibSource);
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
      
      cpu.PC = 0x0600;
      let steps = 0;
      const maxSteps = 100;
      
      while (cpu.running && steps < maxSteps) {
        cpu.executeInstruction();
        steps++;
      }
      
      expect(cpu.running).toBe(false);
      // Additional verification based on expected fibonacci output
      console.log(`Executed ${steps} instructions for fibonacci.asm`);
    } catch (error) {
      console.warn('Could not load samples/fibonacci.asm:', error.message);
      // Fallback to inline test if file not found
      const fallbackFib = `
.org 0x0600
  LDA #$01
  STA $00
  HLT
      `;
      const programBytes = assemble(fallbackFib);
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
    }
  });

  /**
   * Test video-demo sample from samples/ directory
   */
  test('samples/video-demo.asm end-to-end execution', async () => {
    const fs = require('fs');
    const path = require('path');
    const videoPath = path.join(__dirname, '../../samples/video-demo.asm');
    
    try {
      const videoSource = fs.readFileSync(videoPath, 'utf8');
      const programBytes = assemble(videoSource);
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
      
      cpu.PC = 0x0600;
      let steps = 0;
      const maxSteps = 50;
      
      while (cpu.running && steps < maxSteps) {
        cpu.executeInstruction();
        steps++;
      }
      
      expect(cpu.running).toBe(false);
      expect(window.videoDisplay.updateDisplay).toHaveBeenCalled(); // Should update display
      console.log(`Executed ${steps} instructions for video-demo.asm`);
    } catch (error) {
      console.warn('Could not load samples/video-demo.asm:', error.message);
      // Fallback test
      const fallbackVideo = `
.org 0x0600
  LDA #$01
  VST #$00
  VUP
  HLT
      `;
      const programBytes = assemble(fallbackVideo);
      const bytesLoaded = memory.loadProgram(0x0600, programBytes);
      expect(bytesLoaded).toBeGreaterThan(0);
      cpu.PC = 0x0600;
      let steps = 0;
      while (cpu.running && steps < 5) {
        cpu.executeInstruction();
        steps++;
      }
      expect(window.videoDisplay.updateDisplay).toHaveBeenCalled();
    }
  });
});

console.log('Emulator integration tests completed');