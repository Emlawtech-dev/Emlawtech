# Roadmap

Emlawtech is early. This is the order we plan to work in. Items link to
issues once they are opened.

## Done

- [x] Integer-based XLM amounts and Stellar public key validation
- [x] Escrow state machine with roles, disputes and auto release
- [x] HTTP API with an in-memory store
- [x] CI that builds and tests every change

## Next

- [ ] Persist escrows in PostgreSQL behind the existing `EscrowStore` interface
- [ ] OpenAPI description of the HTTP API
- [ ] ESLint and Prettier configuration
- [ ] Docker setup for the backend

## Stellar integration

- [ ] Testnet gateway that verifies the funding payment through Horizon
- [ ] Release and refund transactions on testnet
- [ ] Wallet sign-in with SEP-10, replacing the trusted `actor` field

## Product

- [ ] Milestone-based escrows
- [ ] Web app (Next.js) to create, fund and track escrows
- [ ] Notifications when an escrow changes state

## Later

- [ ] Mainnet readiness review and security audit
