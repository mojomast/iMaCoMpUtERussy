; Test program for VideoStorage-8 Emulator
; Simple program that loads and stores values

.org $0600

start:
    LDA #$42        ; Load 66 into accumulator
    STA $80         ; Store in zero page
    LDA #$FF        ; Load 255 into accumulator  
    STA $81         ; Store in next zero page location
    
    ; Add the two numbers
    LDA $80         ; Load first number
    ADC $81         ; Add second number (with possible carry)
    STA $82         ; Store result
    
    HLT             ; Stop execution
