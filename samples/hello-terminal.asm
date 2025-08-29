; Hello World Program for VideoStorage-8 Interactive Terminal
; Outputs "HELLO WORLD!" to the terminal

.org $0600

START:
    ; Output "HELLO WORLD!" character by character
    LDA #$48       ; 'H'
    STA $F1        ; Send to output
    
    LDA #$45       ; 'E'
    STA $F1
    
    LDA #$4C       ; 'L'
    STA $F1
    
    LDA #$4C       ; 'L'
    STA $F1
    
    LDA #$4F       ; 'O'
    STA $F1
    
    LDA #$20       ; ' ' (space)
    STA $F1
    
    LDA #$57       ; 'W'
    STA $F1
    
    LDA #$4F       ; 'O'
    STA $F1
    
    LDA #$52       ; 'R'
    STA $F1
    
    LDA #$4C       ; 'L'
    STA $F1
    
    LDA #$44       ; 'D'
    STA $F1
    
    LDA #$21       ; '!'
    STA $F1
    
    LDA #$0A       ; Line feed
    STA $F1
    
    HLT            ; Halt program
