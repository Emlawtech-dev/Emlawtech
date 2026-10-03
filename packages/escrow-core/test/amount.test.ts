import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_STROOPS, STROOPS_PER_XLM, formatStroops, parseXlm } from "../src/amount.js";

describe("parseXlm", () => {
  it("parses whole and fractional amounts into stroops", () => {
    assert.equal(parseXlm("1"), STROOPS_PER_XLM);
    assert.equal(parseXlm("12.5"), 125_000_000n);
    assert.equal(parseXlm("0.0000001"), 1n);
    assert.equal(parseXlm(" 3.14 "), 31_400_000n);
  });

  it("rejects malformed amounts", () => {
    for (const bad of ["", "abc", "-1", "1.", ".5", "1.12345678", "1e3", "1,5"]) {
      assert.throws(() => parseXlm(bad), RangeError, `expected "${bad}" to be rejected`);
    }
  });

  it("rejects amounts above the Stellar maximum", () => {
    assert.throws(() => parseXlm("922337203686"), RangeError);
    assert.equal(parseXlm("922337203685.4775807"), MAX_STROOPS);
  });
});

describe("formatStroops", () => {
  it("formats stroops and trims trailing zeros", () => {
    assert.equal(formatStroops(125_000_000n), "12.5");
    assert.equal(formatStroops(STROOPS_PER_XLM), "1");
    assert.equal(formatStroops(1n), "0.0000001");
    assert.equal(formatStroops(0n), "0");
  });

  it("round-trips with parseXlm", () => {
    for (const value of ["0.5", "42", "1000.0000001"]) {
      assert.equal(formatStroops(parseXlm(value)), value);
    }
  });

  it("rejects negative amounts", () => {
    assert.throws(() => formatStroops(-1n), RangeError);
  });
});
