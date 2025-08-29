#!/bin/bash

# MCP Integration Tests Runner Script
#
# This script runs complete integration tests for the MCP server and agent system.
# It handles server lifecycle, runs tests, generates reports, and provides
# comprehensive CI/CD support.
#
# Usage:
#   ./run-tests.sh [options]
#
# Options:
#   --ci        Run in CI mode (JUnit output, strict validation)
#   --debug     Enable debug logging
#   --quick     Run only essential tests
#   --perf      Run performance benchmarks
#   --health    Run health monitoring only
#   --output DIR    Output directory for reports
#
# Examples:
#   ./run-tests.sh                      # Run all integration tests
#   ./run-tests.sh --ci --debug         # CI mode with debug output
#   ./run-tests.sh --quick              # Quick validation only
#   ./run-tests.sh --perf --output ./reports  # Performance tests

set -e  # Exit on any error

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/reports}"
LOG_DIR="${OUTPUT_DIR}/logs"
SERVER_PORT=8001
SERVER_URL="http://localhost:${SERVER_PORT}"

# Parse command line arguments
CI_MODE=false
DEBUG_MODE=false
QUICK_MODE=false
PERF_MODE=false
HEALTH_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --ci)
      CI_MODE=true
      shift
      ;;
    --debug)
      DEBUG_MODE=true
      shift
      ;;
    --quick)
      QUICK_MODE=true
      shift
      ;;
    --perf)
      PERF_MODE=true
      shift
      ;;
    --health)
      HEALTH_ONLY=true
      shift
      ;;
    --output)
      OUTPUT_DIR="$2"
      LOG_DIR="${OUTPUT_DIR}/logs"
      shift 2
      ;;
    --help)
      echo "MCP Integration Test Runner"
      echo ""
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --ci         Run in CI mode (JUnit output, strict validation)"
      echo "  --debug      Enable debug logging"
      echo "  --quick      Run only essential tests"
      echo "  --perf       Run performance benchmarks"
      echo "  --health     Run health monitoring only"
      echo "  --output DIR Output directory for reports"
      echo "  --help       Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Set environment variables
export OUTPUT_DIR
export LOG_DIR
export SERVER_URL
export DEBUG_TESTS=${DEBUG_MODE}
export CI_MODE=${CI_MODE}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
info() {
  echo -e "${BLUE}ℹ️  $1${NC}" >&2
}

success() {
  echo -e "${GREEN}✅ $1${NC}" >&2
}

warning() {
  echo -e "${YELLOW}⚠️  $1${NC}" >&2
}

error() {
  echo -e "${RED}❌ $1${NC}" >&2
}

# Cleanup function
cleanup() {
  info "Cleaning up..."

  # Kill any running MCP servers
  if [[ -n "${SERVER_PID}" ]]; then
    if kill -0 ${SERVER_PID} 2>/dev/null; then
      info "Stopping MCP server (PID: ${SERVER_PID})"
      kill ${SERVER_PID} 2>/dev/null || true
      wait ${SERVER_PID} 2>/dev/null || true
    fi
  fi

  # Kill any remaining test processes
  pkill -f "mcp_server.js" || true
  pkill -f "node.*integration.*test" || true

  success "Cleanup completed"
}

# Error handler
error_handler() {
  error "Script failed at line $1"
  cleanup
  exit 1
}

# Set up error handling
trap 'error_handler $LINENO' ERR
trap cleanup EXIT

# Create output directories
mkdir -p "${OUTPUT_DIR}"
mkdir -p "${LOG_DIR}"

# Test results
TEST_RESULTS_FILE="${OUTPUT_DIR}/test-results.json"
PERF_REPORT_FILE="${OUTPUT_DIR}/performance-report.json"
HEALTH_REPORT_FILE="${OUTPUT_DIR}/health-report.json"

# Store PID of background processes
SERVER_PID=""

# Function to check if port is listening
wait_for_server() {
  local timeout=${1:-30}
  local count=0

  info "Waiting for MCP server to be ready (timeout: ${timeout}s)..."

  while [[ $count -lt $timeout ]]; do
    if curl -s "${SERVER_URL}/health" > /dev/null 2>&1; then
      success "MCP server is ready"
      return 0
    fi

    sleep 1
    ((count++))
  done

  error "MCP server failed to start within ${timeout} seconds"
  return 1
}

