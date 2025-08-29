; VideoStorage-8 Video Buffer Demo
; Writes a simple pattern to the video buffer region ($0200-$05FF)
; Demonstrates STA, LDX, INX, and absolute addressing
; Writes alternating 0xFF and 0x00 to first 8 bytes of video buffer

.org 0x0600     ; Set program origin to user RAM start

VIDEO_DEMO:
    LDX #0       ; Initialize X register to 0
    LDA #255     ; Load 0xFF (white pixel)
    STA 0x0200   ; Store to video buffer start

    INX          ; Increment X
    LDA #0       ; Load 0x00 (black pixel)
    STA 0x0200,X ; Store to $0201

    INX          ; Increment X
    LDA #255     ; Load 0xFF
    STA 0x0200,X ; Store to $0202

    INX          ; Increment X
    LDA #0       ; Load 0x00
    STA 0x0200,X ; Store to $0203

    INX          ; Increment X
    LDA #255     ; Load 0xFF
    STA 0x0200,X ; Store to $0204

    INX          ; Increment X
    LDA #0       ; Load 0x00
    STA 0x0200,X ; Store to $0205

    INX          ; Increment X
    LDA #255     ; Load 0xFF
    STA 0x0200,X ; Store to $0206

    INX          ; Increment X
    LDA #0       ; Load 0x00
    STA 0x0200,X ; Store to $0207

    HLT          ; Halt execution

; To assemble and load this program:
; 1. Read this .asm file as a string
; 2. Call assemble(source) from js/assembler.js
; 3. Call memory.loadProgram(0x0600, assembledBytes) from js/memory.js
; 4. Run the CPU starting at $0600
; 5. Check video buffer $0200-$0207 for pattern FF 00 FF 00 FF 00 FF 00