/**
 * Orion Utility Functions
 */

/**
 * Robust polling function with fixed interval and max tries.
 * @param fn Function that returns a promise of the result. Should return null/undefined if not found.
 * @param options Polling configuration
 * @returns The resolved result or throws after max retries.
 */
export async function poll<T>(
  fn: () => Promise<T | null | undefined>,
  options: {
    interval?: number;
    maxTries?: number;
    errorMsg?: string;
  } = {}
): Promise<T> {
  const { interval = 500, maxTries = 20, errorMsg = 'Operation timed out after polling' } = options;

  for (let i = 0; i < maxTries; i++) {
    try {
      const result = await fn();
      if (result !== null && result !== undefined) {
        return result;
      }
    } catch (e) {
      console.warn(`[Poll] Attempt ${i + 1} failed, retrying...`, e);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(errorMsg);
}
