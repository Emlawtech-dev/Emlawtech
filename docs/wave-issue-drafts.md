# Issue drafts for the Stellar Wave Program

Drafts of well-scoped issues to open on GitHub. Each one follows the
[task template](../.github/ISSUE_TEMPLATE/task.md). Complexity is a suggestion;
maintainers set the final value when adding an issue to a Wave.

Before opening an issue, check that the acceptance criteria are still true for
the current code, and add the file paths a newcomer should start from.

## Trivial

### 1. Filter `GET /escrows` by status
Add an optional `?status=` query parameter to `GET /escrows`.
- Valid values are the `EscrowStatus` values; an unknown value returns `400 invalid_input`.
- Works with the in-memory store; update `docs/api.md`.
- Tests cover valid, empty-result and invalid values.

### 2. Add ESLint and Prettier configuration
- Add configs and `lint` and `format:check` scripts at the repo root.
- Fix any existing violations.
- Run `lint` in `.github/workflows/ci.yml`.

### 3. Add configurable CORS headers to the API
- Read allowed origins from an `ALLOWED_ORIGINS` environment variable (comma separated).
- Respond to `OPTIONS` preflight requests.
- Document the variable in `.env.example`; tests cover allowed and blocked origins.

### 4. Report test coverage in CI
- Use Node's built-in `--experimental-test-coverage` flag in the test scripts.
- Print the summary in the CI log.
- Mention how to run it locally in `CONTRIBUTING.md`.

## Medium

### 5. Add milestone support to escrows
- Extend `escrow-core` so an escrow can hold several milestones whose amounts sum to the total.
- Each milestone can be submitted and approved separately; the escrow is released when all are approved.
- Existing single-deliverable behavior keeps working; add tests for the new transitions.

### 6. Write an OpenAPI 3.1 description of the API
- Add `docs/openapi.yaml` covering every endpoint, request body and error shape.
- Validate it in CI with a linter of your choice.
- Link it from `docs/api.md`.

### 7. Add basic rate limiting to the API
- Limit requests per IP using a small in-memory fixed-window limiter (no new runtime dependency).
- Return `429` with a `retry-after` header when the limit is hit.
- Limits are configurable through environment variables; tests cover the limit and reset.

### 8. Add a Dockerfile and docker compose file for the backend
- Multi-stage build that produces a small runtime image.
- `docker compose up` starts the API on port 4000.
- Document usage in `CONTRIBUTING.md`.

## High

### 9. PostgreSQL implementation of `EscrowStore`
- Implement the `EscrowStore` interface in `backend/src/store.ts` against PostgreSQL, with a migration for the schema.
- Select the store with an environment variable; keep the in-memory store for tests.
- Integration tests run against a real Postgres instance in CI.

### 10. Verify escrow funding on Stellar testnet through Horizon
- Add a gateway interface that checks a funding payment exists on testnet for the escrow's amount and accounts.
- Move an escrow to `funded` only after the payment is confirmed.
- Provide a fake gateway for unit tests and a documented manual test against testnet.

### 11. Wallet authentication with SEP-10
- Replace the trusted `actor` field with a verified identity from a SEP-10 challenge flow.
- Every action must be signed in by the account that performs it.
- Document the flow and cover failure cases in tests.

### 12. Next.js web app to create and track escrows
- Add a `frontend/` workspace with pages to create an escrow, view its status and history, and perform actions.
- Talks to the existing HTTP API; no wallet integration required in this issue.
- Includes component tests and instructions in the README.
