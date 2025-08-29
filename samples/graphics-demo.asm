; Simple Graphics Demo for VideoStorage-8
; Draws a pattern on the video display using memory-mapped graphics

.org $0600

START:
    ; Draw corners - Green color
    LDA #$01       ; Green color
    STA $0200      ; Top-left corner (row 0, col 0)
    STA $021F      ; Top-right corner (row 0, col 31)
    STA $02E0      ; Bottom-left corner (row 23, col 0)  
    STA $02FF      ; Bottom-right corner (row 23, col 31)
    
    ; Draw a cross in the center - Yellow color
    LDA #$02       ; Yellow color
    STA $0290      ; Center pixel (row 12, col 16)
    STA $028F      ; Left of center
    STA $0291      ; Right of center
    STA $0270      ; Above center (row 11, col 16)
    STA $02B0      ; Below center (row 13, col 16)
    
    ; Update display to show changes
    VUP            ; Video Update - refresh the display
    
    ; Wait a bit  
    VDL #$3C       ; Video Delay - wait 60 frames (1 second at 60fps)
    
    ; Flash the corners - Red color
    LDA #$03       ; Red color
    STA $0200      ; Top-left
    STA $021F      ; Top-right
    STA $02E0      ; Bottom-left
    STA $02FF      ; Bottom-right
    
    VUP            ; Update display
    VDL #$3C       ; Wait 1 second
    
    ; Return corners to green
    LDA #$01       ; Green color
    STA $0200
    STA $021F
    STA $02E0
    STA $02FF
    
    VUP            ; Final update
    
    HLT            ; End program

; Notes:
; Video buffer is at $0200-$05FF (1024 bytes)
; Display is 32x24 pixels (768 total pixels)
; Each byte represents one pixel with 2-bit color:
;   00 = Black, 01 = Green, 10 = Yellow, 11 = Red
; Address calculation: $0200 + (row * 32) + col