# Function to start MCP server
start_server() {
  info "Starting MCP server..."

  # Change to root directory for server startup
  cd "${ROOT_DIR}"

  # Start server in background
  npm run mcp-server > "${LOG_DIR}/server.log" 2>&1 &
  SERVER_PID=$!

  info "Server started with PID: ${SERVER_PID}"

  # Wait for server to be ready
  wait_for_server 30

  # Change back to script directory
  cd "${SCRIPT_DIR}"
}

# Function to run Node.js test
run_node_test() {
  local test_name="$1"
  local test_command="$2"
  local output_file="${OUTPUT_DIR}/${test_name}-results.json"

  info "Running ${test_name}..."

  if [[ "${DEBUG_MODE}" == "true" ]]; then
    extra_args="--debug"
  fi

  # Run test and capture output
  local start_time=$(date +%s)
  if eval "${test_command}" > "${LOG_DIR}/${test_name}.log" 2>&1; then
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Create result object
    cat > "${output_file}" << EOF
{
  "test": "${test_name}",
  "status": "passed",
  "duration": ${duration},
  "timestamp": "$(date -Iseconds)"
}
EOF

    success "${test_name} passed (${duration}s)"
    return 0
  else
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Create result object
    cat > "${output_file}" << EOF
{
  "test": "${test_name}",
  "status": "failed",
  "duration": ${duration},
  "timestamp": "$(date -Iseconds)"
}
EOF

    error "${test_name} failed (${duration}s)"
    return 1
  fi
}

# Function to run performance tests
run_performance_tests() {
  info "Running performance benchmarks..."

  local perf_output="${LOG_DIR}/performance.log"

  # Run benchmark and generate report
  node -e "
    import('./agent-mcp-integration.js').then(async m => {
      try {
        console.log('Starting performance benchmarks...');
        const results = await m.benchmarkMCPServer(50);
        console.log(JSON.stringify(results, null, 2));
      } catch (error) {
        console.error('Performance test failed:', error.message);
        process.exit(1);
      }
    })
  " > "${perf_output}" 2>&1

  if [[ $? -eq 0 ]]; then
    # Move performance report to output directory
    if [[ -f "./performance-report.json" ]]; then
      mv "./performance-report.json" "${PERF_REPORT_FILE}"
    fi
    success "Performance benchmarks completed"
    return 0
  else
    error "Performance benchmarks failed"
    return 1
  fi
}

# Function to run health monitoring
run_health_monitor() {
  info "Running health monitoring..."

  local health_output="${LOG_DIR}/health.log"

  # Run health check
  node -e "
    import('./agent-mcp-integration.js').then(async m => {
      try {
        const health = await m.monitorMCPIntegration();
        const metrics = await m.collectIntegrationMetrics();

        console.log(JSON.stringify({
          health: health,
          metrics: metrics,
          timestamp: new Date().toISOString()
        }, null, 2));
      } catch (error) {
        console.error('Health monitor failed:', error.message);
        process.exit(1);
      }
    })
  " > "${health_output}" 2>&1

  if [[ $? -eq 0 ]]; then
    success "Health monitoring completed"
    return 0
  else
    error "Health monitoring failed"
    return 1
  fi
}

