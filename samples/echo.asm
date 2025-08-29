; Echo Program for VideoStorage-8 Interactive Terminal
; Reads characters from input and echoes them to output
; Uses memory-mapped I/O at addresses $F0, $F1, $F2

.org $0600

ECHO_LOOP:
    ; Check if input is available
    LDA $F2        ; Load status register
    AND #$01       ; Check bit 0 (input ready)
    BEQ ECHO_LOOP  ; If no input, keep waiting
    
    ; Read character from input
    LDA $F0        ; Load character from input register
    
    ; Check for special characters
    CMP #$0D       ; Is it carriage return (Enter)?
    BEQ NEWLINE    ; If yes, handle newline
    
    CMP #$1B       ; Is it ESC character?
    BEQ EXIT       ; If yes, exit program
    
    ; Echo character to output
    STA $F1        ; Store character to output register
    JMP ECHO_LOOP  ; Continue loop
    
NEWLINE:
    LDA #$0A       ; Load line feed character
    STA $F1        ; Send to output
    JMP ECHO_LOOP  ; Continue loop
    
EXIT:
    ; Send goodbye message
    LDA #$42       ; 'B'
    STA $F1
    LDA #$59       ; 'Y'
    STA $F1
    LDA #$45       ; 'E'
    STA $F1
    LDA #$0A       ; Line feed
    STA $F1
    
    HLT            ; Halt program
