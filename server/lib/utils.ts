/**
 * Safely converts a value to string, preventing null/undefined toString crashes
 * @param val - The value to convert to a string
 * @returns The string representation of the value, or an empty string if null/undefined
 */
export function safeToString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  return String(val);
}