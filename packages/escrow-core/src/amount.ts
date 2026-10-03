/** Number of stroops in one XLM. Stellar amounts have 7 decimal places. */
export const STROOPS_PER_XLM = 10_000_000n;

/** Largest amount Stellar can represent (signed 64-bit integer of stroops). */
export const MAX_STROOPS = 9_223_372_036_854_775_807n;

const XLM_PATTERN = /^\d+(\.\d{1,7})?$/;

/**
 * Parse a decimal XLM string such as "12.5" into stroops.
 *
 * Amounts are handled as integers (bigint) so no floating point rounding can
 * ever change how much money moves. Throws a RangeError for malformed input
 * or values above the Stellar maximum.
 */
export function parseXlm(input: string): bigint {
  const value = input.trim();
  if (!XLM_PATTERN.test(value)) {
    throw new RangeError(
      `Invalid XLM amount "${input}": expected a non-negative decimal with at most 7 decimal places`,
    );
  }
  const [whole = "0", fraction = ""] = value.split(".");
  const stroops = BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, "0"));
  if (stroops > MAX_STROOPS) {
    throw new RangeError(`Invalid XLM amount "${input}": exceeds the Stellar maximum`);
  }
  return stroops;
}

/**
 * Format stroops as a decimal XLM string, dropping unneeded trailing zeros.
 * 125000000n becomes "12.5" and 10000000n becomes "1".
 */
export function formatStroops(stroops: bigint): string {
  if (stroops < 0n) {
    throw new RangeError("Amount cannot be negative");
  }
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}
