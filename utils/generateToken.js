import crypto from "crypto";

/**
 * Generates a cryptographically secure, URL-safe tracking token.
 * Uses 32 random bytes encoded as hex = 64-character unguessable string.
 * Has ~2^256 possible values — brute-force is computationally infeasible.
 */
export function generateTrackingToken() {
  return crypto.randomBytes(32).toString("hex");
}
