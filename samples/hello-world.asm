; iMaCoMpUtERussy Hello World Example
; Demonstrates terminal output using I/O registers
; Outputs "Hello World!" to the interactive terminal
; Uses memory-mapped I/O: $F1 (output register), $F2 (status register)
; Load at $0600 and run to see output in the terminal panel

.org 0x0600     ; Set program origin to user RAM start

START:
    ; Output 'H' (ASCII 72)
    LDA #72      ; Load 'H' into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'e' (ASCII 101)
    LDA #101     ; Load 'e' into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'l' (ASCII 108)
    LDA #108     ; Load 'l' into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'l' (ASCII 108)
    LDA #108     ; Load 'l' into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'o' (ASCII 111)
    LDA #111     ; Load 'o' into accumulator
    STA $F1      ; Store to output register
    
    ; Output space (ASCII 32)
    LDA #32      ; Load space into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'W' (ASCII 87)
    LDA #87      ; Load 'W' into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'o' (ASCII 111)
    LDA #111     ; Load 'o' into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'r' (ASCII 114)
    LDA #114     ; Load 'r' into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'l' (ASCII 108)
    LDA #108     ; Load 'l' into accumulator
    STA $F1      ; Store to output register
    
    ; Output 'd' (ASCII 100)
    LDA #100     ; Load 'd' into accumulator
    STA $F1      ; Store to output register
    
    ; Output '!' (ASCII 33)
    LDA #33      ; Load '!' into accumulator
    STA $F1      ; Store to output register
    
    ; Output newline (ASCII 10)
    LDA #10      ; Load newline into accumulator
    STA $F1      ; Store to output register
    
    HLT          ; Halt execution

; To assemble and load this program:
; 1. Read this .asm file as a string
; 2. Call assemble(source) from js/assembler.js
; 3. Call memory.loadProgram(0x0600, assembledBytes) from js/memory.js
; 4. Run the CPU starting at $0600
; 5. Watch the Interactive Terminal panel for "Hello World!" output

; Expected output in terminal:
; Hello World!

; Memory usage:
; - Program: 0x0600 - 0x061D (30 bytes)
; - I/O registers: $F0 (input), $F1 (output), $F2 (status)
; - No additional data storage required