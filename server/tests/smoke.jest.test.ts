import { describe, it, expect } from '@jest/globals';

describe('Smoke test', () => {
  it('should pass basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect('test').toEqual('test');
  });

  it('should support async operations', async () => {
    const asyncOperation = async () => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 100);
      });
    };
    
    const result = await asyncOperation();
    expect(result).toBe(true);
  });
});