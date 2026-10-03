import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  EscrowError,
  applyAction,
  createEscrow,
  parseXlm,
  type EscrowAction,
} from "@emlawtech/escrow-core";
import { HttpError, readJsonBody, sendJson } from "./http.js";
import { serializeEscrow } from "./serialize.js";
import { InMemoryEscrowStore, type EscrowStore } from "./store.js";

export interface AppOptions {
  store?: EscrowStore;
  /** Injectable clock so tests can control time. */
  now?: () => Date;
}

type Handler = (req: IncomingMessage, res: ServerResponse, params: string[]) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

const ACTION_TYPES = ["fund", "cancel", "submit", "approve", "dispute", "resolve", "auto_release"] as const;

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_input", `${field} must be a string`);
  }
  return value;
}

function statusForEscrowError(error: EscrowError): number {
  switch (error.code) {
    case "invalid_input":
      return 400;
    case "forbidden":
      return 403;
    case "invalid_transition":
    case "review_window_open":
      return 409;
  }
}

export function createApp(options: AppOptions = {}): Server {
  const store = options.store ?? new InMemoryEscrowStore();
  const now = options.now ?? (() => new Date());

  const routes: Route[] = [
    {
      method: "GET",
      pattern: /^\/health$/,
      handler: async (_req, res) => sendJson(res, 200, { status: "ok" }),
    },
    {
      method: "POST",
      pattern: /^\/escrows$/,
      handler: async (req, res) => {
        const body = await readJsonBody(req);
        let amountStroops: bigint;
        try {
          amountStroops = parseXlm(requireString(body, "amount"));
        } catch (error) {
          if (error instanceof RangeError) throw new HttpError(400, "invalid_input", error.message);
          throw error;
        }
        const reviewWindowSeconds = body.reviewWindowSeconds;
        if (reviewWindowSeconds !== undefined && typeof reviewWindowSeconds !== "number") {
          throw new HttpError(400, "invalid_input", "reviewWindowSeconds must be a number");
        }
        const escrow = createEscrow({
          id: `esc_${randomUUID()}`,
          clientKey: requireString(body, "clientKey"),
          freelancerKey: requireString(body, "freelancerKey"),
          arbiterKey: requireString(body, "arbiterKey"),
          amountStroops,
          description: requireString(body, "description"),
          ...(reviewWindowSeconds !== undefined ? { reviewWindowSeconds } : {}),
          now: now(),
        });
        await store.save(escrow);
        sendJson(res, 201, serializeEscrow(escrow));
      },
    },
    {
      method: "GET",
      pattern: /^\/escrows$/,
      handler: async (_req, res) => {
        const escrows = await store.list();
        sendJson(res, 200, { escrows: escrows.map(serializeEscrow) });
      },
    },
    {
      method: "GET",
      pattern: /^\/escrows\/([\w-]+)$/,
      handler: async (_req, res, [id]) => {
        const escrow = await store.get(id ?? "");
        if (!escrow) throw new HttpError(404, "not_found", "Escrow not found");
        sendJson(res, 200, serializeEscrow(escrow));
      },
    },
    {
      method: "POST",
      pattern: /^\/escrows\/([\w-]+)\/actions$/,
      handler: async (req, res, [id]) => {
        const escrow = await store.get(id ?? "");
        if (!escrow) throw new HttpError(404, "not_found", "Escrow not found");
        const body = await readJsonBody(req);
        const type = requireString(body, "type");
        if (!(ACTION_TYPES as readonly string[]).includes(type)) {
          throw new HttpError(400, "invalid_input", `type must be one of: ${ACTION_TYPES.join(", ")}`);
        }
        const at = now();
        let action: EscrowAction;
        if (type === "auto_release") {
          action = { type, at };
        } else if (type === "resolve") {
          const outcome = requireString(body, "outcome");
          if (outcome !== "release" && outcome !== "refund") {
            throw new HttpError(400, "invalid_input", 'outcome must be "release" or "refund"');
          }
          action = { type, actor: requireString(body, "actor"), at, outcome };
        } else {
          action = { type: type as "fund" | "cancel" | "submit" | "approve" | "dispute", actor: requireString(body, "actor"), at };
        }
        const updated = applyAction(escrow, action);
        await store.save(updated);
        sendJson(res, 200, serializeEscrow(updated));
      },
    },
  ];

  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      const matches = routes.filter((route) => route.pattern.test(path));
      if (matches.length === 0) {
        throw new HttpError(404, "not_found", "Route not found");
      }
      const route = matches.find((candidate) => candidate.method === req.method);
      if (!route) {
        throw new HttpError(405, "method_not_allowed", "Method not allowed");
      }
      const params = route.pattern.exec(path)?.slice(1) ?? [];
      await route.handler(req, res, params);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof EscrowError) {
        sendJson(res, statusForEscrowError(error), { error: { code: error.code, message: error.message } });
        return;
      }
      console.error(error);
      sendJson(res, 500, { error: { code: "internal_error", message: "Something went wrong" } });
    }
  });
}
