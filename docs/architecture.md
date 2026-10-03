# Architecture

Emlawtech is a small monorepo. The goal is to keep the money-handling rules in
one pure, heavily tested place and keep everything else replaceable.

```
Emlawtech/
├── packages/escrow-core/   Pure TypeScript domain logic. No runtime dependencies.
├── backend/                HTTP API built on Node's built-in http module.
├── web/                    Static landing page (a full app is on the roadmap).
├── docs/                   Engineering documentation.
└── .github/                CI workflow, issue and pull request templates.
```

## escrow-core

`packages/escrow-core` knows nothing about HTTP, databases or the network. It
contains:

- **Amounts** (`amount.ts`): XLM values are parsed into integer stroops
  (`bigint`, 1 XLM = 10,000,000 stroops), so floating point rounding can never
  change how much money moves.
- **Public keys** (`strkey.ts`): validation of Stellar `G...` addresses,
  including the CRC16-XModem checksum.
- **Escrow state machine** (`escrow.ts`): `createEscrow` and `applyAction`.
  Escrows are immutable values. Every action returns a new escrow and appends
  to its history.

### Escrow lifecycle

```
draft ──fund (client)──▶ funded ──submit (freelancer)──▶ submitted
  │                        │                                │
  │ cancel                 │ dispute                        ├─ approve (client) ──────▶ released
  ▼                        ▼                                ├─ auto_release (after window) ▶ released
cancelled              disputed ◀──── dispute ──────────────┘
                           │
                           └─ resolve (arbiter) ──▶ released | refunded
```

| Action         | Who may do it          | Allowed from          |
| -------------- | ---------------------- | --------------------- |
| `fund`         | client                 | `draft`               |
| `cancel`       | client or freelancer   | `draft`               |
| `submit`       | freelancer             | `funded`              |
| `approve`      | client                 | `submitted`           |
| `dispute`      | client or freelancer   | `funded`, `submitted` |
| `resolve`      | arbiter                | `disputed`            |
| `auto_release` | system                 | `submitted`, after the review window |

`released`, `refunded` and `cancelled` are final.

## backend

`backend/` exposes the state machine over HTTP (see [api.md](api.md)).

- `app.ts` wires routes and maps domain errors to HTTP status codes.
- `store.ts` defines the `EscrowStore` interface and an in-memory
  implementation. A database-backed store can replace it without touching the
  routes.
- `serialize.ts` converts escrows to JSON. Amounts are sent as strings.

## What is not built yet

- **No on-chain settlement.** `fund`, `approve` and the other actions change
  the escrow's recorded status only. Moving real assets on Stellar is on the
  [roadmap](../ROADMAP.md).
- **No authentication.** The API trusts the `actor` field in the request body.
  Do not expose it to the internet until wallet-based authentication exists.
- **No persistence.** Data lives in memory and is lost on restart.
