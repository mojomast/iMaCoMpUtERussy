; VideoStorage-8 Hello World Example
; Minimal program demonstrating LDA, STA, HLT instructions
; Assembles to: A9 0A 85 00 3A (LDA #10, STA $00, HLT)
; Load at $0600 and run to store value 10 at memory address $00

.org 0x0600     ; Set program origin to user RAM start

START:
    LDA #10      ; Load immediate value 10 into accumulator
    STA 0x00     ; Store accumulator to zero page address $00
    HLT          ; Halt execution

; To assemble and load this program:
; 1. Read this .asm file as a string
; 2. Call assemble(source) from js/assembler.js
; 3. Call memory.loadProgram(0x0600, assembledBytes) from js/memory.js
; 4. Run the CPU starting at $0600