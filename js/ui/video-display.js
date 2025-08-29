/**
 * Video Display Terminal for iMaCoMpUtERussy
 * Renders memory-mapped framebuffer to HTML5 Canvas
 * Created by Kyle Durepos
 */

export class VideoDisplay {
    constructor(canvasElement, memory, width = 32, height = 24) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.memory = memory;
        this.width = width;
        this.height = height;
        this.pixelSize = 8; // 8x8 pixel blocks
        
        // Video buffer memory range: $0200-$05FF (1024 bytes = 32x32 pixels)
        this.bufferStart = 0x0200;
        this.bufferSize = 0x0400; // 1024 bytes
        
        // Setup canvas
        this.canvas.width = width * this.pixelSize;
        this.canvas.height = height * this.pixelSize;
        this.canvas.style.imageRendering = 'pixelated';
        
        // Color palette (simple 4-color)
        this.palette = [
            '#000000', // 0: Black
            '#00FF00', // 1: Green
            '#FFFF00', // 2: Yellow  
            '#FF0000'  // 3: Red
        ];
        
        this.clear();
    }
    
    /**
     * Clear the display (fill with black)
     */
    clear() {
        this.ctx.fillStyle = this.palette[0];
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Update display from video buffer
     * Called by VUP (Video Update) instruction
     */
    updateDisplay() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const addr = this.bufferStart + (y * this.width) + x;
                const pixelValue = this.memory.readByte(addr) & 0x03; // 2-bit color
                
                this.ctx.fillStyle = this.palette[pixelValue];
                this.ctx.fillRect(
                    x * this.pixelSize, 
                    y * this.pixelSize, 
                    this.pixelSize, 
                    this.pixelSize
                );
            }
        }
    }
    
    /**
     * Set pixel color in video buffer
     * @param {number} x - X coordinate (0-31)
     * @param {number} y - Y coordinate (0-23) 
     * @param {number} color - Color index (0-3)
     */
    setPixel(x, y, color) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const addr = this.bufferStart + (y * this.width) + x;
            this.memory.writeByte(addr, color & 0x03);
        }
    }
    
    /**
     * Get pixel color from video buffer
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate  
     * @returns {number} Color index (0-3)
     */
    getPixel(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const addr = this.bufferStart + (y * this.width) + x;
            return this.memory.readByte(addr) & 0x03;
        }
        return 0;
    }
}
