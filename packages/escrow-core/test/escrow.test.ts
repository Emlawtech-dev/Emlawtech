import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EscrowError,
  applyAction,
  createEscrow,
  reviewDeadline,
  type Escrow,
} from "../src/escrow.js";
import { encodePublicKey } from "../src/strkey.js";

const key = (seed: number) => encodePublicKey(Uint8Array.from({ length: 32 }, (_, i) => (i + seed) % 256));
const CLIENT = key(1);
const FREELANCER = key(2);
const ARBITER = key(3);
const T0 = new Date("2026-01-01T00:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

function draft(overrides: Partial<Parameters<typeof createEscrow>[0]> = {}): Escrow {
  return createEscrow({
    id: "esc_1",
    clientKey: CLIENT,
    freelancerKey: FREELANCER,
    arbiterKey: ARBITER,
    amountStroops: 500_000_000n,
    description: "Design a logo",
    reviewWindowSeconds: 3600,
    now: T0,
    ...overrides,
  });
}

function submitted(): Escrow {
  const funded = applyAction(draft(), { type: "fund", actor: CLIENT, at: minutes(1) });
  return applyAction(funded, { type: "submit", actor: FREELANCER, at: minutes(2) });
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof EscrowError ? error.code : "not_an_escrow_error";
  }
  return undefined;
}

describe("createEscrow", () => {
  it("creates a draft escrow with a creation event", () => {
    const escrow = draft();
    assert.equal(escrow.status, "draft");
    assert.equal(escrow.history.length, 1);
    assert.equal(escrow.history[0]?.type, "create");
  });

  it("rejects invalid keys, duplicate parties, bad amounts and bad descriptions", () => {
    assert.equal(codeOf(() => draft({ clientKey: "nope" })), "invalid_input");
    assert.equal(codeOf(() => draft({ freelancerKey: CLIENT })), "invalid_input");
    assert.equal(codeOf(() => draft({ amountStroops: 0n })), "invalid_input");
    assert.equal(codeOf(() => draft({ description: "   " })), "invalid_input");
    assert.equal(codeOf(() => draft({ reviewWindowSeconds: 5 })), "invalid_input");
  });
});

describe("happy path", () => {
  it("moves draft -> funded -> submitted -> released", () => {
    const escrow = applyAction(submitted(), { type: "approve", actor: CLIENT, at: minutes(3) });
    assert.equal(escrow.status, "released");
    assert.deepEqual(
      escrow.history.map((event) => event.to),
      ["draft", "funded", "submitted", "released"],
    );
  });

  it("does not mutate the escrow it was given", () => {
    const original = draft();
    applyAction(original, { type: "fund", actor: CLIENT, at: minutes(1) });
    assert.equal(original.status, "draft");
    assert.equal(original.history.length, 1);
  });
});

describe("permissions", () => {
  it("only the client can fund and approve", () => {
    assert.equal(codeOf(() => applyAction(draft(), { type: "fund", actor: FREELANCER, at: minutes(1) })), "forbidden");
    assert.equal(codeOf(() => applyAction(submitted(), { type: "approve", actor: FREELANCER, at: minutes(3) })), "forbidden");
  });

  it("only the freelancer can submit work", () => {
    const funded = applyAction(draft(), { type: "fund", actor: CLIENT, at: minutes(1) });
    assert.equal(codeOf(() => applyAction(funded, { type: "submit", actor: CLIENT, at: minutes(2) })), "forbidden");
  });

  it("a stranger cannot cancel or dispute", () => {
    const stranger = key(9);
    assert.equal(codeOf(() => applyAction(draft(), { type: "cancel", actor: stranger, at: minutes(1) })), "forbidden");
    assert.equal(codeOf(() => applyAction(submitted(), { type: "dispute", actor: stranger, at: minutes(3) })), "forbidden");
  });
});

describe("invalid transitions", () => {
  it("cannot submit before funding or approve before submission", () => {
    assert.equal(codeOf(() => applyAction(draft(), { type: "submit", actor: FREELANCER, at: minutes(1) })), "invalid_transition");
    const funded = applyAction(draft(), { type: "fund", actor: CLIENT, at: minutes(1) });
    assert.equal(codeOf(() => applyAction(funded, { type: "approve", actor: CLIENT, at: minutes(2) })), "invalid_transition");
  });

  it("cannot cancel once funded, and terminal states accept nothing", () => {
    const funded = applyAction(draft(), { type: "fund", actor: CLIENT, at: minutes(1) });
    assert.equal(codeOf(() => applyAction(funded, { type: "cancel", actor: CLIENT, at: minutes(2) })), "invalid_transition");
    const released = applyAction(submitted(), { type: "approve", actor: CLIENT, at: minutes(3) });
    assert.equal(codeOf(() => applyAction(released, { type: "dispute", actor: CLIENT, at: minutes(4) })), "invalid_transition");
  });
});

describe("disputes", () => {
  it("lets the arbiter release or refund a disputed escrow", () => {
    const disputed = applyAction(submitted(), { type: "dispute", actor: CLIENT, at: minutes(3) });
    assert.equal(disputed.status, "disputed");
    const refunded = applyAction(disputed, { type: "resolve", actor: ARBITER, at: minutes(4), outcome: "refund" });
    const released = applyAction(disputed, { type: "resolve", actor: ARBITER, at: minutes(4), outcome: "release" });
    assert.equal(refunded.status, "refunded");
    assert.equal(released.status, "released");
  });

  it("only the arbiter can resolve", () => {
    const disputed = applyAction(submitted(), { type: "dispute", actor: FREELANCER, at: minutes(3) });
    assert.equal(
      codeOf(() => applyAction(disputed, { type: "resolve", actor: CLIENT, at: minutes(4), outcome: "refund" })),
      "forbidden",
    );
  });
});

describe("auto release", () => {
  it("is blocked while the review window is open", () => {
    const escrow = submitted(); // submitted at minute 2, window 60 minutes
    assert.equal(reviewDeadline(escrow)?.toISOString(), minutes(62).toISOString());
    assert.equal(codeOf(() => applyAction(escrow, { type: "auto_release", at: minutes(61) })), "review_window_open");
  });

  it("releases once the window has passed", () => {
    const released = applyAction(submitted(), { type: "auto_release", at: minutes(62) });
    assert.equal(released.status, "released");
    assert.equal(released.history.at(-1)?.actor, "system");
  });

  it("does not apply to escrows that are not submitted", () => {
    assert.equal(codeOf(() => applyAction(draft(), { type: "auto_release", at: minutes(999) })), "invalid_transition");
  });
});
