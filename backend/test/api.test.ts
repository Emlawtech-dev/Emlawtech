import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { encodePublicKey } from "@emlawtech/escrow-core";
import { createApp } from "../src/app.js";

const key = (seed: number) => encodePublicKey(Uint8Array.from({ length: 32 }, (_, i) => (i + seed) % 256));
const CLIENT = key(1);
const FREELANCER = key(2);
const ARBITER = key(3);

let server: Server;
let baseUrl: string;
let clock = new Date("2026-01-01T00:00:00Z");

before(async () => {
  server = createApp({ now: () => clock });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as any };
}

async function newEscrow(overrides: Record<string, unknown> = {}) {
  return call("POST", "/escrows", {
    clientKey: CLIENT,
    freelancerKey: FREELANCER,
    arbiterKey: ARBITER,
    amount: "25.5",
    description: "Build a landing page",
    reviewWindowSeconds: 3600,
    ...overrides,
  });
}

describe("health and routing", () => {
  it("reports health", async () => {
    const { status, json } = await call("GET", "/health");
    assert.equal(status, 200);
    assert.deepEqual(json, { status: "ok" });
  });

  it("returns 404 for unknown routes and 405 for wrong methods", async () => {
    assert.equal((await call("GET", "/nope")).status, 404);
    assert.equal((await call("DELETE", "/escrows")).status, 405);
  });
});

describe("creating escrows", () => {
  it("creates a draft escrow and returns amounts as strings", async () => {
    const { status, json } = await newEscrow();
    assert.equal(status, 201);
    assert.equal(json.status, "draft");
    assert.equal(json.amount, "25.5");
    assert.equal(json.amountStroops, "255000000");
    assert.match(json.id, /^esc_/);
  });

  it("rejects bad input with a 400", async () => {
    assert.equal((await newEscrow({ amount: "-5" })).status, 400);
    assert.equal((await newEscrow({ amount: "0" })).status, 400);
    assert.equal((await newEscrow({ clientKey: "not-a-key" })).status, 400);
    assert.equal((await newEscrow({ description: 42 })).status, 400);
    const bad = await call("POST", "/escrows", undefined);
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error.code, "invalid_json");
  });

  it("lists and fetches created escrows", async () => {
    const created = await newEscrow();
    const fetched = await call("GET", `/escrows/${created.json.id}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.json.id, created.json.id);
    const list = await call("GET", "/escrows");
    assert.ok(list.json.escrows.some((e: { id: string }) => e.id === created.json.id));
    assert.equal((await call("GET", "/escrows/esc_missing")).status, 404);
  });
});

describe("escrow lifecycle over HTTP", () => {
  it("runs fund -> submit -> approve", async () => {
    const { json: created } = await newEscrow();
    const act = (type: string, actor: string, extra = {}) =>
      call("POST", `/escrows/${created.id}/actions`, { type, actor, ...extra });

    assert.equal((await act("fund", CLIENT)).json.status, "funded");
    assert.equal((await act("submit", FREELANCER)).json.status, "submitted");
    const done = await act("approve", CLIENT);
    assert.equal(done.status, 200);
    assert.equal(done.json.status, "released");
    assert.deepEqual(
      done.json.history.map((event: { to: string }) => event.to),
      ["draft", "funded", "submitted", "released"],
    );
  });

  it("maps domain errors to 403 and 409", async () => {
    const { json: created } = await newEscrow();
    const url = `/escrows/${created.id}/actions`;
    const wrongActor = await call("POST", url, { type: "fund", actor: FREELANCER });
    assert.equal(wrongActor.status, 403);
    assert.equal(wrongActor.json.error.code, "forbidden");
    const wrongState = await call("POST", url, { type: "approve", actor: CLIENT });
    assert.equal(wrongState.status, 409);
    assert.equal(wrongState.json.error.code, "invalid_transition");
  });

  it("rejects unknown action types and missing outcomes", async () => {
    const { json: created } = await newEscrow();
    const url = `/escrows/${created.id}/actions`;
    assert.equal((await call("POST", url, { type: "steal", actor: CLIENT })).status, 400);
    assert.equal((await call("POST", url, { type: "resolve", actor: ARBITER })).status, 400);
  });

  it("supports disputes resolved by the arbiter", async () => {
    const { json: created } = await newEscrow();
    const act = (type: string, actor: string, extra = {}) =>
      call("POST", `/escrows/${created.id}/actions`, { type, actor, ...extra });
    await act("fund", CLIENT);
    await act("dispute", FREELANCER);
    const resolved = await act("resolve", ARBITER, { outcome: "refund" });
    assert.equal(resolved.json.status, "refunded");
  });

  it("auto-releases only after the review window", async () => {
    const { json: created } = await newEscrow();
    const act = (type: string, actor?: string) =>
      call("POST", `/escrows/${created.id}/actions`, { type, ...(actor ? { actor } : {}) });
    await act("fund", CLIENT);
    await act("submit", FREELANCER);
    assert.equal((await act("auto_release")).status, 409);
    clock = new Date(clock.getTime() + 3600 * 1000 + 1000);
    const released = await act("auto_release");
    assert.equal(released.status, 200);
    assert.equal(released.json.status, "released");
  });
});
