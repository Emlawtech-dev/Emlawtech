/**
 * Validation for Stellar public keys ("G..." addresses), following the
 * StrKey encoding: base32 of [version byte][32 byte key][CRC16-XModem].
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ED25519_PUBLIC_KEY_VERSION = 6 << 3;
const PUBLIC_KEY_LENGTH = 56;

/** CRC16-XModem checksum used by Stellar StrKey. */
export function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base32Decode(text: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** Encode a raw 32 byte ed25519 public key as a Stellar "G..." address. */
export function encodePublicKey(rawKey: Uint8Array): string {
  if (rawKey.length !== 32) {
    throw new RangeError("An ed25519 public key must be exactly 32 bytes");
  }
  const payload = new Uint8Array(33);
  payload[0] = ED25519_PUBLIC_KEY_VERSION;
  payload.set(rawKey, 1);
  const checksum = crc16Xmodem(payload);
  const full = new Uint8Array(35);
  full.set(payload, 0);
  full[33] = checksum & 0xff; // checksum is little-endian
  full[34] = checksum >>> 8;
  return base32Encode(full);
}

/** True when the text is a well-formed Stellar public key with a valid checksum. */
export function isValidPublicKey(key: string): boolean {
  if (key.length !== PUBLIC_KEY_LENGTH || !key.startsWith("G")) return false;
  const decoded = base32Decode(key);
  if (decoded === null || decoded.length !== 35) return false;
  if (decoded[0] !== ED25519_PUBLIC_KEY_VERSION) return false;
  const expected = crc16Xmodem(decoded.subarray(0, 33));
  const actual = (decoded[33] ?? 0) | ((decoded[34] ?? 0) << 8);
  return expected === actual;
}
