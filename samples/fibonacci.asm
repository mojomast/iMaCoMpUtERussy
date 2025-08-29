; VideoStorage-8 Fibonacci Sequence Example
; Computes first 4 Fibonacci numbers: 0, 1, 1, 2
; Stores them in zero page addresses $00, $01, $02, $03
; Demonstrates LDA, STA, ADC, HLT with zero page addressing

.org 0x0600     ; Set program origin to user RAM start

FIB:
    LDA #0      ; Load 0
    STA 0x00    ; Store fib(0) at $00

    LDA #1      ; Load 1
    STA 0x01    ; Store fib(1) at $01

    LDA 0x01    ; Load fib(1)
    ADC 0x00    ; Add fib(0) -> 1+0=1
    STA 0x02    ; Store fib(2) at $02

    LDA 0x01    ; Load fib(1)
    ADC 0x02    ; Add fib(2) -> 1+1=2
    STA 0x03    ; Store fib(3) at $03

    HLT         ; Halt execution

; To assemble and load this program:
; 1. Read this .asm file as a string
; 2. Call assemble(source) from js/assembler.js
; 3. Call memory.loadProgram(0x0600, assembledBytes) from js/memory.js
; 4. Run the CPU starting at $0600
; 5. Check memory $00-$03 for values 0, 1, 1, 2