# Function to generate summary report
generate_summary() {
  info "Generating test summary..."

  local total_tests=0
  local passed_tests=0
  local failed_tests=0
  local total_duration=0

  # Aggregate results from individual test files
  for result_file in "${OUTPUT_DIR}"/*-results.json; do
    if [[ -f "${result_file}" ]]; then
      if command -v jq >/dev/null 2>&1; then
        # Use jq if available
        local status=$(jq -r '.status' "${result_file}")
        local duration=$(jq -r '.duration' "${result_file}")

        ((total_tests++))
        if [[ "${status}" == "passed" ]]; then
          ((passed_tests++))
        else
          ((failed_tests++))
        fi

        total_duration=$((total_duration + duration))
      else
        # Fallback: simple grep parsing
        if grep -q '"status": "passed"' "${result_file}"; then
          ((passed_tests++))
        else
          ((failed_tests++))
        fi
        ((total_tests++))
      fi
    fi
  done

  # Create summary report
  cat > "${OUTPUT_DIR}/summary.json" << EOF
{
  "summary": {
    "total": ${total_tests},
    "passed": ${passed_tests},
    "failed": ${failed_tests},
    "duration": ${total_duration},
    "successRate": ${total_tests:+$(echo "scale=2; ${passed_tests} * 100 / ${total_tests}" | bc)}%,
    "timestamp": "$(date -Iseconds)",
    "ciMode": ${CI_MODE},
    "debugMode": ${DEBUG_MODE}
  },
  "configuration": {
    "serverUrl": "${SERVER_URL}",
    "outputDir": "${OUTPUT_DIR}",
    "logDir": "${LOG_DIR}",
    "mcpServer": "${ROOT_DIR}/server/mcp_server.js"
  },
  "testLogs": "${LOG_DIR}",
  "performanceReport": "${PERF_REPORT_FILE}",
  "healthReport": "${HEALTH_REPORT_FILE}"
}
EOF

  # Print summary
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎯 TEST EXECUTION SUMMARY"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Total Tests:      ${total_tests}"
  echo "Passed:          ${passed_tests}"
  echo "Failed:          ${failed_tests}"
  echo "Duration:        ${total_duration}s"
  echo "Success Rate:    ${total_tests:+$(echo "scale=2; ${passed_tests} * 100 / ${total_tests}" | bc)}%"
  echo ""
  echo "📂 Output Directory: ${OUTPUT_DIR}"
  echo "📋 Log Files: ${LOG_DIR}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ ${failed_tests} -gt 0 ]]; then
    warning "${failed_tests} test(s) failed. Check logs for details."
    return 1
  else
    success "All tests passed!"
    return 0
  fi
}

# Main execution logic
main() {
  local test_failures=0

  info "MCP Integration Test Runner"
  echo "Configuration:"
  echo "  CI Mode:       ${CI_MODE}"
  echo "  Debug Mode:    ${DEBUG_MODE}"
  echo "  Quick Mode:    ${QUICK_MODE}"
  echo "  Server URL:    ${SERVER_URL}"
  echo "  Output Dir:    ${OUTPUT_DIR}"

  # Validate setup first
  info "Validating test setup..."
  if node validate-setup.js; then
    success "Setup validation passed"
  else
    error "Setup validation failed"
    exit 1
  fi

  if [[ "${HEALTH_ONLY}" == "true" ]]; then
    # Health monitoring only
    start_server
    run_health_monitor || test_failures=$((test_failures + 1))
  elif [[ "${PERF_MODE}" == "true" ]]; then
    # Performance mode
    start_server
    run_performance_tests || test_failures=$((test_failures + 1))
  elif [[ "${QUICK_MODE}" == "true" ]]; then
    # Quick mode - just essential tests
    start_server

    run_node_test "client-integration" "node -e \"import('./agent-mcp-integration.js').then(m => m.testMCPClientIntegration())\"" || test_failures=$((test_failures + 1))
    run_node_test "agent-workflow" "node -e \"import('./agent-mcp-integration.js').then(m => m.testCodeGenerationWorkflow())\"" || test_failures=$((test_failures + 1))
  else
    # Full test suite
    start_server

    # Core integration tests
    run_node_test "client-integration" "node -e \"import('./agent-mcp-integration.js').then(m => m.testMCPClientIntegration())\"" || test_failures=$((test_failures + 1))
    run_node_test "agent-workflow" "node -e \"import('./agent-mcp-integration.js').then(m => m.testCodeGenerationWorkflow())\"" || test_failures=$((test_failures + 1))

    # Debugging and error handling
    if [[ "${CI_MODE}" == "false" ]]; then
      run_node_test "debugging-workflow" "node -e \"import('./agent-mcp-integration.js').then(m => m.testDebuggingWorkflow())\"" || test_failures=$((test_failures + 1))
      run_node_test "error-recovery" "node -e \"import('./agent-mcp-integration.js').then(m => m.testErrorRecovery())\"" || test_failures=$((test_failures + 1))
    fi

    # Performance and load testing
    run_node_test "load-performance" "node -e \"import('./agent-mcp-integration.js').then(m => m.testLoadPerformance())\"" || test_failures=$((test_failures + 1))

    # Health monitoring
    run_health_monitor || test_failures=$((test_failures + 1))

    # Performance benchmarks (long-running)
    if [[ "${CI_MODE}" == "false" ]]; then
      run_performance_tests || test_failures=$((test_failures + 1))
    fi
  fi

  # Generate final summary
  generate_summary

  # Exit with appropriate code
  if [[ ${test_failures} -gt 0 ]]; then
    error "Integration tests completed with ${test_failures} failure(s)"
    if [[ "${CI_MODE}" == "true" ]]; then
      exit 1
    fi
  else
    success "All integration tests completed successfully"
    exit 0
  fi
}

# Run main function
main "$@"