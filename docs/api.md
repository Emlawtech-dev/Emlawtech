# HTTP API

Base URL in development: `http://localhost:4000`. All bodies are JSON.

> The API has no authentication yet. The `actor` field in action requests is
> trusted as given. Use it for development only.

## Errors

Errors use one shape:

```json
{ "error": { "code": "forbidden", "message": "Only the client can perform this action" } }
```

| Status | Codes                                              |
| ------ | -------------------------------------------------- |
| 400    | `invalid_input`, `invalid_json`                    |
| 403    | `forbidden`                                        |
| 404    | `not_found`                                        |
| 405    | `method_not_allowed`                               |
| 409    | `invalid_transition`, `review_window_open`         |
| 413    | `payload_too_large`                                |
| 500    | `internal_error`                                   |

## Endpoints

### `GET /health`

Returns `{ "status": "ok" }`.

### `POST /escrows`

Create a draft escrow.

| Field                 | Type   | Notes                                             |
| --------------------- | ------ | ------------------------------------------------- |
| `clientKey`           | string | Stellar public key of the client                  |
| `freelancerKey`       | string | Stellar public key of the freelancer              |
| `arbiterKey`          | string | Stellar public key of the arbiter                 |
| `amount`              | string | XLM, up to 7 decimals, greater than zero          |
| `description`         | string | 1 to 500 characters                               |
| `reviewWindowSeconds` | number | Optional, at least 60. Defaults to 7 days.        |

The three keys must be valid and different from each other. Returns `201` with
the escrow.

### `GET /escrows`

Returns `{ "escrows": [...] }`, oldest first.

### `GET /escrows/:id`

Returns one escrow, or `404`.

### `POST /escrows/:id/actions`

Apply an action to an escrow.

| Field     | Type   | Notes                                                                 |
| --------- | ------ | --------------------------------------------------------------------- |
| `type`    | string | `fund`, `cancel`, `submit`, `approve`, `dispute`, `resolve`, `auto_release` |
| `actor`   | string | Public key of whoever performs the action (not used by `auto_release`) |
| `outcome` | string | Required for `resolve`: `release` or `refund`                         |

See the permission table in [architecture.md](architecture.md).

## Example

```bash
curl -X POST http://localhost:4000/escrows \
  -H "content-type: application/json" \
  -d '{
    "clientKey": "G...",
    "freelancerKey": "G...",
    "arbiterKey": "G...",
    "amount": "25.5",
    "description": "Build a landing page"
  }'
```

Responses include `amount` (XLM string), `amountStroops` (string), `status`,
`reviewDeadline` and the full `history` of transitions.
