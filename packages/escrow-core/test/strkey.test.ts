import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crc16Xmodem, encodePublicKey, isValidPublicKey } from "../src/strkey.js";

describe("crc16Xmodem", () => {
  it("matches the standard check value for '123456789'", () => {
    const bytes = new TextEncoder().encode("123456789");
    assert.equal(crc16Xmodem(bytes), 0x31c3);
  });
});

describe("encodePublicKey / isValidPublicKey", () => {
  it("accepts the all-zero key, a well-known valid address", () => {
    const key = encodePublicKey(new Uint8Array(32));
    assert.equal(key, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    assert.equal(isValidPublicKey(key), true);
  });

  it("accepts keys it encoded from arbitrary bytes", () => {
    const raw = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256);
    assert.equal(isValidPublicKey(encodePublicKey(raw)), true);
  });

  it("rejects a key with a corrupted character", () => {
    const key = encodePublicKey(Uint8Array.from({ length: 32 }, (_, i) => i));
    const tampered = key.slice(0, 10) + (key[10] === "A" ? "B" : "A") + key.slice(11);
    assert.equal(isValidPublicKey(tampered), false);
  });

  it("rejects wrong length, wrong prefix and invalid characters", () => {
    const key = encodePublicKey(new Uint8Array(32));
    assert.equal(isValidPublicKey(key.slice(0, 55)), false);
    assert.equal(isValidPublicKey("S" + key.slice(1)), false);
    assert.equal(isValidPublicKey(key.slice(0, 55) + "1"), false);
    assert.equal(isValidPublicKey(""), false);
  });

  it("rejects raw keys that are not 32 bytes", () => {
    assert.throws(() => encodePublicKey(new Uint8Array(31)), RangeError);
  });
});
