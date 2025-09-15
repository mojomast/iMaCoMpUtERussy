; Test program for .db directive
; Simple test to verify the assembler handles .db correctly

.org 0x0600

START:
    LDA #$FF    ; Load 255 into A register
    STA $0200   ; Store to video buffer
    
    .db 0xAB    ; VUP instruction (Video Update)
    
    HLT         ; Halt
