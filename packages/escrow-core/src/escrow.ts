import { MAX_STROOPS } from "./amount.js";
import { isValidPublicKey } from "./strkey.js";

export type EscrowStatus =
  | "draft"
  | "funded"
  | "submitted"
  | "disputed"
  | "released"
  | "refunded"
  | "cancelled";

export type EscrowRole = "client" | "freelancer" | "arbiter";

export type EscrowAction =
  | { type: "fund"; actor: string; at: Date }
  | { type: "cancel"; actor: string; at: Date }
  | { type: "submit"; actor: string; at: Date }
  | { type: "approve"; actor: string; at: Date }
  | { type: "dispute"; actor: string; at: Date }
  | { type: "resolve"; actor: string; at: Date; outcome: "release" | "refund" }
  | { type: "auto_release"; at: Date };

export interface EscrowEvent {
  type: EscrowAction["type"] | "create";
  actor: string | "system";
  at: Date;
  from: EscrowStatus | null;
  to: EscrowStatus;
}

export interface Escrow {
  readonly id: string;
  readonly clientKey: string;
  readonly freelancerKey: string;
  readonly arbiterKey: string;
  readonly amountStroops: bigint;
  readonly description: string;
  readonly reviewWindowSeconds: number;
  readonly status: EscrowStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly submittedAt: Date | null;
  readonly history: readonly EscrowEvent[];
}

export interface CreateEscrowInput {
  id: string;
  clientKey: string;
  freelancerKey: string;
  arbiterKey: string;
  amountStroops: bigint;
  description: string;
  /** How long the client has to review a submission before it auto-releases. */
  reviewWindowSeconds?: number;
  now: Date;
}

export type EscrowErrorCode =
  | "invalid_input"
  | "invalid_transition"
  | "forbidden"
  | "review_window_open";

export class EscrowError extends Error {
  readonly code: EscrowErrorCode;

  constructor(code: EscrowErrorCode, message: string) {
    super(message);
    this.name = "EscrowError";
    this.code = code;
  }
}

export const DEFAULT_REVIEW_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export function createEscrow(input: CreateEscrowInput): Escrow {
  const keys = [input.clientKey, input.freelancerKey, input.arbiterKey];
  if (!keys.every(isValidPublicKey)) {
    throw new EscrowError("invalid_input", "clientKey, freelancerKey and arbiterKey must be valid Stellar public keys");
  }
  if (new Set(keys).size !== 3) {
    throw new EscrowError("invalid_input", "client, freelancer and arbiter must be three different accounts");
  }
  if (input.amountStroops <= 0n || input.amountStroops > MAX_STROOPS) {
    throw new EscrowError("invalid_input", "amount must be greater than zero and within the Stellar maximum");
  }
  const description = input.description.trim();
  if (description.length === 0 || description.length > 500) {
    throw new EscrowError("invalid_input", "description must be between 1 and 500 characters");
  }
  const reviewWindowSeconds = input.reviewWindowSeconds ?? DEFAULT_REVIEW_WINDOW_SECONDS;
  if (!Number.isInteger(reviewWindowSeconds) || reviewWindowSeconds < 60) {
    throw new EscrowError("invalid_input", "reviewWindowSeconds must be a whole number of at least 60");
  }
  return {
    id: input.id,
    clientKey: input.clientKey,
    freelancerKey: input.freelancerKey,
    arbiterKey: input.arbiterKey,
    amountStroops: input.amountStroops,
    description,
    reviewWindowSeconds,
    status: "draft",
    createdAt: input.now,
    updatedAt: input.now,
    submittedAt: null,
    history: [{ type: "create", actor: input.clientKey, at: input.now, from: null, to: "draft" }],
  };
}

function requireRole(escrow: Escrow, actor: string, role: EscrowRole): void {
  const expected =
    role === "client" ? escrow.clientKey : role === "freelancer" ? escrow.freelancerKey : escrow.arbiterKey;
  if (actor !== expected) {
    throw new EscrowError("forbidden", `Only the ${role} can perform this action`);
  }
}

function requireStatus(escrow: Escrow, action: string, allowed: EscrowStatus[]): void {
  if (!allowed.includes(escrow.status)) {
    throw new EscrowError("invalid_transition", `Cannot ${action} an escrow that is ${escrow.status}`);
  }
}

function transition(escrow: Escrow, action: EscrowAction, to: EscrowStatus): Escrow {
  const event: EscrowEvent = {
    type: action.type,
    actor: "actor" in action ? action.actor : "system",
    at: action.at,
    from: escrow.status,
    to,
  };
  return {
    ...escrow,
    status: to,
    updatedAt: action.at,
    submittedAt: to === "submitted" ? action.at : escrow.submittedAt,
    history: [...escrow.history, event],
  };
}

/** Moment after which a submitted escrow may be released without client approval. */
export function reviewDeadline(escrow: Escrow): Date | null {
  if (escrow.status !== "submitted" || escrow.submittedAt === null) return null;
  return new Date(escrow.submittedAt.getTime() + escrow.reviewWindowSeconds * 1000);
}

/**
 * Apply an action to an escrow and return the updated escrow. The input is
 * never mutated. Throws EscrowError when the actor is not allowed to take the
 * action or the escrow is in the wrong state.
 */
export function applyAction(escrow: Escrow, action: EscrowAction): Escrow {
  switch (action.type) {
    case "fund":
      requireRole(escrow, action.actor, "client");
      requireStatus(escrow, "fund", ["draft"]);
      return transition(escrow, action, "funded");

    case "cancel":
      if (action.actor !== escrow.clientKey && action.actor !== escrow.freelancerKey) {
        throw new EscrowError("forbidden", "Only the client or the freelancer can cancel");
      }
      requireStatus(escrow, "cancel", ["draft"]);
      return transition(escrow, action, "cancelled");

    case "submit":
      requireRole(escrow, action.actor, "freelancer");
      requireStatus(escrow, "submit work for", ["funded"]);
      return transition(escrow, action, "submitted");

    case "approve":
      requireRole(escrow, action.actor, "client");
      requireStatus(escrow, "approve", ["submitted"]);
      return transition(escrow, action, "released");

    case "dispute":
      if (action.actor !== escrow.clientKey && action.actor !== escrow.freelancerKey) {
        throw new EscrowError("forbidden", "Only the client or the freelancer can open a dispute");
      }
      requireStatus(escrow, "dispute", ["funded", "submitted"]);
      return transition(escrow, action, "disputed");

    case "resolve":
      requireRole(escrow, action.actor, "arbiter");
      requireStatus(escrow, "resolve", ["disputed"]);
      return transition(escrow, action, action.outcome === "release" ? "released" : "refunded");

    case "auto_release": {
      requireStatus(escrow, "auto-release", ["submitted"]);
      const deadline = reviewDeadline(escrow);
      if (deadline === null || action.at < deadline) {
        throw new EscrowError("review_window_open", "The client review window has not ended yet");
      }
      return transition(escrow, action, "released");
    }
  }
}
