Merge & Sync Branch: Verify that the from-dusk-til-sonoma branch includes all commits from the main (parent) branch. Merge or rebase main into it if there are new changes. Resolve any merge conflicts so that no recent bugfixes or updates are missing.

Fix Syntax & Import Errors: Run linters and build the project to catch any syntax or import errors in the code. Fix typos, missing modules or mismatched names in all JavaScript/Python files. Remove or properly configure debug scripts (e.g. debug-imports.js, debug-server.js, debug_schemas.js, debug-test.html, dev-proxy.js). If these were for testing, either integrate them cleanly or delete them so they don’t break the build.

Resolve Incomplete Code Stubs: Search for any placeholder code (e.g. functions with only pass or commented “TODO”) and implement the intended logic. For example, ensure that any core routines in cpu.js, memory.js, or other modules are fully implemented and return correct results. The README mentions JSDoc comments in core modules
github.com
 – use those comments to guide filling in missing functionality and complete documentation strings.

Ensure UI Features Work: The branch’s recent UI enhancements must all be functional. Verify that the modular panel system (show/hide toggles), the fixed bottom toolbar with checkboxes, and the resizable CSS layout work correctly. In particular, test that theme/font settings and panel visibility settings persist via localStorage as documented
github.com
. If index.html is out-of-date, replace or update it with the working interface (see index-working.html). Fix any UI bugs so the interface matches the README’s description of features.

Complete Missing Features: Check for any high-level capabilities mentioned in the README or plan that aren’t yet implemented. For instance, ensure that voice-control commands (see VOICE_CONTROL_README.md) are actually wired into the system. Verify multi-model MCP support (phase 3.1) and onboarding/tutorial systems (phase 2.2) operate as expected. If any promised components (like the ARCHITECTURE.md file) are missing, create or complete them
github.com
. In particular, add the ARCHITECTURE.md file describing system design and data flow (it’s referenced in the README but not present)
github.com
.

Integrate Prompt Queue & Server APIs: Ensure the Prompt Queue (port 8002) and MCP server (port 8001) APIs are fully implemented and connected. Confirm that all REST endpoints for queue management and AI-client interactions exist and have handlers. Wire up the frontend controls to these backends: e.g. “Assemble/Run/Step/Reset” in the UI should call the appropriate server endpoints. Implement any missing error handling or retries (as mentioned under “Error Recovery” in docs). Also check save/load program functions – they should use the version-controlled persistence system with full metadata as intended.

Test and Improve Emulator: Run the 8-bit CPU emulator end-to-end. Fix any issues with assembling or execution. Add missing tests for assembler, execution, and memory (the test-.js files). Run the Jest suite (via jest.config.js) and fix any failing tests or increase coverage. The project aims for comprehensive testing
github.com
, so write new unit tests for uncovered parts (especially new features) and ensure coverage targets are met. Also test the memory inspector, I/O, and breakpoint features for bugs.

Quality & CI Setup: Add or fix automated testing and linting in CI. If GitHub Actions or similar workflows are not present, create them to automatically run tests and linters on push. Update package.json and requirements.txt so that dependencies are correct and up-to-date. Add useful scripts (e.g. npm start, npm test) if missing. Ensure the project builds on Node 22+ and Python as specified.

Clean Up Examples & Samples: Review the examples/ and samples/ directories. Make sure example programs and HTML files (e.g. simple-test.html) run without errors. Remove or fix any obsolete sample files. In docs or user guide, update sample code comments and I/O examples to match current behavior.

Update Documentation: Revise README files and markdown docs to reflect the current implementation. For example, create the promised ARCHITECTURE.md file
github.com
. Check that README_PROMPT_QUEUE.md, USER_GUIDE.md, and other docs match how the code actually works. Fill in any missing usage instructions (the Quick Start section, command examples, etc.). Remove references to unimplemented features. Ensure the JSDoc comments noted in the readme are present in the code for modules like cpu.js, memory.js, mcp-client.js
github.com
.

Document Issues & Plan: Log all the above tasks in the project’s development plan and devlog. For each fix, write a brief entry describing the issue and the change made. Update CHANGELOG.md, BUGS.MD, or FIXES_APPLIED.md as appropriate with clear notes. This will guide future coding and make progress transparent.