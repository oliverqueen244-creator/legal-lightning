/**
 * Timing obfuscation utility for edge functions
 * Adds random delay (50-200ms) to prevent timing analysis attacks
 */

export function randomDelay(minMs = 50, maxMs = 200): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Wraps a response with timing obfuscation
 * Ensures consistent response time regardless of actual processing time
 */
export async function obfuscatedResponse<T>(
  operation: () => Promise<T>,
  minDelayMs = 50,
  maxDelayMs = 200
): Promise<T> {
  const startTime = Date.now();
  const result = await operation();
  
  // Calculate remaining delay needed
  const elapsed = Date.now() - startTime;
  const targetDelay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
  const remainingDelay = Math.max(0, targetDelay - elapsed);
  
  if (remainingDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingDelay));
  }
  
  return result;
}
