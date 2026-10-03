import { formatStroops, reviewDeadline, type Escrow } from "@emlawtech/escrow-core";

/** Convert an escrow into plain JSON. Amounts are strings so nothing is lost to floats. */
export function serializeEscrow(escrow: Escrow) {
  return {
    id: escrow.id,
    status: escrow.status,
    clientKey: escrow.clientKey,
    freelancerKey: escrow.freelancerKey,
    arbiterKey: escrow.arbiterKey,
    amount: formatStroops(escrow.amountStroops),
    amountStroops: escrow.amountStroops.toString(),
    description: escrow.description,
    reviewWindowSeconds: escrow.reviewWindowSeconds,
    reviewDeadline: reviewDeadline(escrow)?.toISOString() ?? null,
    createdAt: escrow.createdAt.toISOString(),
    updatedAt: escrow.updatedAt.toISOString(),
    history: escrow.history.map((event) => ({
      type: event.type,
      actor: event.actor,
      from: event.from,
      to: event.to,
      at: event.at.toISOString(),
    })),
  };
}
