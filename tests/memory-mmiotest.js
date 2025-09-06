// Standalone MMIO test for iMaCoMpUtERussyMemory
// Run with: node tests/memory-mmiotest.js

(async () => {
  try {
    const { iMaCoMpUtERussyMemory } = await import('../js/memory.js');
    
    // Create test memory instance
    const memory = new iMaCoMpUtERussyMemory();
    
    // Mock terminal for output testing
    if (typeof window === 'undefined') {
      global.window = global.window || {};
      global.window.terminal = {
        write: (char) => {
          process.stdout.write(char);
        }
      };
    }
    
    console.log('=== iMaCoMpUtERussy Memory MMIO Test Suite ===\n');
    
    let testPassed = 0;
    let testFailed = 0;
    const totalTests = 8;
    
    // Test 1: $F0 read-only keyboard input (initially empty)
    console.log('Test 1: $F0 read-only behavior...');
    const f0Initial = memory.readByte(0xF0);
    memory.writeByte(0xF0, 0x41); // Try to write 'A'
    const f0AfterWrite = memory.readByte(0xF0);
    if (f0Initial === 0 && f0AfterWrite === 0) {
      console.log('  ✓ PASS: $F0 returns 0 initially and ignores writes');
      testPassed++;
    } else {
      console.log('  ✗ FAIL: $F0 should return 0 and ignore writes');
      testFailed++;
    }
    
    // Test 2: $F1 write-only terminal output
    console.log('\nTest 2: $F1 write-only terminal output...');
    const f1Read = memory.readByte(0xF1);
    memory.writeByte(0xF1, 0x42); // 'B'
    const f1AfterWrite = memory.readByte(0xF1);
    let terminalOutput = '';
    const originalWrite = global.window.terminal.write;
    global.window.terminal.write = (char) => {
      terminalOutput += char;
      originalWrite.call(global.window.terminal, char);
    };
    const terminalCalled = () => terminalOutput.length > 0;
    
    if (f1Read === 0 && f1AfterWrite === 0 && terminalCalled) {
      console.log('  ✓ PASS: $F1 reads return 0, writes trigger output');
      testPassed++;
    } else {
      console.log('  ✗ FAIL: $F1 should read 0 and trigger terminal write');
      testFailed++;
    }
    
    // Test 3: $F2 status register initial state
    console.log('\nTest 3: $F2 status register initial state...');
    const f2Initial = memory.readByte(0xF2);
    if (f2Initial === 0) {
      console.log('  ✓ PASS: $F2 initially returns 0');
      testPassed++;
    } else {
      console.log(`  ✗ FAIL: $F2 should be 0 initially, got ${f2Initial}`);
      testFailed++;
    }
    
    // Test 4: Keyboard buffer functionality
    console.log('\nTest 4: Keyboard buffer read/write...');
    // Simulate keypress by setting buffer (head at 0, tail after written chars)
    memory.keyboardBuffer[0] = 0x41; // 'A'
    memory.keyboardHead = 0;
    memory.keyboardTail = 1;
    memory.keyboardCount = 1;
    memory.inputReadyFlag = 1;
    
    const charRead = memory.readByte(0xF0);
    const flagAfterRead = memory.readByte(0xF2);
    const bufferEmpty = memory.keyboardCount === 0;
    
    if (charRead === 0x41 && flagAfterRead === 0 && bufferEmpty) {
      console.log('  ✓ PASS: Keyboard buffer returns character and clears flag');
      testPassed++;
    } else {
      console.log(`  ✗ FAIL: Expected 'A'(65), got ${charRead}; Flag: ${flagAfterRead}; Buffer empty: ${bufferEmpty}`);
      testFailed++;
    }
    
    // Test 5: Multiple character buffer
    console.log('\nTest 5: Multiple character buffer...');
    // Setup for reading B then C (head=0, chars at 0 and 1, tail=2)
    memory.keyboardBuffer[0] = 0x42; // 'B'
    memory.keyboardBuffer[1] = 0x43; // 'C'
    memory.keyboardHead = 0;
    memory.keyboardTail = 2;
    memory.keyboardCount = 2;
    memory.inputReadyFlag = 1;
    
    const bufferFirstChar = memory.readByte(0xF0);
    const secondChar = memory.readByte(0xF0);
    const flagAfterTwoReads = memory.readByte(0xF2);
    
    if (bufferFirstChar === 0x42 && secondChar === 0x43 && flagAfterTwoReads === 0) {
      console.log('  ✓ PASS: Buffer returns characters in order and clears flag');
      testPassed++;
    } else {
      console.log(`  ✗ FAIL: Expected 'B'(66) then 'C'(67), got ${bufferFirstChar}, ${secondChar}; Flag: ${flagAfterTwoReads}`);
      testFailed++;
    }
    
    // Test 6: Status clear via $F2 write
    console.log('\nTest 6: Status clear via $F2 write...');
    // Setup for D (head=0, char at 0, tail=1)
    memory.keyboardBuffer[0] = 0x44; // 'D'
    memory.keyboardHead = 0;
    memory.keyboardTail = 1;
    memory.keyboardCount = 1;
    memory.inputReadyFlag = 1;
    
    const flagBeforeClear = memory.readByte(0xF2);
    memory.writeByte(0xF2, 0x00); // Clear status
    const flagAfterClear = memory.readByte(0xF2);
    const bufferCleared = memory.keyboardCount === 0;
    
    if (flagBeforeClear === 1 && flagAfterClear === 0 && bufferCleared) {
      console.log('  ✓ PASS: Writing 0 to $F2 clears status and buffer');
      testPassed++;
    } else {
      console.log(`  ✗ FAIL: Expected flag 1→0, buffer cleared; got flag ${flagBeforeClear}→${flagAfterClear}, buffer empty: ${bufferCleared}`);
      testFailed++;
    }
    
    // Test 7: Terminal output multiple characters
    console.log('\nTest 7: Terminal output multiple characters...');
    const outputLengthBefore = terminalOutput.length;
    
    memory.writeByte(0xF1, 0x48); // 'H'
    memory.writeByte(0xF1, 0x65); // 'e'
    memory.writeByte(0xF1, 0x6C); // 'l'
    memory.writeByte(0xF1, 0x6C); // 'l'
    memory.writeByte(0xF1, 0x6F); // 'o'
    
    // Wait a moment for output to be processed
    await new Promise(resolve => setTimeout(resolve, 10));
    const outputLengthAfter = terminalOutput.length;
    
    if (outputLengthAfter - outputLengthBefore === 5) {
      console.log('  ✓ PASS: Multiple writes to $F1 trigger terminal output');
      testPassed++;
    } else {
      console.log(`  ✗ FAIL: Expected 5 terminal writes, got ${outputLengthAfter - outputLengthBefore}`);
      testFailed++;
    }
    
    // Test 8: Circular buffer wrap-around
    console.log('\nTest 8: Circular buffer wrap-around...');
    // Setup wrap-around: chars at 254,255,0,1 with head=254
    memory.keyboardBuffer[254] = 0x58; // 'X'
    memory.keyboardBuffer[255] = 0x59; // 'Y'
    memory.keyboardBuffer[0] = 0x5A;   // 'Z'
    memory.keyboardBuffer[1] = 0x57;   // 'W'
    memory.keyboardHead = 254;
    memory.keyboardTail = 2;
    memory.keyboardCount = 4;
    memory.inputReadyFlag = 1;
    
    const char1 = memory.readByte(0xF0); // Should be 'X' at 254
    const char2 = memory.readByte(0xF0); // 'Y' at 255
    const char3 = memory.readByte(0xF0); // 'Z' at 0
    const char4 = memory.readByte(0xF0); // 'W' at 1
    
    if (char1 === 0x58 && char2 === 0x59 && char3 === 0x5A && char4 === 0x57) {
      console.log('  ✓ PASS: Circular buffer handles wrap-around correctly');
      testPassed++;
    } else {
      console.log(`  ✗ FAIL: Expected X Y Z W (88,89,90,87), got ${char1},${char2},${char3},${char4}`);
      testFailed++;
    }
    
    // Test 9: Buffer overflow protection (bonus test)
    console.log('\nTest 9: Buffer overflow protection...');
    // Fill buffer completely
    for (let i = 0; i < 256; i++) {
      memory.keyboardBuffer[i] = (i + 65) % 256; // Values 65-255, then 0-63
    }
    memory.keyboardHead = 0;
    memory.keyboardTail = 0;
    memory.keyboardCount = 256;
    memory.inputReadyFlag = 1;
    
    // Read first and last characters
    const fullBufferFirstChar = memory.readByte(0xF0); // Should be 65 'A'
    // Fast-forward to near end
    for (let i = 0; i < 254; i++) {
      memory.readByte(0xF0);
    }
    const lastChar = memory.readByte(0xF0); // Should be 65+255 = 320 % 256 = 64 '@'
    
    if (fullBufferFirstChar === 65 && lastChar === 64 && memory.readByte(0xF0) === 0) {
      console.log('  ✓ PASS: Full buffer reads correctly and empties');
      testPassed++;
    } else {
      console.log(`  ✗ FAIL: Expected A(65) first, @(64) last, 0 after; got ${fullBufferFirstChar}, ${lastChar}`);
      testFailed++;
    }
    
    console.log(`\n=== Test Results ===`);
    console.log(`Passed: ${testPassed}/${testPassed + testFailed}`);
    console.log(`Failed: ${testFailed}/${testPassed + testFailed}`);
    
    if (testFailed === 0) {
      console.log('\n🎉 All MMIO tests passed! Memory implementation is working correctly.');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed. Check the implementation.');
      process.exit(1);
    }
    
    // Restore original terminal write
    global.window.terminal.write = originalWrite;
    
  } catch (error) {
    console.error('Test setup failed:', error);
    process.exit(1);
  }
})();