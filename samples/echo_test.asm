; Echo Test Program for iMaCoMpUtERussy
; Tests terminal I/O functionality
; Reads input from $F0 and echoes it to $F1

.org $0600

start:
    ; Wait for input ready
wait_input:
    LDA $F2         ; Load terminal status register
    AND #$01        ; Check input ready bit (bit 0)
    BEQ wait_input  ; If not ready, keep waiting
    
    ; Read input character
    LDA $F0         ; Read from keyboard input buffer
    CMP #$00        ; Check if null terminator
    BEQ done        ; If so, we're done
    
    ; Echo character to output
    STA $F1         ; Write to terminal output register
    
    ; Continue loop
    JMP wait_input

done:
    ; Output newline for clean termination
    LDA #$0A        ; Line feed
    STA $F1         ; Write to terminal
    
    HLT             ; Stop execution
