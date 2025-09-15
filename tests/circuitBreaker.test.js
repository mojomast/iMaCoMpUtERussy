import { circuitBreaker, MCPError } from '../server/mcp_errors.js';

// Simple tests for circuit breaker behaviour
describe('CircuitBreaker basic', () => {
  test('execute success resets failure count', async () => {
    const original = circuitBreaker.getServiceBreaker('testService');
    const op = async () => 'ok';
    const res = await circuitBreaker.execute('testService', op, {});
    expect(res).toBe('ok');
    const status = circuitBreaker.getServiceBreaker('testService');
    expect(status.failureCount).toBe(0);
  });

  test('execute propagates errors', async () => {
    const op = async () => { throw new Error('boom'); };
    await expect(circuitBreaker.execute('testService', op, {})).rejects.toThrow('boom');
  });
});
