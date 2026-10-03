import type { Escrow } from "@emlawtech/escrow-core";

/**
 * Storage boundary for escrows. The in-memory version below is for
 * development and tests; a PostgreSQL implementation can replace it without
 * touching the route handlers.
 */
export interface EscrowStore {
  save(escrow: Escrow): Promise<void>;
  get(id: string): Promise<Escrow | undefined>;
  list(): Promise<Escrow[]>;
}

export class InMemoryEscrowStore implements EscrowStore {
  private readonly escrows = new Map<string, Escrow>();

  async save(escrow: Escrow): Promise<void> {
    this.escrows.set(escrow.id, escrow);
  }

  async get(id: string): Promise<Escrow | undefined> {
    return this.escrows.get(id);
  }

  async list(): Promise<Escrow[]> {
    return [...this.escrows.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
